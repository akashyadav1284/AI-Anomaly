import { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Sliders,
  AlertOctagon,
  Radio,
  Wifi,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { apiService } from '@/services/api';
import { useSimulatorWebSocket } from '@/services/useWebSocket';

export function LiveMonitoringPage() {
  const {
    isConnected,
    telemetryStream,
    anomalyAlerts,
    latestTelemetry,
    reconnect,
    clearAlerts,
  } = useSimulatorWebSocket(50);

  const [selectedSensor, setSelectedSensor] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('temperature');
  const [actionLoading, setActionLoading] = useState(false);

  // Filter stream by selected device
  const filteredStream = telemetryStream.filter(
    (item) => selectedSensor === 'all' || item.device_id === selectedSensor,
  );

  // Format chart data points
  const chartData = filteredStream.map((item, idx) => ({
    index: idx,
    time: new Date(item.timestamp).toLocaleTimeString(),
    device: item.device_id,
    temperature: item.features.temperature,
    humidity: item.features.humidity,
    pressure: item.features.pressure,
    vibration: item.features.vibration,
    current: item.features.current,
    anomalyScore: item.prediction.normalized_score * 100,
    isAnomaly: item.prediction.is_anomaly,
  }));

  // Unique devices seen in stream
  const availableDevices = Array.from(new Set(telemetryStream.map((d) => d.device_id)));

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await apiService.startSimulator({
        devices: ['sim-node-01', 'sim-node-02'],
        sampling_rate_hz: 2.0,
        playback_speed: 1.0,
        model_name: 'isolation_forest',
        random_seed: 42,
        persist_to_db: true,
        anomaly_injections: [
          {
            anomaly_type: 'spike',
            target_channels: ['temperature', 'vibration'],
            magnitude: 5.0,
            duration_steps: 4,
            start_step: 10,
          },
        ],
      });
    } catch (e) {
      alert(`Start failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await apiService.pauseSimulator();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await apiService.resumeSimulator();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await apiService.stopSimulator();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      await apiService.resetSimulator();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Header & Simulator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Real-Time Telemetry Stream</h2>
            <Badge variant={isConnected ? 'success' : 'destructive'} className="font-mono text-xs">
              <Wifi className="w-3 h-3 mr-1" />
              {isConnected ? 'LIVE FEED ACTIVE' : 'STREAM DISCONNECTED'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sub-second telemetry ingestion with synchronous Phase 3 anomaly scoring & attribution.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleStart}
            disabled={actionLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Start Simulation
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePause}
            disabled={actionLoading}
            className="text-xs"
          >
            <Pause className="w-3.5 h-3.5 mr-1" /> Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResume}
            disabled={actionLoading}
            className="text-xs"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Resume
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={actionLoading}
            className="text-xs"
          >
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={actionLoading}
            className="text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Channel"
          value={selectedChannel.toUpperCase()}
          subtitle="Selected telemetry variable"
          icon={Radio}
        />
        <MetricCard
          title="Latest Reading"
          value={
            latestTelemetry?.features[selectedChannel] !== undefined
              ? `${latestTelemetry.features[selectedChannel]}`
              : '—'
          }
          subtitle={`Device: ${latestTelemetry?.device_id || 'Waiting...'}`}
          icon={Clock}
        />
        <MetricCard
          title="Model Anomaly Score"
          value={
            latestTelemetry?.prediction
              ? `${(latestTelemetry.prediction.normalized_score * 100).toFixed(1)}%`
              : '—'
          }
          subtitle={`Threshold: ${(
            (latestTelemetry?.prediction.threshold ?? 0.7) * 100
          ).toFixed(1)}%`}
          icon={AlertOctagon}
          change={latestTelemetry?.prediction?.is_anomaly ? 'ANOMALY DETECTED' : 'NORMAL'}
          changePositive={!latestTelemetry?.prediction?.is_anomaly}
        />
        <MetricCard
          title="Stream Buffer"
          value={`${telemetryStream.length} / 50`}
          subtitle="In-memory ring buffer frames"
          icon={Sliders}
        />
      </div>

      {/* Filter and Channel Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-slate-900/40 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Device:</span>
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            className="bg-slate-800 text-xs text-white rounded px-2.5 py-1.5 border border-slate-700 outline-none"
          >
            <option value="all">All Streamed Devices</option>
            {availableDevices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Telemetry Channel:</span>
          <div className="flex gap-1">
            {['temperature', 'humidity', 'pressure', 'vibration', 'current'].map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-2.5 py-1 rounded text-xs capitalize font-medium transition-colors ${
                  selectedChannel === ch
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry Graph */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Dynamic Telemetry & Synchronous Anomaly Scoring
            </CardTitle>
            <p className="text-xs text-slate-400">
              Blue line: Sensor physics value • Purple dashed line: Normalized anomaly score
            </p>
          </div>
          {!isConnected && (
            <Button size="sm" variant="outline" onClick={reconnect} className="text-xs">
              Reconnect WebSocket
            </Button>
          )}
        </CardHeader>
        <CardContent className="h-72 pt-4">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
              Waiting for incoming WebSocket telemetry frames...
              <p className="text-[11px] text-slate-500 mt-1">
                Click <strong>"Start Simulation"</strong> above to launch the virtual IoT generator.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={10} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  stroke="#a855f7"
                  fontSize={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={selectedChannel}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  name={`${selectedChannel} (Units)`}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="anomalyScore"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#ec4899' }}
                  name="Anomaly Probability %"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Live Anomaly Feed Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Live Anomaly Event Intercepts
            </CardTitle>
            <p className="text-xs text-slate-400">
              Immediate broadcasts from WebSocket when normalized anomaly score &gt; threshold
            </p>
          </div>
          {anomalyAlerts.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAlerts}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear Buffer
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {anomalyAlerts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No anomalies triggered in the current streaming session.
            </div>
          ) : (
            <div className="space-y-2">
              {anomalyAlerts.map((alert, idx) => (
                <div
                  key={`${alert.timestamp}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-rose-950/20 border border-rose-900/30 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded bg-rose-500/20 text-rose-400">
                      <AlertOctagon className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="font-semibold text-white mr-2">{alert.device_id}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 mr-2">Score:</span>
                      <span className="font-mono font-bold text-rose-400">
                        {(alert.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {alert.affected_features.map((f) => (
                        <span
                          key={f}
                          className="px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 font-mono text-[10px]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
