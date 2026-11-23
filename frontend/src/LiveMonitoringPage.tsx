
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CircleStop,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Zap,
} from "lucide-react";

import {
  detectAnomaly,
  predictFailure,
  startMonitoring as createMonitoringSession,
  saveMonitoringSnapshots,
  stopMonitoring as closeMonitoringSession,
  type MachineInput,
  type PredictionResponse,
  type AnomalyResponse,
  type MachineSnapshot,
} from "./api";

type MachineState = {
  id: string;
  name: string;
  input: MachineInput;
  prediction: PredictionResponse | null;
  anomaly: AnomalyResponse | null;
  updatedAt: string;
  error: string | null;
};

const INITIAL_MACHINES: MachineState[] = [
  {
    id: "MG-001",
    name: "CNC Milling Unit",
    input: {
      Type: "L",
      "Air temperature": 298.5,
      "Process temperature": 308.5,
      "Rotational speed": 1500,
      Torque: 40,
      "Tool wear": 80,
    },
    prediction: null,
    anomaly: null,
    updatedAt: "--",
    error: null,
  },
  {
    id: "MG-002",
    name: "Hydraulic Press",
    input: {
      Type: "M",
      "Air temperature": 300,
      "Process temperature": 310,
      "Rotational speed": 1400,
      Torque: 50,
      "Tool wear": 120,
    },
    prediction: null,
    anomaly: null,
    updatedAt: "--",
    error: null,
  },
  {
    id: "MG-003",
    name: "Industrial Lathe",
    input: {
      Type: "H",
      "Air temperature": 297.5,
      "Process temperature": 307.5,
      "Rotational speed": 1600,
      Torque: 35,
      "Tool wear": 60,
    },
    prediction: null,
    anomaly: null,
    updatedAt: "--",
    error: null,
  },
  {
    id: "MG-004",
    name: "Assembly Motor",
    input: {
      Type: "M",
      "Air temperature": 301,
      "Process temperature": 311,
      "Rotational speed": 1300,
      Torque: 55,
      "Tool wear": 180,
    },
    prediction: null,
    anomaly: null,
    updatedAt: "--",
    error: null,
  },
];

function vary(value: number, amount: number, min: number, max: number) {
  const next = value + (Math.random() - 0.5) * amount;
  return Math.min(max, Math.max(min, Number(next.toFixed(2))));
}

function nextReading(input: MachineInput): MachineInput {
  return {
    ...input,
    "Air temperature": vary(
      input["Air temperature"],
      1.2,
      295,
      305
    ),
    "Process temperature": vary(
      input["Process temperature"],
      1.2,
      305,
      315
    ),
    "Rotational speed": Math.round(
      vary(input["Rotational speed"], 100, 1100, 1900)
    ),
    Torque: vary(input.Torque, 5, 25, 75),
    "Tool wear": Math.min(
      250,
      input["Tool wear"] + Math.random() * 1.5
    ),
  };
}

function riskColor(risk: string) {
  return risk === "high"
    ? "text-red-400"
    : "text-emerald-400";
}

