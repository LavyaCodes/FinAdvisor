from pathlib import Path

import pytest
from sklearn.ensemble import IsolationForest

from backend.app.isolation_forest import (
    MIN_PREDICTION_SAMPLES,
    load_default_isolation_forest,
    load_isolation_forest,
    predict_expense_anomalies,
    save_isolation_forest,
    train_isolation_forest,
)
from backend.app.synthetic_expense_data import make_synthetic_training_expenses


def test_training_returns_reproducible_fitted_isolation_forest() -> None:
    training_data = make_synthetic_training_expenses()

    first_model = train_isolation_forest(training_data)
    second_model = train_isolation_forest(training_data)

    assert isinstance(first_model, IsolationForest)
    assert first_model.n_features_in_ == 1
    assert first_model.random_state == second_model.random_state == 1729
    assert first_model.predict([[1000.0]]).tolist() == second_model.predict([[1000.0]]).tolist()


def test_model_save_load_and_prediction(tmp_path: Path) -> None:
    model = train_isolation_forest(make_synthetic_training_expenses())
    artifact_path = save_isolation_forest(model, tmp_path / "model" / "isolation_forest.joblib")
    loaded_model = load_isolation_forest(artifact_path)
    examples = [20.0, 40.0, 60.0, 80.0, 1000.0]

    assert artifact_path.is_file()
    predictions = predict_expense_anomalies(loaded_model, examples)
    assert len(predictions) == len(examples)
    assert predictions[-1] is True


def test_default_model_loader_caches_the_saved_artifact(monkeypatch, tmp_path: Path) -> None:
    import backend.app.isolation_forest as isolation_forest

    artifact_path = save_isolation_forest(
        train_isolation_forest(make_synthetic_training_expenses()),
        tmp_path / "isolation_forest.joblib",
    )
    monkeypatch.setattr(isolation_forest, "DEFAULT_ARTIFACT_PATH", artifact_path)
    load_default_isolation_forest.cache_clear()
    try:
        first_load = load_default_isolation_forest()
        second_load = load_default_isolation_forest()
        assert first_load is second_load
    finally:
        load_default_isolation_forest.cache_clear()


def test_training_rejects_insufficient_or_invalid_examples() -> None:
    with pytest.raises(ValueError, match="At least 20"):
        train_isolation_forest([10.0] * 19)
    with pytest.raises(ValueError, match="finite numbers"):
        train_isolation_forest([10.0] * 19 + [float("nan")])
    with pytest.raises(ValueError, match="non-negative"):
        train_isolation_forest([10.0] * 19 + [-1.0])


def test_prediction_rejects_insufficient_or_invalid_expenses() -> None:
    model = train_isolation_forest(make_synthetic_training_expenses())

    with pytest.raises(ValueError, match=f"At least {MIN_PREDICTION_SAMPLES}"):
        predict_expense_anomalies(model, [10.0] * (MIN_PREDICTION_SAMPLES - 1))
    with pytest.raises(ValueError, match="finite numbers"):
        predict_expense_anomalies(model, [10.0, 20.0, 30.0, 40.0, float("inf")])
    with pytest.raises(ValueError, match="non-negative"):
        predict_expense_anomalies(model, [10.0, 20.0, 30.0, 40.0, -1.0])