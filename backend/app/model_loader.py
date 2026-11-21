
import joblib

from .config import (
    FEATURE_COLUMNS,
    ISOLATION_FOREST_PATH,
    RANDOM_FOREST_PATH,
)


def _load_artifact(path, model_label, required_keys):
    if not path.is_file():
        raise FileNotFoundError(f"{model_label} model not found: {path}")

    artifact = joblib.load(path)
    if not isinstance(artifact, dict):
        raise TypeError(f"{model_label} artifact must be a dictionary.")

    missing_keys = required_keys.difference(artifact)
    if missing_keys:
        raise ValueError(
            f"{model_label} artifact is missing required keys: "
            f"{', '.join(sorted(missing_keys))}"
        )
    return artifact


def _validate_features(features, model_label):
    if features != FEATURE_COLUMNS:
        raise ValueError(
            f"{model_label} artifact features do not match the approved "
            f"input features: {features!r}"
        )


def load_models():
    """Load and validate both trained model artifacts."""
    random_forest_artifact = _load_artifact(
        RANDOM_FOREST_PATH,
        "Random Forest",
        {"model", "threshold", "feature_columns", "model_name", "dataset"},
    )
    isolation_forest_artifact = _load_artifact(
        ISOLATION_FOREST_PATH,
        "Isolation Forest",
        {"model", "preprocessor", "contamination", "features"},
    )

    _validate_features(random_forest_artifact["feature_columns"], "Random Forest")
    _validate_features(
        isolation_forest_artifact["features"],
        "Isolation Forest",
    )

    return {
        "random_forest": random_forest_artifact,
        "isolation_forest": isolation_forest_artifact,
    }


# Fail application startup explicitly if either artifact is unavailable or invalid.
MODELS = load_models()