export default function LiveMonitoringPage() {
  const [machines, setMachines] = useState<MachineState[]>(
    INITIAL_MACHINES
  );
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("--");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(
    null
  );

  // Tracks whether monitoring is active independently of React state.
  const isActiveRef = useRef(false);

  // Prevents overlapping ML prediction cycles.
  const requestInProgressRef = useRef(false);

  // Stores the active PostgreSQL monitoring session.
  const sessionIdRef = useRef<number | null>(null);

  // Controls database snapshot frequency.
  const lastSnapshotAttemptRef = useRef(0);

  // Prevents overlapping database writes.
  const persistenceInProgressRef = useRef(false);

  const monitorMachines = useCallback(async () => {
    if (
      !isActiveRef.current ||
      requestInProgressRef.current
    ) {
      return;
    }

    requestInProgressRef.current = true;
    setLoading(true);

    try {
      const results = await Promise.all(
        machines.map(async (machine) => {
          const input = nextReading(machine.input);

          try {
            const [prediction, anomaly] = await Promise.all([
              predictFailure(input),
              detectAnomaly(input),
            ]);

            return {
              ...machine,
              input,
              prediction,
              anomaly,
              updatedAt: new Date().toLocaleTimeString(),
              error: null,
            };
          } catch (error) {
            return {
              ...machine,
              input,
              updatedAt: new Date().toLocaleTimeString(),
              error:
                error instanceof Error
                  ? error.message
                  : "Monitoring request failed",
            };
          }
        })
      );

      // Do not update or persist results after monitoring has stopped.
      if (!isActiveRef.current) return;

      setMachines(results);
      setCycle((previous) => previous + 1);
      setLastUpdated(new Date().toLocaleTimeString());

      // Persist only when every machine has a successful ML result.
      const sessionId = sessionIdRef.current;

      const now = Date.now();
      const oneMinute = 60 * 1000;

      const shouldPersist =
        sessionId !== null &&
        !persistenceInProgressRef.current &&
        now - lastSnapshotAttemptRef.current >= oneMinute;

      const allMachinesSuccessful = results.every(
        (machine) =>
          machine.prediction !== null &&
          machine.anomaly !== null &&
          machine.error === null
      );

      if (shouldPersist && allMachinesSuccessful) {
        const snapshots: MachineSnapshot[] = results.map((machine) => ({
          machine_id: machine.id,
          input: machine.input,
          prediction: machine.prediction!,
          anomaly: machine.anomaly!,
        }));

        persistenceInProgressRef.current = true;
        lastSnapshotAttemptRef.current = now;

        try {
          const response = await saveMonitoringSnapshots(
            sessionId,
            snapshots
          );

          setPersistenceError(null);

          console.info(
            "Monitoring snapshots saved:",
            response.saved_machines,
            "machines"
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Database snapshot could not be saved.";

          setPersistenceError(
            `Database persistence failed: ${message}`
          );

          console.error("Snapshot persistence failed:", error);
        } finally {
          persistenceInProgressRef.current = false;
        }
      }
    } finally {
      requestInProgressRef.current = false;
      setLoading(false);
    }
  }, [machines]);

  // Run ML monitoring every five seconds.
  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      void monitorMachines();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [running, monitorMachines]);

  // Start monitoring and create a PostgreSQL session.
  const handleStartMonitoring = async () => {
    if (running || starting) return;

    setStarting(true);
    setPersistenceError(null);

    sessionIdRef.current = null;
    lastSnapshotAttemptRef.current = 0;

    try {
      const registrations = INITIAL_MACHINES.map((machine) => ({
        machine_id: machine.id,
        machine_name: machine.name,
        machine_type: machine.input.Type as "L" | "M" | "H",
      }));

      try {
        const response = await createMonitoringSession(registrations);

        sessionIdRef.current = response.session_id;

        console.info(
          "Monitoring database session created:",
          response.session_id
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not create database session.";

        setPersistenceError(
          `Database session could not be created. ML monitoring will continue without saving: ${message}`
        );

        console.error("Session creation failed:", error);
      }

      isActiveRef.current = true;
      setRunning(true);

      // Start the first ML prediction cycle immediately.
      void monitorMachines();
    } finally {
      setStarting(false);
    }
  };

  // Stop ML monitoring and close the database session.
  const handleStopMonitoring = async () => {
    isActiveRef.current = false;
    setRunning(false);

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    if (sessionId !== null) {
      try {
        const response = await closeMonitoringSession(sessionId);

        console.info(
          "Monitoring database session stopped:",
          response.session_id
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not close the database session.";

        setPersistenceError(
          `Monitoring stopped locally, but the database session could not be closed: ${message}`
        );

        console.error("Session stop failed:", error);
      }
    }
  };

  const highRiskCount = machines.filter(
    (machine) => machine.prediction?.risk_level === "high"
  ).length;

  const anomalyCount = machines.filter(
    (machine) => machine.anomaly?.status === "anomalous"
  ).length;

  const averageRisk =
    machines.reduce(
      (total, machine) =>
        total + (machine.prediction?.failure_probability ?? 0),
      0
    ) / machines.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-400" />
            <h2 className="text-xl font-semibold text-white">
              Live Machine Monitoring
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Continuous predictive monitoring using your trained ML models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
            SIMULATED DATA
          </span>

          {!running ? (
            <button
              onClick={handleStartMonitoring}
              disabled={loading || starting}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Play size={16} />
              {starting ? "Starting..." : "Start monitoring"}
            </button>
          ) : (
            <button
              onClick={handleStopMonitoring}
              className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
            >
              <CircleStop size={16} />
              Stop monitoring
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Simulation environment
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Sensor readings are generated locally for demonstration.
              Predictions and anomaly classifications are returned by
              the connected MachineGuard ML backend. This is not a
              real factory sensor feed.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Machines monitored"
          value="4"
          icon={<Activity size={19} />}
        />
        <MetricCard
          label="High-risk machines"
          value={String(highRiskCount)}
          icon={<ShieldAlert size={19} />}
        />
        <MetricCard
          label="Anomalies detected"
          value={String(anomalyCount)}
          icon={<AlertTriangle size={19} />}
        />
        <MetricCard
          label="Average failure probability"
          value={`${(averageRisk * 100).toFixed(1)}%`}
          icon={<Zap size={19} />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              running
                ? "bg-emerald-400 animate-pulse"
                : "bg-slate-500"
            }`}
          />
          {running ? "Monitoring active" : "Monitoring stopped"}
          <span className="text-slate-500">· Cycle {cycle}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw size={13} />
          Last update: {lastUpdated}
        </div>
      </div>

      {persistenceError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-5 text-amber-300">
              {persistenceError}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {machines.map((machine) => (
          <div
            key={machine.id}
            className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {machine.id}
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {machine.name}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Machine type {machine.input.Type}
                </p>
              </div>

              {machine.prediction ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    machine.prediction.risk_level === "high"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {machine.prediction.risk_level.toUpperCase()} RISK
                </span>
              ) : (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                  Awaiting prediction
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SensorValue
                label="Air temperature"
                value={machine.input["Air temperature"].toFixed(1)}
                unit="K"
                icon={<Thermometer size={14} />}
              />
              <SensorValue
                label="Process temperature"
                value={machine.input["Process temperature"].toFixed(1)}
                unit="K"
                icon={<Thermometer size={14} />}
              />
              <SensorValue
                label="Rotational speed"
                value={String(machine.input["Rotational speed"])}
                unit="RPM"
                icon={<RefreshCw size={14} />}
              />
              <SensorValue
                label="Torque"
                value={machine.input.Torque.toFixed(1)}
                unit="Nm"
                icon={<Zap size={14} />}
              />
              <SensorValue
                label="Tool wear"
                value={machine.input["Tool wear"].toFixed(1)}
                unit="min"
                icon={<Activity size={14} />}
              />
              <SensorValue
                label="Failure probability"
                value={
                  machine.prediction
                    ? `${(
                        machine.prediction.failure_probability * 100
                      ).toFixed(1)}%`
                    : "--"
                }
                unit=""
                icon={<ShieldAlert size={14} />}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/70 pt-4">
              <div className="text-xs text-slate-400">
                Anomaly status:{" "}
                <span
                  className={
                    machine.anomaly?.status === "anomalous"
                      ? "font-semibold text-amber-400"
                      : "font-semibold text-emerald-400"
                  }
                >
                  {machine.anomaly?.status
                    ? machine.anomaly.status.toUpperCase()
                    : "--"}
                </span>
              </div>

              <span className="text-xs text-slate-500">
                Updated: {machine.updatedAt}
              </span>
            </div>

            {machine.error && (
              <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
                {machine.error}
              </p>
            )}

            {machine.prediction && (
              <p
                className={`mt-3 text-xs ${riskColor(
                  machine.prediction.risk_level
                )}`}
              >
                {machine.prediction.prediction === 1
                  ? "Failure predicted at the configured model threshold."
                  : "No failure predicted at the configured model threshold."}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Simulation interval: 5 seconds. Database snapshots: approximately
        every 60 seconds. Model outputs are predictions for the generated
        readings, not guarantees of future machine behavior.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SensorValue({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-800/70 p-3">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-slate-100">
        {value}
        <span className="ml-1 text-[10px] font-normal text-slate-500">
          {unit}
        </span>
      </p>
    </div>
  );
}
