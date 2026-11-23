from pydantic import BaseModel, Field

from backend.app.schemas import (
    AnomalyResponse,
    MachineInput,
    PredictionResponse,
)


class MachineRegistration(BaseModel):
    machine_id: str = Field(min_length=1, max_length=30)
    machine_name: str = Field(min_length=1, max_length=100)
    machine_type: str = Field(pattern="^[LMH]$")


class MonitoringStartRequest(BaseModel):
    machines: list[MachineRegistration] = Field(min_length=1, max_length=25)


class MonitoringStartResponse(BaseModel):
    session_id: int
    status: str


class MachineSnapshot(BaseModel):
    machine_id: str = Field(min_length=1, max_length=30)
    input: MachineInput
    prediction: PredictionResponse
    anomaly: AnomalyResponse


class SnapshotBatchRequest(BaseModel):
    machines: list[MachineSnapshot] = Field(min_length=1, max_length=25)


class SnapshotBatchResponse(BaseModel):
    session_id: int
    saved_machines: int
    status: str


class MonitoringStopResponse(BaseModel):
    session_id: int
    status: str
