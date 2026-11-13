import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  TrendingUp,
  RefreshCw,
  Server,
  Database,
  Radio,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import {
  AnomalyRecord,
  HealthResponse,
  ReadinessResponse,
} from '@/types/api';

export function OverviewPage() {
  // Real-time operational states: initialized to null so UI reflects actual live network & DB probe
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [devicesStatus, setDevicesStatus] = useState<any[]>([]);
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyRecord[]>([]);

  const loadData = async (showLoadingSpinner: boolean = false) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const [h, r, dev, anom] = await Promise.all([
        apiService.getHealth().catch(() => null),
        apiService.getReadiness().catch(() => null),
        apiService.getDevicesStatus().catch(() => []),
        apiService.getAnomalies({ limit: 5 }).catch(() => ({ items: [], total: 0 })),
      ]);
      // Always store actual response (or null if unreachable / timed out)
      setHealth(h);
      setReadiness(r);
      setDevicesStatus(Array.isArray(dev) ? dev : []);
      if (anom && anom.items) setRecentAnomalies(anom.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => loadData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // Find genuine physical ESP32 device
  const espDevice = devicesStatus.find(
    (d: any) => d.device_id?.startsWith('ESP32') || d.source === 'physical'
  );
  const isEspOnline = espDevice?.status === 'online';
  const totalReadingsProcessed = espDevice?.total_readings ?? 0;
  const recentAnomalyCount = recentAnomalies.length;

  const dbReady = readiness?.components?.database?.ready ?? false;
  const isHealthy = health?.status === 'ok';

  return (
    <div className="space-y-6">
      {/* Hero Operational Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Operational Overview</h2>
            <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200">
              Live Edge Fabric
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multivariate telemetry status, model inference pipelines, and incident triage.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge
            variant={dbReady ? 'success' : 'destructive'}
            className="flex items-center gap-1.5 py-1 px-3 text-xs"
          >
            {dbReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            )}
            DATABASE: {dbReady ? 'ONLINE' : 'OFFLINE'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadData(true)}
            disabled={loading}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Telemetry Processed"
          value={totalReadingsProcessed}
          subtitle="Physical sensor readings in DB"
          icon={Activity}
          loading={loading && devicesStatus.length === 0}
        />
        <MetricCard
          title="Hardware Nodes"
          value={espDevice ? 1 : 0}
          subtitle={isEspOnline ? "ESP32 DevKit Online" : "ESP32 DevKit Offline"}
          icon={TrendingUp}
          loading={loading && devicesStatus.length === 0}
        />
        <MetricCard
          title="Flagged Anomalies"
          value={recentAnomalyCount}
          subtitle="Physical anomalies detected"
          icon={AlertTriangle}
          loading={loading && devicesStatus.length === 0}
        />
        <MetricCard
          title="Telemetry Age"
          value={
            espDevice?.seconds_since_last_seen !== undefined
              ? `${espDevice.seconds_since_last_seen.toFixed(0)}s ago`
              : 'N/A'
          }
          subtitle={`Hardware Heartbeat`}
          icon={Cpu}
          loading={loading && devicesStatus.length === 0}
        />
      </div>

      {/* Main Analysis Chart & Subsystem Health Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Stream Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Telemetry Stream & Detection Distribution
              </CardTitle>
              <p className="text-xs text-slate-500">Normal telemetry vs. flagged anomaly scores</p>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">
              LAST 30 MIN
            </Badge>
          </CardHeader>
          <CardContent>
            {totalReadingsProcessed === 0 && !isEspOnline ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <Radio className="w-10 h-10 text-slate-400 mb-2 animate-pulse" />
                <p className="text-sm font-semibold text-slate-700">Waiting for Physical ESP32 Telemetry</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Connect your physical ESP32 running the DHT22 + MPU6050 firmware. Live streaming trends will chart automatically upon ingestion.
                </p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: 'T-30m', normal: isEspOnline ? totalReadingsProcessed : 0, anomaly: recentAnomalyCount },
                    { time: 'Now', normal: isEspOnline ? totalReadingsProcessed : 0, anomaly: recentAnomalyCount }
                  ]}>
                    <defs>
                      <linearGradient id="colorNormalLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorAnomalyLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="normal"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNormalLight)"
                      name="Physical Telemetry"
                    />
                    <Area
                      type="monotone"
                      dataKey="anomaly"
                      stroke="#DC2626"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAnomalyLight)"
                      name="Physical Anomalies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subsystem Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Subsystem Health
            </CardTitle>
            <p className="text-xs text-slate-500">Live API probes & database connectivity</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* FastAPI Process Health */}
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  FastAPI Process
                </span>
                <Badge variant={isHealthy ? 'success' : 'destructive'}>
                  {isHealthy ? 'HEALTHY' : 'DOWN'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {health?.app_name || 'Backend Gateway'} v{health?.version || '0.1.0'}
              </p>
            </div>

            {/* MongoDB Core Health */}
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  MongoDB Core
                </span>
                <Badge variant={dbReady ? 'success' : 'destructive'}>
                  {dbReady ? 'CONNECTED' : 'DISCONNECTED'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                Target: {String(readiness?.components?.database?.details?.configured_target || 'N/A')}
              </p>
            </div>

            {/* Physical ESP32 Hardware Core Health */}
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-slate-500" />
                  ESP32 DevKit Core
                </span>
                <Badge
                  variant={isEspOnline ? 'success' : 'destructive'}
                  className="capitalize font-mono"
                >
                  {isEspOnline ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                DHT22 & MPU6050: {isEspOnline ? 'Transmitting' : 'Waiting for connection'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incident Triage Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Recent Anomaly Incidents
            </CardTitle>
            <p className="text-xs text-slate-500">Latest detected outlier signatures</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {recentAnomalies.length} Records
          </Badge>
        </CardHeader>
        <CardContent>
          {recentAnomalies.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Anomaly Incidents Detected"
              description="The ML inference engine has not flagged any readings as anomalous in the latest stream window."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Device ID</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {recentAnomalies.map((anom) => (
                    <tr key={anom.anomaly_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-700">
                        {new Date(anom.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 font-semibold">{anom.device_id}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            anom.severity === 'critical'
                              ? 'destructive'
                              : anom.severity === 'high'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="capitalize text-[10px]"
                        >
                          {anom.severity}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {(anom.normalized_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 capitalize text-slate-600">
                        {anom.review_status.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
