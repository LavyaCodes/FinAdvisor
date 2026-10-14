"""Train/evaluate Isolation Forest on synthetic data, then save a local artifact.

Run from the repository root:
    python -m backend.scripts.train_isolation_forest
"""

import argparse
from pathlib import Path

from sklearn.metrics import accuracy_score, precision_score, recall_score

from backend.app.isolation_forest import predict_expense_anomalies, save_isolation_forest, train_isolation_forest
from backend.app.synthetic_expense_data import (
    make_synthetic_evaluation_data,
    make_synthetic_training_expenses,
)

DEFAULT_ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "model_artifacts" / "isolation_forest.joblib"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, default=DEFAULT_ARTIFACT_PATH)
    args = parser.parse_args()

    training_expenses = make_synthetic_training_expenses()
    evaluation_expenses, expected_labels = make_synthetic_evaluation_data()
    model = train_isolation_forest(training_expenses)
    predictions = predict_expense_anomalies(model, evaluation_expenses)
    predicted_labels = [int(prediction) for prediction in predictions]

    print("Synthetic Isolation Forest experiment (not financial advice or fraud detection)")
    print(f"Training samples: {len(training_expenses)} synthetic typical expenses")
    print(f"Evaluation samples: {len(evaluation_expenses)} separate synthetic examples")
    print(f"Flagged evaluation examples: {sum(predicted_labels)}")
    print(f"Accuracy:  {accuracy_score(expected_labels, predicted_labels):.3f}")
    print(f"Precision: {precision_score(expected_labels, predicted_labels, zero_division=0):.3f}")
    print(f"Recall:    {recall_score(expected_labels, predicted_labels, zero_division=0):.3f}")
    print(f"Artifact:  {save_isolation_forest(model, args.artifact)}")


if __name__ == "__main__":
    main()