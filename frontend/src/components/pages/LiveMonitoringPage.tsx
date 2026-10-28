import { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  AlertOctagon,
  Radio,
  Wifi,
  Activity,
  Layers,
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
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { useSimulatorWebSocket } from '@/services/useWebSocket';

export function LiveMonitoringPage() {
  const {
    isConnected,
    telemetryStream,
    anomalyAlerts,
    latestTelemetry,
    reconnect,
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
            duration_steps: 5,
            start_step: 15,
          },
        ],
      });
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
      {/* Top Workspace Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Real-Time Telemetry Monitor</h2>
            <Badge
              variant={isConnected ? 'success' : 'secondary'}
              className="flex items-center gap-1.5 text-xs font-mono"
            >
              <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-600' : 'text-slate-400'}`} />
              {isConnected ? 'CONNECTED' : 'STANDBY'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Streaming live multivariate telemetry across virtual sensor nodes via WebSocket with inline ML inference.
          </p>
        </div>

        {/* Simulator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleStart}
            disabled={actionLoading}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Start
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
            variant="outline"
            onClick={handleStop}
            disabled={actionLoading}
            className="text-xs text-rose-600 hover:text-rose-700"
          >
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={actionLoading}
            className="text-xs text-slate-500 hover:text-slate-900"
            title="Reset simulation state"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Devices"
          value={availableDevices.length > 0 ? availableDevices.length : '0'}
          subtitle={availableDevices.join(', ') || 'No active nodes'}
          icon={Radio}
        />
        <MetricCard
          title="Telemetry Buffer"
          value={telemetryStream.length}
          subtitle="Recent 50 samples cached"
          icon={Layers}
        />
        <MetricCard
          title="Latest Anomaly Score"
          value={
            latestTelemetry
              ? `${(latestTelemetry.prediction.normalized_score * 100).toFixed(1)}%`
              : '0.0%'
          }
          subtitle={
            latestTelemetry?.prediction.is_anomaly
              ? 'Flagged as Outlier'
              : 'Normal Operating Range'
          }
          changePositive={!latestTelemetry?.prediction.is_anomaly}
          icon={Activity}
        />
        <MetricCard
          title="Active Alerts"
          value={anomalyAlerts.length}
          subtitle="Pending incident triage"
          icon={AlertOctagon}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-subtle text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Device:</span>
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Devices ({availableDevices.length})</option>
              {availableDevices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Channel:</span>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="temperature">Temperature (°C)</option>
              <option value="humidity">Humidity (%)</option>
              <option value="pressure">Pressure (kPa)</option>
              <option value="vibration">Vibration (g)</option>
              <option value="current">Current (A)</option>
              <option value="anomalyScore">Anomaly Confidence (%)</option>
            </select>
          </div>
        </div>

        {!isConnected && (
          <Button size="sm" variant="outline" onClick={reconnect} className="text-xs h-7.5">
            <Wifi className="w-3.5 h-3.5 mr-1 text-blue-600" /> Reconnect WebSocket
          </Button>
        )}
      </div>

      {/* Live Chart Container */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Live Sensor Signal Waveform — {selectedChannel.toUpperCase()}
            </CardTitle>
            <p className="text-xs text-slate-500">Continuous telemetry feed at configured sampling rate</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
            {chartData.length} FRAMES
          </Badge>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Awaiting Live Telemetry Stream"
              description="Start the simulation engine or verify WebSocket connectivity to inspect live sensor readings."
              actionLabel="Start Simulation"
              onAction={handleStart}
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey={selectedChannel}
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                    name={selectedChannel.toUpperCase()}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Telemetry Stream Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">Recent Stream Telemetry</CardTitle>
            <p className="text-xs text-slate-500">Live multi-channel frame payload</p>
          </div>
        </CardHeader>
        <CardContent>
          {telemetryStream.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No live frames received yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Device ID</th>
                    <th className="py-2.5 px-3">Temp (°C)</th>
                    <th className="py-2.5 px-3">Humidity (%)</th>
                    <th className="py-2.5 px-3">Pressure (kPa)</th>
                    <th className="py-2.5 px-3">Vibration (g)</th>
                    <th className="py-2.5 px-3">Model Score</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {telemetryStream.slice(0, 8).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.device_id}</td>
                      <td className="py-2.5 px-3">{item.features.temperature.toFixed(2)}</td>
                      <td className="py-2.5 px-3">{item.features.humidity.toFixed(2)}</td>
                      <td className="py-2.5 px-3">{item.features.pressure.toFixed(2)}</td>
                      <td className="py-2.5 px-3">{item.features.vibration.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {(item.prediction.normalized_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={item.prediction.is_anomaly ? 'destructive' : 'success'}
                          className="text-[10px]"
                        >
                          {item.prediction.is_anomaly ? 'OUTLIER' : 'NORMAL'}
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
