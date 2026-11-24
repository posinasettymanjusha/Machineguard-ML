
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import API_PREFIX
from backend.app.database import get_db
from backend.app.models import (
    AnomalyEvent,
    Machine,
    Prediction,
    SensorReading,
)


router = APIRouter(
    prefix=f"{API_PREFIX}/machines",
    tags=["Machine Inventory"],
)


class MachineInventoryItem(BaseModel):
    machine_id: str
    machine_name: str
    machine_type: str

    air_temperature: float
    process_temperature: float
    rotational_speed: float
    torque: float
    tool_wear: float

    failure_probability: float | None
    threshold: float | None
    prediction: int | None
    risk_level: str | None

    anomaly_prediction: int | None
    anomaly_status: str | None

    recorded_at: datetime


class MachineInventoryResponse(BaseModel):
    total_machines: int
    machines: list[MachineInventoryItem]


@router.get(
    "",
    response_model=MachineInventoryResponse,
)
def get_machines(
    db: Session = Depends(get_db),
):
    # Find the latest sensor reading for each registered machine.
    latest_reading_id = (
        select(SensorReading.id)
        .where(
            SensorReading.machine_id == Machine.machine_id
        )
        .order_by(
            SensorReading.recorded_at.desc(),
            SensorReading.id.desc(),
        )
        .limit(1)
        .correlate(Machine)
        .scalar_subquery()
    )

    statement = (
        select(
            Machine,
            SensorReading,
            Prediction,
            AnomalyEvent,
        )
        .join(
            SensorReading,
            SensorReading.id == latest_reading_id,
        )
        .outerjoin(
            Prediction,
            Prediction.reading_id == SensorReading.id,
        )
        .outerjoin(
            AnomalyEvent,
            AnomalyEvent.reading_id == SensorReading.id,
        )
        .order_by(Machine.machine_id)
    )

    rows = db.execute(statement).all()

    machines = []

    for machine, reading, prediction, anomaly in rows:
        machines.append(
            MachineInventoryItem(
                machine_id=machine.machine_id,
                machine_name=machine.machine_name,
                machine_type=machine.machine_type,

                air_temperature=reading.air_temperature,
                process_temperature=reading.process_temperature,
                rotational_speed=reading.rotational_speed,
                torque=reading.torque,
                tool_wear=reading.tool_wear,

                failure_probability=(
                    prediction.failure_probability
                    if prediction else None
                ),
                threshold=(
                    prediction.threshold
                    if prediction else None
                ),
                prediction=(
                    prediction.prediction
                    if prediction else None
                ),
                risk_level=(
                    prediction.risk_level
                    if prediction else None
                ),

                anomaly_prediction=(
                    anomaly.anomaly_prediction
                    if anomaly else None
                ),
                anomaly_status=(
                    anomaly.status
                    if anomaly else None
                ),

                recorded_at=reading.recorded_at,
            )
        )

    return MachineInventoryResponse(
        total_machines=len(machines),
        machines=machines,
    )
