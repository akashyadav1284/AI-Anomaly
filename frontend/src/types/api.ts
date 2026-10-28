export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  timestamp: string;
}

export interface ComponentReadiness {
  ready: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  components: Record<string, ComponentReadiness>;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiErrorDetail | null;
  loading: boolean;
}

// ==========================================
// Phase 4 & 5 Full Domain Types
// ==========================================

export interface DatasetItem {
  dataset_id: string;
  name: string;
  description?: string;
  source: string;
  source_type?: string;
  row_count: number;
  column_count: number;
  feature_names: string[];
  devices: string[];
  timestamp_start?: string;
  timestamp_end?: string;
  label_availability: boolean;
  created_at: string;
  audited_at?: string;
  quality_summary?: Record<string, any>;
  storage_path?: string;
}

export interface DatasetDetailResponse extends DatasetItem {
  split_sizes?: {
    train: number;
    val: number;
    test: number;
  };
  file_format?: string;
  metadata?: Record<string, unknown>;
}

export interface QualityAuditIssue {
  check?: string;
  check_name?: string;
  severity: 'low' | 'medium' | 'high' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ERROR' | 'WARNING';
  detail?: string;
  message?: string;
  column?: string;
  affected_count?: number;
}

export interface QualityAuditResponse {
  dataset_name?: string;
  is_valid?: boolean;
  passed?: boolean;
  row_count?: number;
  total_samples?: number;
  missing_values_by_column?: Record<string, number>;
  missing_values_count?: number;
  duplicate_rows_count?: number;
  duplicate_timestamps?: number;
  infinite_values_count?: number;
  anomaly_summary?: {
    has_ground_truth: boolean;
    total_anomalies: number;
    anomaly_ratio: number;
    breakdown_by_type: Record<string, number>;
  };
  errors?: QualityAuditIssue[];
  warnings?: QualityAuditIssue[];
  issues?: QualityAuditIssue[];
  audited_at?: string;
  generated_at?: string;
}

export interface SensorDevice {
  device_id: string;
  dataset_id: string;
  first_seen: string;
  last_seen: string;
  total_readings: number;
}

export interface SensorReading {
  reading_id: string;
  device_id: string;
  dataset_id: string;
  timestamp: string;
  features: Record<string, number>;
}

export interface ContributingFeature {
  feature: string;
  score: number;
  deviation?: number;
}

export interface PredictionExplanation {
  primary_contributing_feature: string;
  top_contributions: ContributingFeature[];
}

export interface PredictionResponse {
  prediction_id: string;
  device_id: string;
  timestamp: string;
  model_name: string;
  raw_anomaly_score?: number;
  normalized_anomaly_score: number;
  decision_threshold: number;
  is_anomaly: boolean;
  explanation: PredictionExplanation | string;
  top_contributing_features?: ContributingFeature[];
}

export interface AnomalyRecord {
  anomaly_id: string;
  reading_id: string;
  device_id: string;
  timestamp: string;
  model_name: string;
  model_version: string;
  raw_score?: number;
  normalized_score: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  review_status: 'pending' | 'under_review' | 'confirmed' | 'false_positive' | 'resolved' | 'acknowledged';
  affected_features: string[];
  explanation?: string | PredictionExplanation;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  notes?: string;
  investigator?: string;
}

export interface ModelMetrics {
  precision?: number;
  recall?: number;
  f1_score?: number;
  pr_auc?: number;
  roc_auc?: number;
  detection_delay?: number;
  event_recall?: number;
}

export interface ModelArtifact {
  model_id: string;
  name?: string;
  model_name?: string;
  version?: string;
  model_version?: string;
  algorithm: string;
  status: 'active' | 'archived' | 'training' | 'failed' | 'ready' | string;
  calibrated_threshold?: number;
  threshold?: number;
  threshold_method?: string;
  feature_names: string[];
  metrics?: ModelMetrics;
  evaluation_metrics?: any;
  created_at: string;
}

export interface ExperimentItem {
  experiment_id: string;
  name: string;
  dataset_id: string;
  model_name: string;
  status: string;
  created_at: string;
  metrics?: ModelMetrics;
  error_message?: string;
}

export interface AnomalyInjectionConfig {
  anomaly_type: string;
  target_channels: string[];
  magnitude: number;
  duration_steps: number;
  start_step: number;
}

export interface SimulatorStartRequest {
  devices: string[];
  sampling_rate_hz: number;
  playback_speed: number;
  model_name: string;
  random_seed: number;
  persist_to_db: boolean;
  anomaly_injections: AnomalyInjectionConfig[];
}

export interface SimulatorMetrics {
  generated_count: number;
  inferred_count: number;
  anomalies_detected: number;
  persisted_count: number;
  dropped_messages: number;
  avg_latency_ms: number;
  throughput_rps: number;
}

export interface SimulatorStatusResponse {
  simulation_id?: string;
  status: 'stopped' | 'running' | 'paused' | 'error';
  devices: string[];
  model_name?: string;
  sampling_rate_hz: number;
  playback_speed: number;
  uptime_seconds: number;
  connected_ws_clients: number;
  metrics: SimulatorMetrics;
  created_at?: string;
}

export interface SimulatorControlResponse {
  status: string;
  message: string;
  simulation_id?: string;
  playback_speed?: number;
}

// WebSocket Event Payloads
export interface WsTelemetryEvent {
  event_type: 'telemetry';
  simulation_id: string;
  timestamp: string;
  device_id: string;
  features: Record<string, number>;
  prediction: {
    model_name: string;
    normalized_score: number;
    threshold: number;
    is_anomaly: boolean;
    top_contributing_features?: ContributingFeature[];
  };
}

export interface WsAnomalyAlertEvent {
  event_type: 'anomaly_alert';
  simulation_id: string;
  timestamp: string;
  device_id: string;
  score: number;
  threshold: number;
  affected_features: string[];
}

export interface WsStatusEvent {
  event_type: 'simulation_status';
  simulation_id?: string;
  status: string;
  timestamp: string;
  devices?: string[];
  error?: string;
}

export interface WsHeartbeatEvent {
  event_type: 'heartbeat';
  simulation_id?: string;
  timestamp: string;
  step: number;
  clients: number;
}

export type WsSimulatorMessage = WsTelemetryEvent | WsAnomalyAlertEvent | WsStatusEvent | WsHeartbeatEvent;

export interface DiagnosticCheckResult {
  name: string;
  category: string;
  status: 'healthy' | 'warning' | 'error' | 'info';
  latency_ms?: number;
  message: string;
  details?: Record<string, any>;
}

export interface SystemDiagnosticsResponse {
  executed_at: string;
  overall_status: string;
  checks: DiagnosticCheckResult[];
  summary: Record<string, number>;
}

export interface SecurityScanFinding {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  component: string;
  title: string;
  description: string;
  remediation: string;
  status: string;
}

export interface AuditLogItem {
  log_id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  action: string;
  target_resource: string;
  result: string;
  severity: string;
  correlation_id?: string;
  details?: Record<string, any>;
}
