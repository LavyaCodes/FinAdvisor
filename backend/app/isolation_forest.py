"""Small Isolation Forest utilities for synthetic expense experiments.

This module is not connected to uploads or the API. Its model is trained only
on the reproducible synthetic examples in synthetic_expense_data.py.
"""

from math import isfinite
from functools import lru_cache
from pathlib import Path
from typing import Sequence

import joblib
from sklearn.ensemble import IsolationForest

MIN_TRAINING_SAMPLES = 20
MIN_PREDICTION_SAMPLES = 5
FEATURE_COUNT = 1
DEFAULT_ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "model_artifacts" / "isolation_forest.joblib"


def _validate_expenses(expenses: Sequence[float], *, minimum: int, label: str) -> list[float]:
    """Accept non-negative finite magnitudes and reject unsafe or small inputs."""
    values = list(expenses)
    if len(values) < minimum:
        raise ValueError(f"At least {minimum} {label} are required; got {len(values)}.")

    for value in values:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
            raise ValueError("Expense features must be finite numbers.")
        if value < 0:
            raise ValueError("Expense features must be non-negative magnitudes.")
    return [float(value) for value in values]


def validate_prediction_expenses(expense_magnitudes: Sequence[float]) -> list[float]:
    """Validate one prediction batch before loading the model artifact."""
    return _validate_expenses(
        expense_magnitudes,
        minimum=MIN_PREDICTION_SAMPLES,
        label="prediction samples",
    )


def train_isolation_forest(
    synthetic_training_expenses: Sequence[float],
    *,
    contamination: float = 0.05,
    random_state: int = 1729,
) -> IsolationForest:
    """Fit a reproducible one-feature model on synthetic expense magnitudes."""
    values = _validate_expenses(
        synthetic_training_expenses,
        minimum=MIN_TRAINING_SAMPLES,
        label="synthetic training samples",
    )
    if not 0 < contamination < 0.5:
        raise ValueError("contamination must be greater than 0 and less than 0.5.")

    model = IsolationForest(
        n_estimators=200,
        max_samples=min(256, len(values)),
        contamination=contamination,
        random_state=random_state,
    )
    model.fit([[value] for value in values])
    return model


def predict_expense_anomalies(
    model: IsolationForest,
    expense_magnitudes: Sequence[float],
) -> list[bool]:
    """Return one anomaly flag per expense; reject too-small or invalid batches."""
    values = validate_prediction_expenses(expense_magnitudes)
    if getattr(model, "n_features_in_", None) != FEATURE_COUNT:
        raise ValueError("The loaded Isolation Forest must be fitted on one expense feature.")
    return [int(prediction) == -1 for prediction in model.predict([[value] for value in values])]


def save_isolation_forest(model: IsolationForest, artifact_path: str | Path) -> Path:
    """Save the fitted model to the requested local artifact path."""
    path = Path(artifact_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)
    return path


def load_isolation_forest(artifact_path: str | Path) -> IsolationForest:
    """Load and validate a previously fitted one-feature Isolation Forest."""
    model = joblib.load(artifact_path)
    if not isinstance(model, IsolationForest):
        raise ValueError("The artifact is not a scikit-learn IsolationForest.")
    if getattr(model, "n_features_in_", None) != FEATURE_COUNT:
        raise ValueError("The loaded Isolation Forest must be fitted on one expense feature.")
    return model


@lru_cache(maxsize=1)
def load_default_isolation_forest() -> IsolationForest:
    """Load the saved model once per process; never retrain on a request."""
    return load_isolation_forest(DEFAULT_ARTIFACT_PATH)