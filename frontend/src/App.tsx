import LiveMonitoringPage from "./LiveMonitoringPage";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Factory,
  Filter,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Zap,
  RotateCcw,
  Gauge,
  Cpu,
  Target,
  BarChart3,
  Database,
  Info,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  getHealth,
  getModelInfo,
  predictFailure,
  detectAnomaly,
  explainPrediction,
  getMachines,
  type HealthResponse,
  type ExplanationResponse,
  type ModelInfoResponse,
  type PredictionResponse,
  type AnomalyResponse,
  type MachineInput,
} from "./api";

/* -------------------- API configuration -------------------- */





/* -------------------- Navigation -------------------- */

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Machines", icon: Factory },
  { name: "Predictions", icon: Activity },
  { name: "Explainable AI", icon: BrainCircuit },
  { name: "Anomalies", icon: AlertTriangle },
  { name: "Live Monitoring", icon: Activity },
  { name: "Model Performance", icon: Settings },
];

/* -------------------- Dashboard data -------------------- */

const metrics = [
  {
    title: "Machines monitored",
    icon: Factory,
    tone: "violet",
  },
  {
    title: "Operational",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    title: "At risk",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    title: "Critical",
    icon: Zap,
    tone: "red",
  },
];

/* -------------------- Shared components -------------------- */

