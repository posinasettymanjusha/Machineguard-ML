from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.config import API_PREFIX
from backend.app.database import get_db
from backend.app.models import (
    AnomalyEvent,
    Machine,
    MonitoringSession,
    Prediction,
    SensorReading,
)
from backend.app.monitoring_schemas import (
    MonitoringStartRequest,
    MonitoringStartResponse,
    MonitoringStopResponse,
    SnapshotBatchRequest,
    SnapshotBatchResponse,
)

router = APIRouter(
    prefix=f"{API_PREFIX}/monitoring",
    tags=["Monitoring Persistence"],
)


@router.post(
    "/sessions",
    response_model=MonitoringStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_monitoring(
    request: MonitoringStartRequest,
    db: Session = Depends(get_db),
):
    machine_ids = [machine.machine_id for machine in request.machines]

    if len(machine_ids) != len(set(machine_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate machine IDs are not allowed.",
        )

    with db.begin():
        session = MonitoringSession()
        db.add(session)
        db.flush()

        for item in request.machines:
            machine = db.get(Machine, item.machine_id)

            if machine is None:
                db.add(
                    Machine(
                        machine_id=item.machine_id,
                        machine_name=item.machine_name,
                        machine_type=item.machine_type,
                    )
                )
            else:
                machine.machine_name = item.machine_name
                machine.machine_type = item.machine_type

        db.flush()
        session_id = session.id

    return MonitoringStartResponse(
        session_id=session_id,
        status="started",
    )


@router.post(
    "/sessions/{session_id}/snapshots",
    response_model=SnapshotBatchResponse,
)
def save_snapshot_batch(
    session_id: int,
    request: SnapshotBatchRequest,
    db: Session = Depends(get_db),
):
    machine_ids = [item.machine_id for item in request.machines]

    if len(machine_ids) != len(set(machine_ids)):
        raise HTTPException(
            status_code=400,
            detail="A machine can appear only once in a snapshot batch.",
        )

    with db.begin():
        monitoring_session = db.get(MonitoringSession, session_id)

        if monitoring_session is None:
            raise HTTPException(
                status_code=404,
                detail="Monitoring session not found.",
            )

        if monitoring_session.stopped_at is not None:
            raise HTTPException(
                status_code=409,
                detail="This monitoring session has already stopped.",
            )

        for item in request.machines:
            machine = db.get(Machine, item.machine_id)

            if machine is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Machine {item.machine_id} is not registered.",
                )

            input_data = item.input.model_dump(by_alias=True)

            reading = SensorReading(
                session_id=session_id,
                machine_id=item.machine_id,
                air_temperature=input_data["Air temperature"],
                process_temperature=input_data["Process temperature"],
                rotational_speed=input_data["Rotational speed"],
                torque=input_data["Torque"],
                tool_wear=input_data["Tool wear"],
                recorded_at=datetime.now(timezone.utc),
            )

            db.add(reading)
            db.flush()

            db.add(
                Prediction(
                    reading_id=reading.id,
                    failure_probability=item.prediction.failure_probability,
                    threshold=item.prediction.threshold,
                    prediction=item.prediction.prediction,
                    risk_level=item.prediction.risk_level,
                )
            )

            db.add(
                AnomalyEvent(
                    reading_id=reading.id,
                    anomaly_prediction=item.anomaly.anomaly_prediction,
                    status=item.anomaly.status,
                    contamination=item.anomaly.contamination,
                )
            )

    return SnapshotBatchResponse(
        session_id=session_id,
        saved_machines=len(request.machines),
        status="saved",
    )


@router.post(
    "/sessions/{session_id}/stop",
    response_model=MonitoringStopResponse,
)
def stop_monitoring(
    session_id: int,
    db: Session = Depends(get_db),
):
    with db.begin():
        session = db.get(MonitoringSession, session_id)

        if session is None:
            raise HTTPException(
                status_code=404,
                detail="Monitoring session not found.",
            )

        if session.stopped_at is not None:
            raise HTTPException(
                status_code=409,
                detail="This monitoring session has already stopped.",
            )

        session.stopped_at = datetime.now(timezone.utc)

    return MonitoringStopResponse(
        session_id=session_id,
        status="stopped",
    )
