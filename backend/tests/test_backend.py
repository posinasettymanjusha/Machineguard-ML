import importlib

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.config import API_PREFIX, FEATURE_COLUMNS
from backend.app.model_loader import MODELS, load_models
from backend.app.schemas import MachineInput


client = TestClient(importlib.import_module("backend.app.main").app)


def _prediction_payload(machine_type="M", rotational_speed=1000):
    return {
        "Type": machine_type,
        "Air temperature": 300,
        "Process temperature": 310,
        "Rotational speed": rotational_speed,
        "Torque": 60,
        "Tool wear": 200,
    }


def _anomaly_payload(machine_type="L", torque=40, tool_wear=50):
    return {
        "Type": machine_type,
        "Air temperature": 295,
        "Process temperature": 305,
        "Rotational speed": 500,
        "Torque": torque,
        "Tool wear": tool_wear,
    }


def test_main_import_exposes_fastapi_app():
    main_module = importlib.import_module("backend.app.main")

    assert main_module.app.title == "MachineGuard ML API"


def test_actual_model_artifacts_load_with_expected_metadata():
    models = load_models()

    assert set(models) == {"random_forest", "isolation_forest"}
    assert models is MODELS or models.keys() == MODELS.keys()
    assert models["random_forest"]["threshold"] == pytest.approx(
        0.26666666666666666
    )
    assert models["isolation_forest"]["contamination"] == pytest.approx(0.03)
    assert models["random_forest"]["feature_columns"] == FEATURE_COLUMNS
    assert models["isolation_forest"]["features"] == FEATURE_COLUMNS


def test_machine_input_rejects_extra_fields_without_invented_ranges():
    measurements = {
        "Type": "M",
        "Air temperature": -100,
        "Process temperature": 0,
        "Rotational speed": 0,
        "Torque": 0,
        "Tool wear": 0,
    }

    assert MachineInput.model_validate(measurements).machine_type == "M"
    with pytest.raises(ValidationError):
        MachineInput.model_validate({**measurements, "TWF": 1})


def test_health_endpoint_reports_both_loaded_models():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["models"] == {
        "random_forest": True,
        "isolation_forest": True,
    }


def test_model_info_returns_artifact_metadata_and_approved_features():
    response = client.get("/api/v1/model-info")

    assert response.status_code == 200
    info = response.json()
    assert info["random_forest"]["threshold"] == pytest.approx(
        MODELS["random_forest"]["threshold"]
    )
    assert info["random_forest"]["dataset"] == MODELS["random_forest"]["dataset"]
    assert info["isolation_forest"]["contamination"] == pytest.approx(
        MODELS["isolation_forest"]["contamination"]
    )
    assert info["approved_input_features"] == FEATURE_COLUMNS
    assert info["random_forest"]["feature_columns"] == FEATURE_COLUMNS
    assert info["isolation_forest"]["features"] == FEATURE_COLUMNS


def test_predict_uses_actual_pipeline_and_returns_failure_probability():
    payload = _prediction_payload()
    response = client.post(f"{API_PREFIX}/predict", json=payload)

    assert response.status_code == 200
    result = response.json()
    model_data = pd.DataFrame([payload], columns=FEATURE_COLUMNS)
    model = MODELS["random_forest"]["model"]
    failure_class_index = list(model.classes_).index(1)
    expected_probability = model.predict_proba(model_data)[0][failure_class_index]

    assert result["failure_probability"] == pytest.approx(expected_probability)
    assert result["threshold"] == MODELS["random_forest"]["threshold"]
    assert result["prediction"] in (0, 1)
    assert result["risk_level"] in ("low", "high")


@pytest.mark.parametrize(
    ("machine_type", "expected_prediction", "expected_risk"),
    [
        ("H", 0, "low"),
        ("M", 1, "high"),
    ],
)
def test_predict_applies_saved_threshold(
    machine_type,
    expected_prediction,
    expected_risk,
):
    response = client.post(
        f"{API_PREFIX}/predict",
        json=_prediction_payload(machine_type=machine_type),
    )

    assert response.status_code == 200
    result = response.json()
    assert result["threshold"] == MODELS["random_forest"]["threshold"]
    assert result["prediction"] == expected_prediction
    assert result["risk_level"] == expected_risk
    assert (result["failure_probability"] >= result["threshold"]) == bool(
        expected_prediction
    )


