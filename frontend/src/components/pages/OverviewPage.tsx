import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  TrendingUp,
  RefreshCw,
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
import { apiService } from '@/services/api';
import {
  AnomalyRecord,
  HealthResponse,
  ReadinessResponse,
  SimulatorStatusResponse,
} from '@/types/api';

export function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [simStatus, setSimStatus] = useState<SimulatorStatusResponse | null>(null);
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, r, s, anom] = await Promise.all([
        apiService.getHealth().catch(() => null),
        apiService.getReadiness().catch(() => null),
        apiService.getSimulatorStatus().catch(() => null),
        apiService.getAnomalies({ limit: 5 }).catch(() => ({ items: [], total: 0 })),
      ]);
      setHealth(h);
      setReadiness(r);
      setSimStatus(s);
      setRecentAnomalies(anom.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Synthetic trend line data for overview visualization
  const trendData = [
    { time: '10:00', normal: 120, anomaly: 2 },
    { time: '10:05', normal: 135, anomaly: 1 },
    { time: '10:10', normal: 128, anomaly: 4 },
    { time: '10:15', normal: 142, anomaly: 0 },
    { time: '10:20', normal: 155, anomaly: 3 },
    { time: '10:25', normal: 148, anomaly: 6 },
    { time: '10:30', normal: 160, anomaly: 2 },
  ];

  const dbReady = readiness?.components?.database?.ready ?? false;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Operational Overview</h2>
          <p className="text-xs text-slate-400">
            Real-time multi-variate telemetry status, model inference pipelines, and incident triage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={dbReady ? 'success' : 'destructive'} className="font-mono text-xs">
            {dbReady ? 'DATABASE: CONNECTED' : 'DATABASE: OFFLINE'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Telemetry Processed"
          value={simStatus?.metrics?.generated_count ?? 0}
          subtitle="Total telemetry records generated"
          icon={Activity}
          loading={loading}
        />
        <MetricCard
          title="ML Inferences Executed"
          value={simStatus?.metrics?.inferred_count ?? 0}
          subtitle="Real-time model evaluations"
          icon={Cpu}
          loading={loading}
        />
        <MetricCard
          title="Detected Anomalies"
          value={simStatus?.metrics?.anomalies_detected ?? 0}
          subtitle="Exceeded calibrated threshold"
          icon={AlertTriangle}
          loading={loading}
        />
        <MetricCard
          title="Simulation Throughput"
          value={`${simStatus?.metrics?.throughput_rps ?? 0} rps`}
          subtitle={`Avg latency: ${simStatus?.metrics?.avg_latency_ms ?? 0} ms`}
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* Trend Chart & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Telemetry Stream & Detection Distribution
                </CardTitle>
                <p className="text-xs text-slate-400">Normal telemetry vs. flagged anomaly scores</p>
              </div>
              <Badge variant="outline" className="text-[10px] text-slate-400">
                LAST 30 MIN
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="normal"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNormal)"
                  name="Normal Readings"
                />
                <Area
                  type="monotone"
                  dataKey="anomaly"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAnomaly)"
                  name="Anomalies Flagged"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subsystem Health Status */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white">Subsystem Health</CardTitle>
            <p className="text-xs text-slate-400">Live API probes & database connectivity</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">FastAPI Process</span>
                <Badge variant={health?.status === 'ok' ? 'success' : 'destructive'}>
                  {health?.status === 'ok' ? 'HEALTHY' : 'DOWN'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.app_name} v{health?.version}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">MongoDB Core</span>
                <Badge variant={dbReady ? 'success' : 'destructive'}>
                  {dbReady ? 'CONNECTED' : 'DISCONNECTED'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Target: {String(readiness?.components?.database?.details?.configured_target || 'N/A')}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">IoT Simulator Engine</span>
                <Badge
                  variant={
                    simStatus?.status === 'running'
                      ? 'success'
                      : simStatus?.status === 'paused'
                      ? 'warning'
                      : 'outline'
                  }
                  className="capitalize"
                >
                  {simStatus?.status || 'stopped'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Active devices: {simStatus?.devices?.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Recent Anomaly Incidents</CardTitle>
            <p className="text-xs text-slate-400">Latest flagged telemetry points requiring investigation</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing {recentAnomalies.length} incidents</span>
        </CardHeader>
        <CardContent>
          {recentAnomalies.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <AlertTriangle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No anomalies recorded yet. Run the IoT simulator or trigger an inference test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Device ID</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Anomaly Score</th>
                    <th className="py-2.5 px-3">Affected Features</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentAnomalies.map((anom) => (
                    <tr key={anom.anomaly_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {new Date(anom.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-white">{anom.device_id}</td>
                      <td className="py-2 px-3 font-mono text-blue-400">{anom.model_name}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-rose-400">
                        {(anom.normalized_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {anom.affected_features.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            anom.review_status === 'confirmed'
                              ? 'destructive'
                              : anom.review_status === 'false_positive'
                              ? 'secondary'
                              : 'warning'
                          }
                          className="capitalize text-[10px]"
                        >
                          {anom.review_status.replace('_', ' ')}
                        </Badge>
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
