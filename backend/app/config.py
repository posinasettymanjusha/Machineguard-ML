
from pathlib import Path

# backend/app/config.py -> backend/app -> backend -> project root
BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = BASE_DIR / "models"

RANDOM_FOREST_PATH = MODEL_DIR / "machineguard_model.joblib"
ISOLATION_FOREST_PATH = MODEL_DIR / "isolation_forest_model.joblib"

# API configuration
API_TITLE = "MachineGuard ML API"
API_VERSION = "1.0.0"
API_PREFIX = "/api/v1"

# Approved input features from the training dataset.
FEATURE_COLUMNS = [
    "Type",
    "Air temperature",
    "Process temperature",
    "Rotational speed",
    "Torque",
    "Tool wear",
]
