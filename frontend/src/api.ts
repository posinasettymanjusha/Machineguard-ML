
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ─────────────────────────────────────────────
// Machine input and ML response types
// ─────────────────────────────────────────────

export type MachineInput = {
  Type: string;
  "Air temperature": number;
  "Process temperature": number;
  "Rotational speed": number;
  Torque: number;
  "Tool wear": number;
};

export type HealthResponse = {
  status: "healthy" | "unhealthy";
  application: string;
  version: string;
  models: {
    random_forest: boolean;
    isolation_forest: boolean;
  };
};

export type PredictionResponse = {
  failure_probability: number;
  threshold: number;
  prediction: number;
  risk_level: string;
};

export type AnomalyResponse = {
  anomaly_prediction: number;
  status: "anomalous" | "normal";
  contamination: number;
};

export type ExplanationResponse = {
  failure_probability: number;
  threshold: number;
  prediction: number;
  base_value: number;
  feature_contributions: Record<string, number>;
};

export type ModelInfoResponse = {
  random_forest: {
    model_name: string;
    threshold: number;
    dataset: string;
    feature_columns: string[];
  };
  isolation_forest: {
    model_name: string;
    contamination: number;
    features: string[];
  };
  approved_input_features: string[];
};

// ─────────────────────────────────────────────
// Monitoring database types
// ─────────────────────────────────────────────

export type MachineRegistration = {
  machine_id: string;
  machine_name: string;
  machine_type: "L" | "M" | "H";
};

export type MonitoringStartResponse = {
  session_id: number;
  status: string;
};

export type MachineSnapshot = {
  machine_id: string;
  input: MachineInput;
  prediction: PredictionResponse;
  anomaly: AnomalyResponse;
};

export type SnapshotBatchResponse = {
  session_id: number;
  saved_machines: number;
  status: string;
};

export type MonitoringStopResponse = {
  session_id: number;
  status: string;
};

// ─────────────────────────────────────────────
// Shared API request handler
// ─────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach the MachineGuard API. Check that the FastAPI backend is running."
    );
  }

  if (!response.ok) {
    let detail = `API request failed (${response.status}).`;

    try {
      const body = await response.json();

      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((item: { msg?: string }) => item.msg || "Validation error")
          .join("; ");
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Existing ML API functions
// ─────────────────────────────────────────────

export function getHealth() {
  return request<HealthResponse>("/api/v1/health");
}

export function getModelInfo() {
  return request<ModelInfoResponse>("/api/v1/model-info");
}

export function predictFailure(input: MachineInput) {
  return request<PredictionResponse>("/api/v1/predict", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function detectAnomaly(input: MachineInput) {
  return request<AnomalyResponse>("/api/v1/anomaly-detection", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function explainPrediction(input: MachineInput) {
  return request<ExplanationResponse>("/api/v1/explain", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─────────────────────────────────────────────
// PostgreSQL monitoring persistence API
// ─────────────────────────────────────────────

/**
 * Create a monitoring session and register its machines.
 */
export function startMonitoring(machines: MachineRegistration[]) {
  return request<MonitoringStartResponse>(
    "/api/v1/monitoring/sessions",
    {
      method: "POST",
      body: JSON.stringify({ machines }),
    }
  );
}

/**
 * Save one batch of sensor readings and corresponding
 * ML predictions and anomaly results.
 */
export function saveMonitoringSnapshots(
  sessionId: number,
  machines: MachineSnapshot[]
) {
  return request<SnapshotBatchResponse>(
    `/api/v1/monitoring/sessions/${sessionId}/snapshots`,
    {
      method: "POST",
      body: JSON.stringify({ machines }),
    }
  );
}

/**
 * Stop an active monitoring session.
 */
export function stopMonitoring(sessionId: number) {
  return request<MonitoringStopResponse>(
    `/api/v1/monitoring/sessions/${sessionId}/stop`,
    {
      method: "POST",
    }
  );
}