@pytest.mark.parametrize(
    "payload",
    [
        {
            "Type": "M",
            "Air temperature": 300,
            "Process temperature": 310,
            "Rotational speed": 1000,
            "Torque": 60,
        },
        {
            **_prediction_payload(),
            "TWF": 0,
        },
        {
            **_prediction_payload(),
            "Type": "M",
            "Air temperature": "not-a-number",
        },
    ],
)
def test_predict_rejects_invalid_input_with_422(payload):
    response = client.post(f"{API_PREFIX}/predict", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("payload", "expected_prediction", "expected_status"),
    [
        (_anomaly_payload(), 1, "normal"),
        (_anomaly_payload(torque=5, tool_wear=0), -1, "anomalous"),
    ],
)
def test_anomaly_detection_uses_real_artifact_and_returns_values(
    payload,
    expected_prediction,
    expected_status,
):
    response = client.post(f"{API_PREFIX}/anomaly-detection", json=payload)

    assert response.status_code == 200
    result = response.json()

    artifact = MODELS["isolation_forest"]
    features = pd.DataFrame([payload], columns=artifact["features"])
    transformed_features = artifact["preprocessor"].transform(features)
    actual_prediction = int(artifact["model"].predict(transformed_features)[0])

    assert actual_prediction == expected_prediction
    assert result == {
        "anomaly_prediction": actual_prediction,
        "status": expected_status,
        "contamination": artifact["contamination"],
    }


@pytest.mark.parametrize(
    "payload",
    [
        {
            "Type": "L",
            "Air temperature": 295,
            "Process temperature": 305,
            "Rotational speed": 500,
            "Torque": 40,
        },
        {
            **_anomaly_payload(),
            "RNF": 0,
        },
        {
            **_anomaly_payload(),
            "Torque": "not-a-number",
        },
    ],
)
def test_anomaly_detection_rejects_invalid_input_with_422(payload):
    response = client.post(f"{API_PREFIX}/anomaly-detection", json=payload)

    assert response.status_code == 422


def test_explain_returns_real_finite_class_one_shap_values():
    payload = _prediction_payload()
    response = client.post(f"{API_PREFIX}/explain", json=payload)

    assert response.status_code == 200
    result = response.json()
    random_forest = MODELS["random_forest"]
    pipeline = random_forest["model"]
    model_data = pd.DataFrame(
        [payload],
        columns=random_forest["feature_columns"],
    )
    transformed = pipeline.named_steps["preprocessor"].transform(model_data)
    estimator = pipeline.named_steps["model"]
    failure_class_index = list(estimator.classes_).index(1)
    expected_probability = estimator.predict_proba(transformed)[0][
        failure_class_index
    ]
    from backend.app.main import _get_shap_explainer

    explainer = _get_shap_explainer()
    shap_values = np.asarray(explainer.shap_values(transformed))
    transformed_names = pipeline.named_steps["preprocessor"].get_feature_names_out()
    expected_type_contribution = sum(
        shap_values[0, index, failure_class_index]
        for index, name in enumerate(transformed_names)
        if str(name).split("__", maxsplit=1)[-1].startswith("Type_")
    )

    assert set(result) == {
        "failure_probability",
        "threshold",
        "prediction",
        "base_value",
        "feature_contributions",
    }
    assert result["failure_probability"] == pytest.approx(expected_probability)
    assert result["threshold"] == random_forest["threshold"]
    assert result["prediction"] == int(
        expected_probability >= random_forest["threshold"]
    )
    assert set(result["feature_contributions"]) == set(FEATURE_COLUMNS)
    assert all(
        np.isfinite(value)
        for value in [
            result["base_value"],
            *result["feature_contributions"].values(),
        ]
    )
    assert result["feature_contributions"]["Type"] == pytest.approx(
        expected_type_contribution
    )
    assert any(value > 0 for value in result["feature_contributions"].values())
    assert any(value < 0 for value in result["feature_contributions"].values())
    assert result["base_value"] + sum(
        result["feature_contributions"].values()
    ) == pytest.approx(result["failure_probability"], abs=1e-6)


@pytest.mark.parametrize(
    "payload",
    [
        {
            "Type": "M",
            "Air temperature": 300,
            "Process temperature": 310,
            "Rotational speed": 1000,
            "Torque": 60,
        },
        {
            **_prediction_payload(),
            "OSF": 0,
        },
        {
            **_prediction_payload(),
            "Air temperature": "not-a-number",
        },
    ],
)
def test_explain_rejects_invalid_input_with_422(payload):
    response = client.post(f"{API_PREFIX}/explain", json=payload)

    assert response.status_code == 422
