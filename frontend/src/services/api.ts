import {
  ApiErrorDetail,
  HealthResponse,
  ReadinessResponse,
  DatasetItem,
  DatasetDetailResponse,
  QualityAuditResponse,
  SensorDevice,
  SensorReading,
  PredictionResponse,
  AnomalyRecord,
  ModelArtifact,
  ExperimentItem,
  SimulatorStatusResponse,
  SimulatorStartRequest,
  SimulatorControlResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_KEY = import.meta.env.VITE_API_KEY || 'iot-secret-api-key-2026';

export class ApiClientError extends Error {
  code: string;
  field?: string;

  constructor(detail: ApiErrorDetail) {
    super(detail.message);
    this.name = 'ApiClientError';
    this.code = detail.code;
    this.field = detail.field;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorDetail: ApiErrorDetail;
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.error || {
          code: `HTTP_${res.status}`,
          message: errorJson.detail || errorJson.message || res.statusText || 'Request failed',
        };
      } catch {
        errorDetail = {
          code: `HTTP_${res.status}`,
          message: res.statusText || `Request failed with status ${res.status}`,
        };
      }
      throw new ApiClientError(errorDetail);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Unable to connect to backend server.',
    });
  }
}

export const apiService = {
  getBaseUrl: () => API_BASE_URL,
  getApiKey: () => API_KEY,

  getWsTelemetryUrl: () => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running in dev with localhost:8000
    const host = API_BASE_URL.replace(/^http(s)?:\/\//, '').replace(/\/api\/v1$/, '');
    return `${wsProto}//${host}/api/v1/simulator/ws/telemetry?token=${API_KEY}`;
  },

  // Health
  getHealth: async (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  getReadiness: async (): Promise<ReadinessResponse> => request<ReadinessResponse>('/ready'),

  // Datasets
  getDatasets: async (): Promise<DatasetItem[]> => {
    try {
      const res = await request<{ items?: DatasetItem[] } | DatasetItem[]>('/datasets');
      return Array.isArray(res) ? res : res.items || [];
    } catch {
      return [];
    }
  },

  getDatasetDetails: async (name: string): Promise<DatasetDetailResponse> => {
    return request<DatasetDetailResponse>(`/datasets/${name}`);
  },

  getDatasetAudit: async (name: string): Promise<QualityAuditResponse> => {
    return request<QualityAuditResponse>(`/datasets/${name}/audit`);
  },

  // Sensors
  getSensors: async (): Promise<SensorDevice[]> => {
    try {
      return await request<SensorDevice[]>('/sensors');
    } catch {
      return [];
    }
  },

  getSensorReadings: async (
    deviceId: string,
    limit: number = 50,
  ): Promise<{ items: SensorReading[]; total: number }> => {
    try {
      return await request<{ items: SensorReading[]; total: number }>(
        `/sensors/${deviceId}/readings?limit=${limit}`,
      );
    } catch {
      return { items: [], total: 0 };
    }
  },

  // Predictions
  predictSingle: async (
    deviceId: string,
    features: Record<string, number>,
    modelName: string = 'isolation_forest',
  ): Promise<PredictionResponse> => {
    return request<PredictionResponse>('/predictions', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        features,
        model_name: modelName,
      }),
    });
  },

  // Anomalies
  getAnomalies: async (params?: {
    device_id?: string;
    severity?: string;
    status?: string;
    limit?: number;
  }): Promise<{ items: AnomalyRecord[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.device_id) q.set('device_id', params.device_id);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));

    const qs = q.toString() ? `?${q.toString()}` : '';
    try {
      return await request<{ items: AnomalyRecord[]; total: number }>(`/anomalies${qs}`);
    } catch {
      return { items: [], total: 0 };
    }
  },

  updateAnomalyStatus: async (
    anomalyId: string,
    reviewStatus: string,
    notes?: string,
  ): Promise<AnomalyRecord> => {
    return request<AnomalyRecord>(`/anomalies/${anomalyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ review_status: reviewStatus, notes }),
    });
  },

  // Models
  getModels: async (): Promise<ModelArtifact[]> => {
    try {
      return await request<ModelArtifact[]>('/models');
    } catch {
      return [];
    }
  },

  triggerTraining: async (payload: {
    model_name: string;
    dataset_name: string;
    parameters?: Record<string, unknown>;
  }): Promise<{ job_id: string; status: string; message: string }> => {
    return request<{ job_id: string; status: string; message: string }>('/models/train', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Experiments
  getExperiments: async (): Promise<ExperimentItem[]> => {
    try {
      return await request<ExperimentItem[]>('/experiments');
    } catch {
      return [];
    }
  },

  createExperiment: async (payload: {
    experiment_name: string;
    dataset_id: string;
    model_name: string;
    model_params?: Record<string, unknown>;
  }): Promise<ExperimentItem> => {
    return request<ExperimentItem>('/experiments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Simulator
  getSimulatorStatus: async (): Promise<SimulatorStatusResponse> => {
    return request<SimulatorStatusResponse>('/simulator/status');
  },

  startSimulator: async (payload: SimulatorStartRequest): Promise<SimulatorControlResponse> => {
    return request<SimulatorControlResponse>('/simulator/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  pauseSimulator: async (): Promise<SimulatorControlResponse> => {
    return request<SimulatorControlResponse>('/simulator/pause', {
      method: 'POST',
    });
  },

  resumeSimulator: async (): Promise<SimulatorControlResponse> => {
    return request<SimulatorControlResponse>('/simulator/resume', {
      method: 'POST',
    });
  },

  stopSimulator: async (): Promise<SimulatorControlResponse> => {
    return request<SimulatorControlResponse>('/simulator/stop', {
      method: 'POST',
    });
  },

  resetSimulator: async (): Promise<SimulatorControlResponse> => {
    return request<SimulatorControlResponse>('/simulator/reset', {
      method: 'POST',
    });
  },
};
