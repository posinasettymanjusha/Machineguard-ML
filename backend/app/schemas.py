
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MachineInput(BaseModel):
    """Machine measurements using the original training-column names."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    machine_type: str = Field(alias="Type")
    air_temperature: float = Field(alias="Air temperature")
    process_temperature: float = Field(alias="Process temperature")
    rotational_speed: float = Field(alias="Rotational speed")
    torque: float = Field(alias="Torque")
    tool_wear: float = Field(alias="Tool wear")


class ModelLoadStatus(BaseModel):
    random_forest: bool
    isolation_forest: bool


class HealthResponse(BaseModel):
    status: Literal["healthy", "unhealthy"]
    application: str
    version: str
    models: ModelLoadStatus


class RandomForestInfo(BaseModel):
    model_name: str
    threshold: float
    dataset: str
    feature_columns: list[str]


class IsolationForestInfo(BaseModel):
    model_name: str
    contamination: float
    features: list[str]


class ModelInfoResponse(BaseModel):
    random_forest: RandomForestInfo
    isolation_forest: IsolationForestInfo
    approved_input_features: list[str]


class PredictionResponse(BaseModel):
    failure_probability: float
    threshold: float
    prediction: int
    risk_level: str


class ExplanationResponse(BaseModel):
    failure_probability: float
    threshold: float
    prediction: int
    base_value: float
    feature_contributions: dict[str, float]


class AnomalyResponse(BaseModel):
    anomaly_prediction: int
    status: Literal["anomalous", "normal"]
    contamination: float
