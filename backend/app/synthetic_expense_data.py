"""Fixed-seed synthetic samples for the Isolation Forest experiment only."""

import numpy as np

TRAINING_RANDOM_SEED = 20261013
EVALUATION_RANDOM_SEED = 20261014


def make_synthetic_training_expenses() -> list[float]:
    """Create typical-looking synthetic amounts; no uploaded data is read."""
    generator = np.random.default_rng(TRAINING_RANDOM_SEED)
    return generator.lognormal(mean=3.8, sigma=0.35, size=400).round(2).tolist()


def make_synthetic_evaluation_data() -> tuple[list[float], list[int]]:
    """Return separate synthetic examples and labels (1=unusual, 0=typical)."""
    generator = np.random.default_rng(EVALUATION_RANDOM_SEED)
    typical = generator.lognormal(mean=3.8, sigma=0.35, size=100).round(2)
    unusual = generator.uniform(low=500, high=2500, size=20).round(2)
    values = np.concatenate((typical, unusual)).tolist()
    labels = ([0] * len(typical)) + ([1] * len(unusual))
    return values, labels