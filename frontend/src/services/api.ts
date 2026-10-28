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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://ai-anomaly.onrender.com/api/v1'
    : 'http://localhost:8000/api/v1');
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
  getDatasets: async (params?: {
    source?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: DatasetItem[]; total: number; pagination?: any }> => {
    try {
      const q = new URLSearchParams();
      if (params?.source && params.source !== 'all') q.set('source', params.source);
      if (params?.search) q.set('search', params.search);
      if (params?.page) q.set('page', String(params.page));
      if (params?.page_size) q.set('page_size', String(params.page_size));

      const qs = q.toString() ? `?${q.toString()}` : '';
      const res = await request<any>(`/datasets${qs}`);
      const items = Array.isArray(res) ? res : res.items || [];
      const total = res.pagination?.total_count ?? items.length;
      return { items, total, pagination: res.pagination };
    } catch {
      return { items: [], total: 0 };
    }
  },

  getDatasetDetails: async (datasetId: string): Promise<DatasetDetailResponse> => {
    return request<DatasetDetailResponse>(`/datasets/${datasetId}`);
  },

  getDatasetPreview: async (
    datasetId: string,
    limit: number = 25,
  ): Promise<{ dataset_id: string; total_rows: number; columns: string[]; preview: Record<string, any>[] }> => {
    return request<{ dataset_id: string; total_rows: number; columns: string[]; preview: Record<string, any>[] }>(
      `/datasets/${datasetId}/preview?limit=${limit}`,
    );
  },

  getDatasetAudit: async (datasetId: string): Promise<QualityAuditResponse> => {
    try {
      return await request<QualityAuditResponse>(`/datasets/${datasetId}/quality`);
    } catch {
      return request<QualityAuditResponse>(`/datasets/${datasetId}/audit`);
    }
  },

  generateSyntheticDataset: async (payload: {
    dataset_name: string;
    description?: string;
    device_count: number;
    samples_per_device: number;
    sampling_freq: string;
    inject_anomalies: boolean;
    anomaly_rate: number;
    random_seed: number;
  }): Promise<DatasetItem> => {
    return request<DatasetItem>('/datasets/generate-synthetic', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  uploadDatasetFile: async (formData: FormData): Promise<DatasetItem> => {
    const url = `${API_BASE_URL}/datasets/upload`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || 'File upload failed');
    }
    return (await res.json()) as DatasetItem;
  },

  preprocessDataset: async (payload: {
    dataset_id: string;
    handle_missing: string;
    drop_duplicates: boolean;
    normalize_features: boolean;
    train_split_ratio: number;
    val_split_ratio: number;
  }): Promise<any> => {
    return request<any>('/datasets/preprocess', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteDataset: async (datasetId: string): Promise<{ status: string }> => {
    return request<{ status: string }>(`/datasets/${datasetId}`, {
      method: 'DELETE',
    });
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
  getAnomalyKpis: async (): Promise<{
    total: number;
    pending: number;
    under_review: number;
    confirmed: number;
    false_positive: number;
    resolved: number;
    critical: number;
  }> => {
    try {
      return await request<{
        total: number;
        pending: number;
        under_review: number;
        confirmed: number;
        false_positive: number;
        resolved: number;
        critical: number;
      }>('/anomalies/summary/kpi');
    } catch {
      return {
        total: 0,
        pending: 0,
        under_review: 0,
        confirmed: 0,
        false_positive: 0,
        resolved: 0,
        critical: 0,
      };
    }
  },

  getAnomalies: async (params?: {
    device_id?: string;
    severity?: string;
    status?: string;
    review_status?: string;
    search?: string;
    sort_by?: string;
    order?: string;
    page?: number;
    page_size?: number;
    limit?: number;
  }): Promise<{ items: AnomalyRecord[]; total: number; pagination?: { total_count: number; total_pages: number } }> => {
    const q = new URLSearchParams();
    if (params?.device_id && params.device_id !== 'all') q.set('device_id', params.device_id);
    if (params?.severity && params.severity !== 'all') q.set('severity', params.severity);
    
    const effectiveStatus = params?.review_status || params?.status;
    if (effectiveStatus && effectiveStatus !== 'all') {
      q.set('review_status', effectiveStatus);
      q.set('status', effectiveStatus);
    }
    
    if (params?.search) q.set('search', params.search);
    if (params?.sort_by) q.set('sort_by', params.sort_by);
    if (params?.order) q.set('order', params.order);
    if (params?.page) q.set('page', String(params.page));
    
    const pageSize = params?.page_size || params?.limit || 50;
    q.set('page_size', String(pageSize));
    q.set('limit', String(pageSize));

    const qs = q.toString() ? `?${q.toString()}` : '';
    try {
      const res = await request<{
        items: AnomalyRecord[];
        pagination?: { page: number; page_size: number; total_count: number; total_pages: number };
        total?: number;
      }>(`/anomalies${qs}`);
      
      const items = res.items || [];
      const total = res.pagination?.total_count ?? (typeof res.total === 'number' ? res.total : items.length);
      return { items, total, pagination: res.pagination };
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

  bulkUpdateAnomalyStatus: async (
    anomalyIds: string[],
    reviewStatus: string,
    notes?: string,
  ): Promise<{ status: string; updated_count: number }> => {
    return request<{ status: string; updated_count: number }>('/anomalies/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({ anomaly_ids: anomalyIds, review_status: reviewStatus, notes }),
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
    dataset_id?: string;
    dataset_name?: string;
    parameters?: Record<string, unknown>;
  }): Promise<{ job_id: string; status: string; message?: string }> => {
    const bodyPayload = {
      model_name: payload.model_name,
      dataset_id: payload.dataset_id || 'DS_DEMO_SYNTH',
      model_params: payload.parameters || {},
    };
    return request<{ job_id: string; status: string; message?: string }>('/models/train', {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
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