function PageHeading({
  section,
  title,
  description,
  badgeText = "Development preview · Offline evaluation",
}: {
  section: string;
  title: string;
  description: string;
  badgeText?: string;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[1.5px] text-slate-500">
          Workspace <ChevronRight size={12} /> {section}
        </div>
        <h2 className="text-[27px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
      <span className="rounded-lg border border-slate-700 bg-[#111c2d] px-4 py-3 text-xs text-slate-400">
        {badgeText}
      </span>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Operational"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "At Risk"
        ? "bg-amber-500/10 text-amber-400"
        : "bg-rose-500/10 text-rose-400";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${styles}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  color = "text-white",
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  color?: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-slate-400">{label}</p>
        {Icon && <Icon size={17} className="text-slate-500" />}
      </div>
      <p className={`mt-5 text-3xl font-semibold ${color}`}>{value}</p>
      <p className="mt-2 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}

/* -------------------- Machines page -------------------- */


function MachinesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [machines, setMachines] = useState<
    Awaited<ReturnType<typeof getMachines>>["machines"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadMachines() {
      setLoading(true);
      setError("");

      try {
        const response = await getMachines();

        if (active) {
          setMachines(response.machines);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load machine inventory."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMachines();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const getMachineStatus = (prediction: number | null, riskLevel: string | null) => {
    if (prediction === 1) return "Critical";
    if (prediction === 0) {
      const level = riskLevel?.toLowerCase();
      return level === "medium" || level === "moderate" || level === "high"
        ? "At Risk"
        : "Operational";
    }
    return "Unknown";
  };

  const enrichedMachines = machines.map((machine) => ({
    ...machine,
    status: getMachineStatus(
      machine.prediction,
      machine.risk_level
    ),
  }));

  const filteredMachines = enrichedMachines.filter((machine) => {
    const matchesSearch =
      machine.machine_name.toLowerCase().includes(search.toLowerCase()) ||
      machine.machine_id.toLowerCase().includes(search.toLowerCase());

    return (
      matchesSearch &&
      (statusFilter === "All" || machine.status === statusFilter)
    );
  });

  const operational = enrichedMachines.filter(
    (machine) => machine.status === "Operational"
  ).length;

  const atRisk = enrichedMachines.filter(
    (machine) => machine.status === "At Risk"
  ).length;

  const critical = enrichedMachines.filter(
    (machine) => machine.status === "Critical"
  ).length;

  const unknown = enrichedMachines.filter(
    (machine) => machine.status === "Unknown"
  ).length;

  return (
    <div className="space-y-9">
      <PageHeading
        section="Machines"
        title="Machine monitoring"
        description="Live equipment inventory and machine health from the PostgreSQL database."
        badgeText="Live database inventory"
      />

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-rose-400">
              Unable to load machine inventory
            </p>
            <p className="mt-1 text-xs text-slate-400">{error}</p>
          </div>
          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total machines", value: machines.length, color: "text-white" },
          { label: "Operational", value: operational, color: "text-emerald-400" },
          { label: "At risk", value: atRisk, color: "text-amber-400" },
          { label: "Critical", value: critical, color: "text-rose-400" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-800 bg-[#111c2d] p-6"
          >
            <p className="text-[13px] text-slate-400">{item.label}</p>
            <p className={`mt-5 text-3xl font-semibold ${item.color}`}>
              {item.value.toString().padStart(2, "0")}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Equipment inventory
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              Database records with their latest available sensor readings.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0c1524] px-3 py-2.5 sm:min-w-[260px]">
              <Search size={16} className="shrink-0 text-slate-500" />
              <input
                aria-label="Search machines"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search machine or ID..."
                className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0c1524] px-3 py-2.5">
              <Filter size={15} className="text-slate-500" />
              <select
                aria-label="Filter machines by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-transparent text-xs text-slate-300 outline-none"
              >
                <option className="bg-[#111c2d]" value="All">All statuses</option>
                <option className="bg-[#111c2d]" value="Operational">Operational</option>
                <option className="bg-[#111c2d]" value="At Risk">At Risk</option>
                <option className="bg-[#111c2d]" value="Critical">Critical</option>
                <option className="bg-[#111c2d]" value="Unknown">Unknown</option>
              </select>
            </div>

            <button
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[1050px] table-fixed border-collapse text-left">
            <thead>
              <tr className="bg-[#0e1929] text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4 font-medium">Machine</th>
                <th className="px-5 py-4 font-medium">Type</th>
                <th className="px-5 py-4 font-medium">Air temp.</th>
                <th className="px-5 py-4 font-medium">Process temp.</th>
                <th className="px-5 py-4 font-medium">Speed</th>
                <th className="px-5 py-4 font-medium">Torque</th>
                <th className="px-5 py-4 font-medium">Tool wear</th>
                <th className="px-5 py-4 font-medium">Failure risk</th>
                <th className="px-5 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">
                    Loading machine records from database...
                  </td>
                </tr>
              ) : filteredMachines.length > 0 ? (
                filteredMachines.map((machine) => (
                  <tr
                    key={machine.machine_id}
                    className="border-t border-slate-800/80 transition-colors hover:bg-slate-800/20"
                  >
                    <td className="px-5 py-5">
                      <p className="text-[13px] font-medium text-slate-200">
                        {machine.machine_name}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {machine.machine_id}
                      </p>
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-400">
                      Type {machine.machine_type}
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.air_temperature.toFixed(2)} °C
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.process_temperature.toFixed(2)} °C
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.rotational_speed.toLocaleString()} RPM
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.torque.toFixed(2)}
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.tool_wear.toFixed(2)}
                    </td>
                    <td className="px-5 py-5 text-xs text-slate-300">
                      {machine.failure_probability === null
                        ? "N/A"
                        : `${(machine.failure_probability * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-5 py-5">
                      {machine.status === "Unknown" ? (
                        <span className="rounded-md bg-slate-700/40 px-2.5 py-1.5 text-[11px] text-slate-400">
                          No prediction
                        </span>
                      ) : (
                        <StatusBadge status={machine.status} />
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-sm text-slate-400">No machines found.</p>
                    <p className="mt-2 text-xs text-slate-600">
                      Try another search or status filter.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="text-[11px] text-slate-500">
            Showing {filteredMachines.length} of {machines.length} database machines
            {unknown > 0 ? ` · ${unknown} without predictions` : ""}
          </p>
        </div>
      </section>
    </div>
  );
}


/* -------------------- Prediction form types -------------------- */

type PredictionForm = {
  type: string;
  airTemperature: string;
  processTemperature: string;
  rotationalSpeed: string;
  torque: string;
  toolWear: string;
};

const initialPredictionForm: PredictionForm = {
  type: "M",
  airTemperature: "300",
  processTemperature: "310",
  rotationalSpeed: "1500",
  torque: "40",
  toolWear: "100",
};

function PredictionInput({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  description,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max?: number;
  step?: string;
  description: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-300">{label}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        required
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-[#0c1524] px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-violet-400"
      />
      <span className="mt-2 block text-[11px] text-slate-500">
        {description}
      </span>
    </label>
  );
}

/* -------------------- Predictions page -------------------- */

function PredictionsPage({
  onExplanation,
  apiHealthy,
}: {
  onExplanation: (value: ExplanationResponse | null) => void;
  apiHealthy: boolean;
}) {
  const [form, setForm] = useState<PredictionForm>(initialPredictionForm);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [message, setMessage] = useState("");
  const [anomalyError, setAnomalyError] = useState("");
  const [explanationError, setExplanationError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getModelInfo()
      .then(setModelInfo)
      .catch(() => setModelInfo(null));
  }, []);

  const updateField = (field: keyof PredictionForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setMessage("");
    setAnomalyError("");
    setExplanationError("");
    setPrediction(null);
    setAnomaly(null);
    onExplanation(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!apiHealthy) {
      setMessage("The backend API or required models are not available.");
      return;
    }

    const numericValues = [
      form.airTemperature,
      form.processTemperature,
      form.rotationalSpeed,
      form.torque,
      form.toolWear,
    ].map(Number);

    if (
      numericValues.some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      setMessage("Enter valid, non-negative numeric values in every field.");
      return;
    }

    if (!form.type) {
      setMessage("Select a machine type before continuing.");
      return;
    }

    const input: MachineInput = {
      Type: form.type,
      "Air temperature": Number(form.airTemperature),
      "Process temperature": Number(form.processTemperature),
      "Rotational speed": Number(form.rotationalSpeed),
      Torque: Number(form.torque),
      "Tool wear": Number(form.toolWear),
    };

    setLoading(true);
    setMessage("");
    setAnomalyError("");
    setExplanationError("");
    setPrediction(null);
    setAnomaly(null);
    onExplanation(null);

    const [predictionResult, anomalyResult, explanationResult] =
      await Promise.allSettled([
        predictFailure(input),
        detectAnomaly(input),
        explainPrediction(input),
      ]);

    if (predictionResult.status === "fulfilled") {
      setPrediction(predictionResult.value);
    } else {
      setMessage(
        predictionResult.reason instanceof Error
          ? predictionResult.reason.message
          : "Failure prediction failed."
      );
    }

    if (anomalyResult.status === "fulfilled") {
      setAnomaly(anomalyResult.value);
    } else {
      setAnomalyError(
        anomalyResult.reason instanceof Error
          ? anomalyResult.reason.message
          : "Anomaly detection failed."
      );
    }

    if (explanationResult.status === "fulfilled") {
      onExplanation(explanationResult.value);
    } else {
      setExplanationError(
        explanationResult.reason instanceof Error
          ? explanationResult.reason.message
          : "SHAP explanation failed."
      );
    }

    setLoading(false);
  };

  const resetForm = () => {
    setForm(initialPredictionForm);
    setPrediction(null);
    setAnomaly(null);
    setMessage("");
    setAnomalyError("");
    setExplanationError("");
    onExplanation(null);
  };

  const probability = prediction
    ? (prediction.failure_probability * 100).toFixed(2)
    : null;

  const riskColor =
    prediction?.risk_level.toLowerCase() === "high"
      ? "text-rose-400"
      : prediction?.risk_level.toLowerCase() === "medium"
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="space-y-9">
      <PageHeading
        section="Predictions"
        title="Failure risk prediction"
        description="Enter machine operating conditions to generate a failure-risk assessment."
      />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <BrainCircuit size={21} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              {modelInfo?.random_forest.model_name || "Random Forest failure classifier"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Trained model · Decision threshold{" "}
              {modelInfo?.random_forest.threshold.toFixed(4) || "0.2667"}
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            apiHealthy
              ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
              : "border-amber-400/20 bg-amber-400/5 text-amber-300"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {apiHealthy ? "API connected" : "API unavailable"}
        </span>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8"
        >
          <div className="mb-7">
            <div className="flex items-center gap-2">
              <Gauge size={18} className="text-violet-300" />
              <h3 className="text-sm font-semibold text-slate-100">
                Machine operating parameters
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Provide the six input features used by the trained model.
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-2 block text-[13px] font-medium text-slate-300">
              Machine type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["L", "M", "H"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateField("type", type)}
                  aria-pressed={form.type === type}
                  className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                    form.type === type
                      ? "border-violet-400 bg-violet-500/10 text-violet-300"
                      : "border-slate-700 bg-[#0c1524] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <span className="block text-lg font-semibold">{type}</span>
                  <span className="mt-1 block text-[11px]">
                    {type === "L" ? "Low" : type === "M" ? "Medium" : "High"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Activity size={16} className="text-violet-300" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Temperature readings
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <PredictionInput
                label="Air temperature"
                unit="Kelvin (K)"
                value={form.airTemperature}
                onChange={(value) => updateField("airTemperature", value)}
                min={0}
                description="Ambient air temperature around the machine."
              />
              <PredictionInput
                label="Process temperature"
                unit="Kelvin (K)"
                value={form.processTemperature}
                onChange={(value) => updateField("processTemperature", value)}
                min={0}
                description="Operating process temperature."
              />
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Cpu size={16} className="text-violet-300" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Mechanical readings
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <PredictionInput
                label="Rotational speed"
                unit="RPM"
                value={form.rotationalSpeed}
                onChange={(value) => updateField("rotationalSpeed", value)}
                min={0}
                description="Machine rotational speed."
              />
              <PredictionInput
                label="Torque"
                unit="Newton metres (Nm)"
                value={form.torque}
                onChange={(value) => updateField("torque", value)}
                min={0}
                description="Mechanical torque applied to the tool."
              />
              <PredictionInput
                label="Tool wear"
                unit="Minutes"
                value={form.toolWear}
                onChange={(value) => updateField("toolWear", value)}
                min={0}
                description="Accumulated tool operating time."
              />
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
            <button
              type="submit"
              disabled={loading || !apiHealthy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Activity size={15} />
              {loading ? "Analyzing..." : "Run prediction"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {!apiHealthy && (
            <p className="mt-4 text-xs text-amber-300">
              Start the FastAPI backend and wait for the API connection before running a prediction.
            </p>
          )}

          {message && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-rose-400/20 bg-rose-500/5 p-4"
            >
              <p className="text-xs leading-6 text-rose-300">{message}</p>
            </div>
          )}
        </form>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-violet-300" />
              <h3 className="text-sm font-semibold text-slate-100">
                Prediction result
              </h3>
            </div>

            {prediction ? (
              <div className="mt-6">
                <div className="rounded-lg border border-slate-700 bg-[#0c1524] p-5">
                  <p className="text-xs text-slate-500">Failure probability</p>
                  <p className="mt-3 text-4xl font-semibold text-white">
                    {probability}%
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{
                        width: `${Math.min(prediction.failure_probability * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">
                    Model probability for the failure class
                  </p>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-500">Prediction</span>
                    <span className={`text-xs font-semibold ${prediction.prediction === 1 ? "text-rose-400" : "text-emerald-400"}`}>
                      {prediction.prediction === 1 ? "Failure predicted" : "No failure predicted"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-500">Risk level</span>
                    <span className={`text-xs font-semibold uppercase ${riskColor}`}>
                      {prediction.risk_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Decision threshold</span>
                    <span className="text-xs text-slate-300">
                      {prediction.threshold.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-lg border border-dashed border-slate-700 bg-[#0c1524] px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                  <BrainCircuit size={23} />
                </div>
                <p className="mt-5 text-sm font-medium text-slate-300">
                  {loading ? "Analyzing machine data..." : "Awaiting model response"}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Run a prediction to see failure probability, prediction class and risk level.
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-slate-800 pt-5">
              <p className="text-xs font-semibold text-slate-300">
                Anomaly detection
              </p>
              {anomaly ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Isolation Forest result</span>
                  <span className={`text-xs font-semibold ${anomaly.status === "anomalous" ? "text-amber-400" : "text-emerald-400"}`}>
                    {anomaly.status === "anomalous" ? "Anomalous" : "Normal pattern"}
                  </span>
                </div>
              ) : anomalyError ? (
                <p className="mt-3 text-xs text-rose-400">{anomalyError}</p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Anomaly result will appear after analysis.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
            <h3 className="text-sm font-semibold text-slate-200">
              Model information
            </h3>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] text-slate-500">Algorithm</p>
                <p className="mt-1 text-xs font-medium text-slate-300">
                  {modelInfo?.random_forest.model_name || "Random Forest Classifier"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Input features</p>
                <p className="mt-1 text-xs font-medium text-slate-300">
                  {modelInfo?.approved_input_features.length || 6} approved features
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Training dataset</p>
                <p className="mt-1 text-xs font-medium text-slate-300">
                  {modelInfo?.random_forest.dataset || "UCI AI4I 2020 Predictive Maintenance"}
                </p>
              </div>
            </div>
          </section>

          {explanationError && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-300">
              SHAP explanation: {explanationError}
            </p>
          )}
        </aside>
      </div>

      <p className="text-[11px] leading-5 text-slate-500">
        Predictions use the trained model and its saved decision threshold. This project uses the synthetic UCI AI4I 2020 dataset; results are not validated real-factory predictions.
      </p>
    </div>
  );
}

/* -------------------- Explainable AI page -------------------- */

const shapImportance = [
  { feature: "Torque", value: 0.1616, category: "Mechanical" },
  { feature: "Rotational speed", value: 0.1375, category: "Mechanical" },
  { feature: "Tool wear", value: 0.0952, category: "Mechanical" },
  { feature: "Air temperature", value: 0.0733, category: "Temperature" },
  { feature: "Process temperature", value: 0.0406, category: "Temperature" },
  { feature: "Type L", value: 0.0120, category: "Machine type" },
  { feature: "Type M", value: 0.0049, category: "Machine type" },
  { feature: "Type H", value: 0.0026, category: "Machine type" },
];

function ExplainableAIPage({
  explanation,
}: {
  explanation: ExplanationResponse | null;
}) {
  const individualFeatures = explanation
    ? Object.entries(explanation.feature_contributions).sort(
        (a, b) => Math.abs(b[1]) - Math.abs(a[1])
      )
    : [];

  return (
    <div className="space-y-9">
      <PageHeading
        section="Explainable AI"
        title="Model explainability"
        description="Understand which machine operating features influence the Random Forest failure classifier."
      />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <BrainCircuit size={21} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              SHAP explainability engine
            </p>
            <p className="mt-1 text-xs text-slate-500">
              TreeExplainer · Random Forest · Failure class
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 size={14} />
          SHAP backend connected
        </span>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricCard label="Explained samples" value="300" note="Random sample · Seed 42" />
        <MetricCard label="Transformed features" value="08" note="Five numerical + three encoded" />
        <MetricCard label="Explainer algorithm" value="TreeSHAP" note="Random Forest model" />
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Global feature importance
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Mean absolute SHAP values calculated from 300 sampled records.
            </p>
          </div>
          <span className="rounded-md border border-slate-700 bg-[#0c1524] px-3 py-2 text-[11px] text-slate-400">
            Phase 3 results
          </span>
        </div>

        <div className="mt-8 h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={shapImportance}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
            >
              <CartesianGrid stroke="#263449" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 0.18]}
              />
              <YAxis
                type="category"
                dataKey="feature"
                width={145}
                stroke="#64748b"
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
                contentStyle={{
                  backgroundColor: "#111c2d",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
                formatter={(value) => [Number(value).toFixed(4), "Mean |SHAP value|"]}
              />
              <Bar dataKey="value" fill="#9b87f5" radius={[0, 4, 4, 0]} barSize={19} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-5">
          <p className="text-xs leading-6 text-slate-400">
            Higher mean absolute SHAP values indicate a greater average contribution to the model's output. These values describe model behavior, not physical causation.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
        <h3 className="text-sm font-semibold text-slate-100">
          Feature importance breakdown
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Actual global SHAP values from the trained model.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-4 pr-4 font-medium">Feature</th>
                <th className="py-4 pr-4 font-medium">Category</th>
                <th className="py-4 text-right font-medium">Mean |SHAP|</th>
              </tr>
            </thead>
            <tbody>
              {shapImportance.map((item) => (
                <tr key={item.feature} className="border-b border-slate-800/70 last:border-0">
                  <td className="py-4 pr-4 text-xs font-medium text-slate-200">{item.feature}</td>
                  <td className="py-4 pr-4 text-xs text-slate-400">{item.category}</td>
                  <td className="py-4 text-right font-mono text-xs text-violet-300">{item.value.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-violet-300" />
            <h3 className="text-sm font-semibold text-slate-100">
              How to interpret SHAP
            </h3>
          </div>
          <div className="mt-5 space-y-4 text-xs leading-6 text-slate-400">
            <p>SHAP values explain how individual features move a model prediction away from its baseline output.</p>
            <p><span className="font-semibold text-rose-400">Positive contribution:</span> Pushes the model output toward a higher failure probability.</p>
            <p><span className="font-semibold text-emerald-400">Negative contribution:</span> Pushes the model output toward a lower failure probability.</p>
            <p>The magnitude indicates the strength of a feature's contribution for an individual prediction.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-violet-300" />
            <h3 className="text-sm font-semibold text-slate-100">
              Individual prediction explanation
            </h3>
          </div>

          {explanation ? (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-4">
                  <p className="text-[11px] text-slate-500">Failure probability</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {(explanation.failure_probability * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-4">
                  <p className="text-[11px] text-slate-500">Baseline value</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {explanation.base_value.toFixed(4)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-4 text-xs font-semibold text-slate-300">
                  Feature contributions
                </p>
                <div className="space-y-4">
                  {individualFeatures.map(([feature, value]) => {
                    const positive = value > 0;
                    const width = Math.min(Math.abs(value) / 0.25 * 100, 100);

                    return (
                      <div key={feature}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-400">{feature}</span>
                          <span className={`font-mono text-xs ${positive ? "text-rose-400" : "text-emerald-400"}`}>
                            {value > 0 ? "+" : ""}{value.toFixed(4)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${positive ? "bg-rose-400" : "bg-emerald-400"}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                Positive contributions increase the model output; negative contributions decrease it. These explain model behavior, not physical causation.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-700 bg-[#0c1524] p-6 text-center">
              <BrainCircuit size={25} className="mx-auto text-slate-500" />
              <p className="mt-4 text-sm font-medium text-slate-300">
                Awaiting prediction data
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                Run a prediction on the Predictions page. Individual feature contributions will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="text-[11px] leading-5 text-slate-500">
        Analysis based on the UCI AI4I 2020 synthetic predictive maintenance dataset. SHAP explains model behavior and does not establish real-world physical causation.
      </p>
    </div>
  );
}

/* -------------------- Anomalies page -------------------- */

const anomalyDistribution = [
  { name: "Flagged anomalies", value: 60 },
  { name: "Normal patterns", value: 1940 },
];

function AnomaliesPage() {
  return (
    <div className="space-y-9">
      <PageHeading
        section="Anomalies"
        title="Anomaly monitoring"
        description="Review unusual machine operating patterns identified by the Isolation Forest model."
      />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
            <AlertTriangle size={21} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              Isolation Forest anomaly detector
            </p>
            <p className="mt-1 text-xs text-slate-500">
              200 estimators · Contamination configured at 3%
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 size={14} />
          Offline evaluation available
        </span>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Test records" value="2,000" note="Held-out test dataset" icon={Database} />
        <MetricCard label="Flagged anomalies" value="60" note="3% of test records" color="text-amber-400" icon={AlertTriangle} />
        <MetricCard label="Normal patterns" value="1,940" note="97% of test records" color="text-emerald-400" icon={CheckCircle2} />
        <MetricCard label="Contamination" value="3%" note="Configured model parameter" color="text-violet-300" icon={Gauge} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
          <h3 className="text-sm font-semibold text-slate-100">Test-set anomaly distribution</h3>
          <p className="mt-2 text-xs text-slate-500">Isolation Forest predictions across 2,000 held-out records.</p>
          <div className="mt-6 h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={anomalyDistribution} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={72} outerRadius={105} paddingAngle={3} stroke="none">
                  <Cell fill="#f59e0b" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#111c2d", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
                <Legend verticalAlign="bottom" formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-8 border-t border-slate-800 pt-5">
            <div><p className="text-[11px] text-slate-500">Flagged</p><p className="mt-1 text-xl font-semibold text-amber-400">60</p></div>
            <div><p className="text-[11px] text-slate-500">Normal</p><p className="mt-1 text-xl font-semibold text-slate-200">1,940</p></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
          <h3 className="text-sm font-semibold text-slate-100">Model configuration</h3>
          <p className="mt-2 text-xs text-slate-500">Isolation Forest training configuration.</p>
          <div className="mt-7 space-y-5">
            {[
              { label: "Algorithm", value: "Isolation Forest" },
              { label: "Number of estimators", value: "200" },
              { label: "Contamination", value: "0.03" },
              { label: "Random state", value: "42" },
              { label: "Evaluation records", value: "2,000" },
              { label: "Flagged records", value: "60" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 last:border-0">
                <span className="text-xs text-slate-500">{item.label}</span>
                <span className="text-xs font-medium text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
        <div className="flex items-center gap-2">
          <Info size={17} className="text-violet-300" />
          <h3 className="text-sm font-semibold text-slate-100">Understanding anomaly detection</h3>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-amber-300">What this model detects</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">
              Isolation Forest identifies operating records that differ from common patterns. An anomaly is an unusual observation, not automatically a machine failure.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-slate-300">Evaluation limitation</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">
              In the retrospective test comparison, 9 of 68 actual failure records were flagged as anomalies. The detector is not a replacement for the supervised failure classifier.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-5">
        <div className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Offline results · Not live monitoring</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              These values come from the Phase 3 held-out test evaluation. No live sensor feed or real-time anomaly events are connected.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------- Model Performance page -------------------- */

const performanceMetrics = [
  { label: "Precision", value: "72.73%", description: "Correct positive predictions among predicted failures.", color: "text-violet-300" },
  { label: "Recall", value: "70.59%", description: "Actual failures correctly identified.", color: "text-emerald-400" },
  { label: "F1-score", value: "71.64%", description: "Harmonic mean of precision and recall.", color: "text-sky-300" },
  { label: "PR-AUC", value: "77.68%", description: "Precision-recall curve area.", color: "text-amber-300" },
  { label: "ROC-AUC", value: "96.34%", description: "ROC curve area.", color: "text-emerald-300" },
];

const confusionMatrix = [
  { actual: "Actual normal", predictedNormal: 1914, predictedFailure: 18 },
  { actual: "Actual failure", predictedNormal: 20, predictedFailure: 48 },
];

function ModelPerformancePage() {
  return (
    <div className="space-y-9">
      <PageHeading
        section="Model Performance"
        title="Model evaluation"
        description="Review held-out test performance of the trained Random Forest failure classifier."
      />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <BarChart3 size={21} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Random Forest classifier</p>
            <p className="mt-1 text-xs text-slate-500">UCI AI4I 2020 · Held-out test evaluation</p>
          </div>
        </div>
        <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 size={13} className="mr-1 inline" /> Evaluation completed
        </span>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {performanceMetrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
            <p className="text-xs font-medium text-slate-400">{metric.label}</p>
            <p className={`mt-5 text-3xl font-semibold ${metric.color}`}>{metric.value}</p>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{metric.description}</p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6">
          <p className="text-xs font-medium text-slate-400">Decision threshold</p>
          <p className="mt-5 text-3xl font-semibold text-white">0.2667</p>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">Selected using training-set out-of-fold predictions.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
          <h3 className="text-sm font-semibold text-slate-100">Confusion matrix</h3>
          <p className="mt-2 text-xs text-slate-500">Actual labels compared with model predictions on 2,000 test records.</p>
          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-2 text-center">
              <thead>
                <tr>
                  <th className="p-3 text-left text-[10px] font-medium uppercase tracking-wide text-slate-500">Actual / Predicted</th>
                  <th className="p-3 text-[10px] font-medium uppercase tracking-wide text-slate-500">Normal</th>
                  <th className="p-3 text-[10px] font-medium uppercase tracking-wide text-slate-500">Failure</th>
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, index) => (
                  <tr key={row.actual}>
                    <th className="p-3 text-left text-xs font-medium text-slate-400">{row.actual}</th>
                    <td className={`rounded-lg p-5 text-xl font-semibold ${index === 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{row.predictedNormal}</td>
                    <td className={`rounded-lg p-5 text-xl font-semibold ${index === 0 ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{row.predictedFailure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "True negatives", value: "1,914" },
              { label: "False positives", value: "18" },
              { label: "False negatives", value: "20" },
              { label: "True positives", value: "48" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-800 bg-[#0c1524] p-3">
                <p className="text-[10px] leading-4 text-slate-500">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
          <h3 className="text-sm font-semibold text-slate-100">Test-set composition</h3>
          <p className="mt-2 text-xs text-slate-500">Class distribution in the held-out test dataset.</p>
          <div className="mt-7 space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Normal records</span>
                <span className="text-xs font-medium text-slate-200">1,932 · 96.6%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: "96.6%" }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Failure records</span>
                <span className="text-xs font-medium text-slate-200">68 · 3.4%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-rose-500" style={{ width: "3.4%" }} />
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-slate-300">Evaluation dataset</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">2,000 records in the held-out test split, with 1,932 normal records and 68 failure records.</p>
          </div>
          <div className="mt-5 rounded-lg border border-violet-400/15 bg-violet-500/5 p-5">
            <p className="text-xs font-semibold text-violet-300">Threshold selection</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">The 0.2667 threshold was selected using out-of-fold predictions on the training data before evaluating the held-out test set.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 md:p-8">
        <div className="flex items-center gap-2">
          <Target size={17} className="text-violet-300" />
          <h3 className="text-sm font-semibold text-slate-100">Performance interpretation</h3>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-violet-300">Precision · 72.73%</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">Of the records predicted as failures, approximately 72.73% were actual failures.</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-emerald-300">Recall · 70.59%</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">The model identified 48 of the 68 actual failure records in the held-out test set.</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
            <p className="text-xs font-semibold text-sky-300">F1-score · 71.64%</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">Balances precision and recall, providing a more useful summary than accuracy alone for this imbalanced dataset.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-5">
        <div className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Dataset and evaluation limitations</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              The UCI AI4I 2020 dataset is synthetic. These results represent offline evaluation on its held-out test split, not validated performance in a real factory. The dataset is also highly imbalanced, so accuracy alone would be misleading.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------- Overview page -------------------- */

function OverviewPage({
  setActivePage,
}: {
  setActivePage: (page: string) => void;
}) {
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getMachines>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadInventory = async () => {
      try {
        const data = await getMachines();
        if (active) {
          setInventory(data);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInventory();
    const interval = window.setInterval(loadInventory, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const machines = inventory?.machines ?? [];
  const getMachineStatus = (prediction: number | null, riskLevel: string | null) => {
    if (prediction === 1) return "Critical";
    if (prediction === 0) {
      const level = riskLevel?.toLowerCase();
      return ["medium", "moderate", "high"].includes(level ?? "")
        ? "At risk"
        : "Operational";
    }
    return "Unknown";
  };

  const counts = {
    operational: machines.filter((machine) => getMachineStatus(machine.prediction, machine.risk_level) === "Operational").length,
    atRisk: machines.filter((machine) => getMachineStatus(machine.prediction, machine.risk_level) === "At risk").length,
    critical: machines.filter((machine) => getMachineStatus(machine.prediction, machine.risk_level) === "Critical").length,
  };

  const metricValues: Record<string, number> = {
    "Machines monitored": inventory?.total_machines ?? 0,
    Operational: counts.operational,
    "At risk": counts.atRisk,
    Critical: counts.critical,
  };

  const toneStyles: Record<string, string> = {
    violet: "bg-violet-400/10 text-violet-300 border-violet-400/15",
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/15",
    amber: "bg-amber-400/10 text-amber-300 border-amber-400/15",
    red: "bg-rose-400/10 text-rose-300 border-rose-400/15",
  };

  return (
    <div className="space-y-11">
      <PageHeading
        section="Overview"
        title="Machine overview"
        description="Monitor equipment health and review predictive maintenance insights."
        badgeText="Live database inventory"
      />

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Operational summary</h3>
            <p className="mt-2 text-xs text-slate-500">
              {loading ? "Loading machine records..." : error ? "Live inventory is currently unavailable." : "Latest machine status from PostgreSQL"}
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setRefreshKey((value) => value + 1);
            }}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        {error && !loading && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs text-rose-300">Could not retrieve live machine metrics. Check the backend connection and try again.</p>
            <button onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }} className="text-xs font-medium text-slate-200 underline underline-offset-4">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ title, icon: Icon, tone }) => (
            <div key={title} className="rounded-xl border border-slate-800 bg-[#111c2d] p-6 transition-colors hover:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-400">{title}</p>
                <div className={`rounded-lg border p-2 ${toneStyles[tone]}`}><Icon size={17} /></div>
              </div>
              <div className="mt-6 flex items-end justify-between gap-2">
                <p className="text-[32px] font-semibold leading-none tracking-tight text-white">
                  {loading ? "..." : error ? "--" : String(metricValues[title] ?? 0).padStart(2, "0")}
                </p>
                <span className="text-[11px] text-slate-500">{loading ? "Loading" : error ? "Unavailable" : "Live database"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-200">Analytics and model status</h3>
          <p className="mt-2 text-xs text-slate-500">Model configuration and monitoring overview</p>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Live inventory status</h4>
                <p className="mt-2 text-xs text-slate-500">Current classification of registered machines</p>
              </div>
              <Factory size={20} className="text-violet-300" />
            </div>
            <div className="mt-7 space-y-5">
              {[
                { label: "Operational", count: counts.operational, color: "bg-emerald-400" },
                { label: "At risk", count: counts.atRisk, color: "bg-amber-400" },
                { label: "Critical", count: counts.critical, color: "bg-rose-400" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className="text-xs font-medium text-slate-200">{loading ? "..." : error ? "--" : item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: !loading && !error && machines.length ? `${(item.count / machines.length) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
              {!loading && !error && machines.length === 0 && (
                <p className="text-xs text-slate-500">No machine records are currently registered.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#111c2d] p-7">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Model information</h4>
                <p className="mt-2 text-xs text-slate-500">Trained model configuration</p>
              </div>
              <BrainCircuit size={20} className="text-violet-300" />
            </div>
            <div className="mt-7 space-y-6">
              <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-400" /> Failure classifier</div>
                <p className="mt-4 text-[17px] font-semibold text-white">Random Forest</p>
                <p className="mt-2 text-xs text-slate-500">Saved decision threshold: 0.2667</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0c1524] p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Activity size={15} className="text-violet-300" /> Anomaly detector</div>
                <p className="mt-4 text-[17px] font-semibold text-white">Isolation Forest</p>
                <p className="mt-2 text-xs text-slate-500">Configured contamination: 3%</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-5 py-4">
                <span className="text-xs text-slate-300">Explainability engine</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400"><CheckCircle2 size={14} /> SHAP enabled</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-xl border border-slate-800 bg-[#111c2d] p-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Live machine inventory</h3>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">
            View registered equipment, the latest sensor readings stored in PostgreSQL,
            and each machine's latest failure prediction.
          </p>
        </div>
        <button
          onClick={() => setActivePage("Machines")}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          View live inventory <ChevronRight size={13} className="ml-1 inline" />
        </button>
      </section>
    </div>
  );
}

/* -------------------- Main application -------------------- */

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [latestExplanation, setLatestExplanation] =
    useState<ExplanationResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const health = await getHealth();
        if (isMounted) setApiHealth(health);
      } catch {
        if (isMounted) setApiHealth(null);
      }
    };

    checkHealth();
    const interval = window.setInterval(checkHealth, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const apiHealthy =
    apiHealth?.status === "healthy" &&
    apiHealth.models.random_forest === true &&
    apiHealth.models.isolation_forest === true;

  return (
    <div className="min-h-screen bg-[#0a101d] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0d1524]">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
              <Factory size={21} />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight">
                MachineGuard <span className="text-violet-400">ML</span>
              </h1>
              <p className="mt-0.5 text-[10px] font-medium tracking-[2px] text-slate-500">
                PREDICTIVE INTELLIGENCE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden items-center gap-2 rounded-lg border px-3 py-2 sm:flex ${
              apiHealthy
                ? "border-emerald-400/20 bg-emerald-400/5"
                : "border-amber-400/20 bg-amber-400/5"
            }`}>
              <span className={`h-2 w-2 rounded-full ${apiHealthy ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className={`text-xs ${apiHealthy ? "text-emerald-300" : "text-amber-300"}`}>
                {apiHealthy ? "API connected" : "API disconnected"}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300">
              MG
            </div>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1480px] gap-1 overflow-x-auto px-6 lg:px-10">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setActivePage(name)}
              aria-current={activePage === name ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-[15px] text-[13px] font-medium transition-colors ${
                activePage === name
                  ? "border-violet-400 text-violet-300"
                  : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-100"
              }`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1480px] space-y-11 px-6 py-11 lg:px-10 lg:py-12">
        {activePage === "Overview" ? (
          <OverviewPage setActivePage={setActivePage} />
        ) : activePage === "Machines" ? (
          <MachinesPage />
        ) : activePage === "Predictions" ? (
          <PredictionsPage
            onExplanation={setLatestExplanation}
            apiHealthy={Boolean(apiHealthy)}
          />
        ) : activePage === "Explainable AI" ? (
          <ExplainableAIPage explanation={latestExplanation} />
        ) : activePage === "Anomalies" ? (
          <AnomaliesPage />
        ) : activePage === "Live Monitoring" ? (
          <LiveMonitoringPage />
        ) : (
          <ModelPerformancePage />
        )}

        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-6 text-[11px] text-slate-600">
          <span>MachineGuard ML · Predictive Maintenance Platform</span>
          <span>
            {apiHealthy
              ? "Backend connected · Model API available"
              : "Development preview · Waiting for backend connection"}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
