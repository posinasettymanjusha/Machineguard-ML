
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import FastAPI

from backend.app.config import API_PREFIX, API_TITLE, API_VERSION, FEATURE_COLUMNS
from backend.app.model_loader import MODELS
from backend.app.schemas import (
    AnomalyResponse,
    ExplanationResponse,
    HealthResponse,
    MachineInput,
    ModelInfoResponse,
    PredictionResponse,
)

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description="Predictive Maintenance and Early Failure Detection API",
)


@lru_cache(maxsize=1)
def _get_shap_explainer():
    import shap

    estimator = MODELS["random_forest"]["model"].named_steps["model"]
    return shap.TreeExplainer(
        estimator,
        model_output="raw",
        feature_perturbation="tree_path_dependent",
    )


def _select_class_shap_values(
    shap_values,
    class_index: int,
    class_count: int,
    feature_count: int,
) -> np.ndarray:
    if isinstance(shap_values, list):
        class_values = np.asarray(shap_values[class_index])
        if class_values.shape == (1, feature_count):
            return class_values[0]
        if class_values.shape == (feature_count,):
            return class_values
        raise RuntimeError(f"Unsupported SHAP class output shape: {class_values.shape}")

    values = np.asarray(shap_values)
    if values.shape == (1, feature_count, class_count):
        return values[0, :, class_index]
    if values.shape == (1, class_count, feature_count):
        return values[0, class_index, :]
    if values.shape == (class_count, 1, feature_count):
        return values[class_index, 0, :]
    if values.shape == (1, feature_count):
        return values[0]
    if values.shape == (feature_count,):
        return values
    raise RuntimeError(f"Unsupported SHAP output shape: {values.shape}")


def _select_class_base_value(
    expected_value,
    class_index: int,
    class_count: int,
) -> float:
    values = np.asarray(expected_value)
    if values.ndim == 0:
        return float(values)
    if values.size == class_count:
        return float(values.reshape(-1)[class_index])
    if values.size == 1:
        return float(values.reshape(-1)[0])
    raise RuntimeError(f"Unsupported SHAP expected value shape: {values.shape}")


@app.get("/")
def root():
    return {
        "message": "Welcome to MachineGuard ML API",
        "version": API_VERSION,
        "status": "running",
    }


@app.get(f"{API_PREFIX}/health")
def health_check() -> HealthResponse:
    model_status = {
        "random_forest": "random_forest" in MODELS,
        "isolation_forest": "isolation_forest" in MODELS,
    }
    all_models_loaded = all(model_status.values())
    return HealthResponse(
        status="healthy" if all_models_loaded else "unhealthy",
        application=API_TITLE,
        version=API_VERSION,
        models=model_status,
    )


@app.get(f"{API_PREFIX}/model-info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    random_forest = MODELS["random_forest"]
    isolation_forest = MODELS["isolation_forest"]

    return ModelInfoResponse(
        random_forest={
            "model_name": random_forest["model_name"],
            "threshold": random_forest["threshold"],
            "dataset": random_forest["dataset"],
            "feature_columns": random_forest["feature_columns"],
        },
        isolation_forest={
            "model_name": type(isolation_forest["model"]).__name__,
            "contamination": isolation_forest["contamination"],
            "features": isolation_forest["features"],
        },
        approved_input_features=FEATURE_COLUMNS,
    )


@app.post(f"{API_PREFIX}/predict", response_model=PredictionResponse)
def predict(machine_input: MachineInput) -> PredictionResponse:
    random_forest = MODELS["random_forest"]
    model = random_forest["model"]
    features = pd.DataFrame(
        [machine_input.model_dump(by_alias=True)],
        columns=FEATURE_COLUMNS,
    )
    class_index = list(model.classes_).index(1)
    failure_probability = float(model.predict_proba(features)[0, class_index])
    threshold = float(random_forest["threshold"])
    prediction = int(failure_probability >= threshold)

    return PredictionResponse(
        failure_probability=failure_probability,
        threshold=threshold,
        prediction=prediction,
        risk_level="high" if prediction else "low",
    )


@app.post(
    f"{API_PREFIX}/anomaly-detection",
    response_model=AnomalyResponse,
)
def detect_anomaly(machine_input: MachineInput) -> AnomalyResponse:
    isolation_forest = MODELS["isolation_forest"]
    feature_columns = isolation_forest["features"]
    features = pd.DataFrame(
        [machine_input.model_dump(by_alias=True)],
        columns=feature_columns,
    )
    transformed_features = isolation_forest["preprocessor"].transform(features)
    anomaly_prediction = int(
        isolation_forest["model"].predict(transformed_features)[0]
    )

    status_by_prediction = {-1: "anomalous", 1: "normal"}
    try:
        status = status_by_prediction[anomaly_prediction]
    except KeyError as error:
        raise ValueError(
            f"Unexpected Isolation Forest prediction: {anomaly_prediction}"
        ) from error

    return AnomalyResponse(
        anomaly_prediction=anomaly_prediction,
        status=status,
        contamination=float(isolation_forest["contamination"]),
    )


@app.post(f"{API_PREFIX}/explain", response_model=ExplanationResponse)
def explain(machine_input: MachineInput) -> ExplanationResponse:
    random_forest = MODELS["random_forest"]
    pipeline = random_forest["model"]
    feature_columns = random_forest["feature_columns"]
    features = pd.DataFrame(
        [machine_input.model_dump(by_alias=True)],
        columns=feature_columns,
    )
    preprocessor = pipeline.named_steps["preprocessor"]
    estimator = pipeline.named_steps["model"]
    transformed_features = preprocessor.transform(features)

    class_index = list(estimator.classes_).index(1)
    class_count = len(estimator.classes_)
    failure_probability = float(
        estimator.predict_proba(transformed_features)[0, class_index]
    )
    threshold = float(random_forest["threshold"])
    prediction = int(failure_probability >= threshold)

    explainer = _get_shap_explainer()
    shap_values = explainer.shap_values(transformed_features)
    class_values = _select_class_shap_values(
        shap_values,
        class_index,
        class_count,
        transformed_features.shape[1],
    )
    base_value = _select_class_base_value(
        explainer.expected_value,
        class_index,
        class_count,
    )

    transformed_names = preprocessor.get_feature_names_out()
    if len(transformed_names) != len(class_values):
        raise RuntimeError("SHAP values do not match transformed feature names.")

    contributions = dict.fromkeys(feature_columns, 0.0)
    for transformed_name, contribution in zip(transformed_names, class_values):
        feature_name = str(transformed_name).split("__", maxsplit=1)[-1]
        if feature_name.startswith("Type_"):
            original_name = "Type"
        elif feature_name in contributions:
            original_name = feature_name
        else:
            raise RuntimeError(
                f"Cannot map transformed feature to an input feature: "
                f"{transformed_name}"
            )
        contributions[original_name] += float(contribution)

    contribution_values = np.asarray(list(contributions.values()))
    if not np.isfinite(base_value) or not np.isfinite(failure_probability):
        raise RuntimeError("SHAP explanation contains a non-finite value.")
    if not np.all(np.isfinite(contribution_values)):
        raise RuntimeError("SHAP explanation contains a non-finite contribution.")
    if not np.isclose(
        base_value + contribution_values.sum(),
        failure_probability,
        atol=1e-6,
        rtol=1e-5,
    ):
        raise RuntimeError(
            "SHAP contributions do not add up to the failure probability."
        )

    return ExplanationResponse(
        failure_probability=failure_probability,
        threshold=threshold,
        prediction=prediction,
        base_value=base_value,
        feature_contributions=contributions,
    )
