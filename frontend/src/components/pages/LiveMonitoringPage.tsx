import { useState, useEffect } from 'react';
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
  Cpu,
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
  } = useSimulatorWebSocket(60);

  const [selectedSensor, setSelectedSensor] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'physical' | 'simulated'>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('temperature');
  const [actionLoading, setActionLoading] = useState(false);
  const [devicesStatus, setDevicesStatus] = useState<any[]>([]);

  // Periodically fetch real device status
  useEffect(() => {
    const fetchStatus = () => {
      apiService.getDevicesStatus().then(setDevicesStatus).catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter stream by selected source and device
  const filteredStream = telemetryStream.filter((item: any) => {
    const isPhysical = item.source === 'physical' || (item.device_id && item.device_id.startsWith('ESP32'));
    if (sourceFilter === 'physical' && !isPhysical) return false;
    if (sourceFilter === 'simulated' && isPhysical) return false;
    if (selectedSensor !== 'all' && item.device_id !== selectedSensor) return false;
    return true;
  });

  // Unique devices seen in stream
  const availableDevices = Array.from(new Set(telemetryStream.map((d) => d.device_id)));
  const physicalDevices = availableDevices.filter((d) => d.startsWith('ESP32') || devicesStatus.some((ds) => ds.device_id === d && ds.source === 'physical'));

  // Format chart data points
  const chartData = filteredStream.map((item: any, idx: number) => {
    const f = item.features || {};
    return {
      index: idx,
      time: new Date(item.timestamp).toLocaleTimeString(),
      device: item.device_id,
      source: item.source || (item.device_id.startsWith('ESP32') ? 'physical' : 'simulated'),
      temperature: f.temperature ?? 0,
      humidity: f.humidity ?? 0,
      pressure: f.pressure ?? 101.3,
      vibration: f.vibration_rms ?? f.vibration ?? 0,
      current: f.current ?? 12.5,
      accel_x: f.accel_x ?? 0,
      accel_y: f.accel_y ?? 0,
      accel_z: f.accel_z ?? 9.81,
      acceleration_magnitude: f.acceleration_magnitude ?? Math.sqrt((f.accel_x||0)**2 + (f.accel_y||0)**2 + (f.accel_z||9.81)**2),
      vibration_rms: f.vibration_rms ?? f.vibration ?? 0,
      anomalyScore: (item.prediction?.normalized_score ?? 0) * 100,
      isAnomaly: Boolean(item.prediction?.is_anomaly),
    };
  });

  // Extract latest reading for live gauges
  const latestItem = filteredStream.length > 0 ? filteredStream[filteredStream.length - 1] : latestTelemetry;
  const latestFeat = (latestItem as any)?.features || {};
  const isLatestPhysical = (latestItem as any)?.source === 'physical' || latestItem?.device_id?.startsWith('ESP32');

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
            duration_steps: 10,
            start_step: 5,
          },
          {
            anomaly_type: 'drift',
            target_channels: ['pressure', 'current'],
            magnitude: 3.5,
            duration_steps: 15,
            start_step: 25,
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
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Simulation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live Telemetry & Anomaly Stream
            </h1>
            <Badge
              variant={isConnected ? 'success' : 'destructive'}
              className="text-[11px] font-mono tracking-wide uppercase px-2 py-0.5"
            >
              {isConnected ? 'STREAMING' : 'DISCONNECTED'}
            </Badge>
            {physicalDevices.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-mono">
                ESP32 ACTIVE
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry ingestion from physical hardware nodes (ESP32) and physics simulators.
          </p>
        </div>

        {/* Source Mode Filter */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-lg flex items-center text-xs font-medium">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                sourceFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Combined
            </button>
            <button
              onClick={() => setSourceFilter('physical')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                sourceFilter === 'physical'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3 h-3" /> ESP32 Physical
            </button>
            <button
              onClick={() => setSourceFilter('simulated')}
              className={`px-3 py-1 rounded-md transition-all ${
                sourceFilter === 'simulated'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simulated
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <Button
              size="sm"
              variant="outline"
              onClick={handleStart}
              disabled={actionLoading}
              className="text-xs h-7 text-emerald-600 hover:text-emerald-700"
            >
              <Play className="w-3 h-3 mr-1" /> Sim
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePause}
              disabled={actionLoading}
              className="text-xs h-7"
            >
              <Pause className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResume}
              disabled={actionLoading}
              className="text-xs h-7"
              title="Resume simulation"
            >
              <Play className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStop}
              disabled={actionLoading}
              className="text-xs h-7 text-rose-600 hover:text-rose-700"
            >
              <Square className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={actionLoading}
              className="text-xs h-7 text-slate-500 hover:text-slate-900"
              title="Reset simulation"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Physical Hardware Status Panel (When Physical Hardware is Active or Selected) */}
      {(sourceFilter === 'physical' || physicalDevices.length > 0) && (
        <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50/40 via-white to-slate-50/50">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-xs font-semibold text-slate-800">
                Physical IoT Nodes — ESP32 DevKit (DHT22 + MPU6050 + SSD1306)
              </CardTitle>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Sampling: 1 Hz | Auth: X-API-Key
            </span>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Temp (DHT22)</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  {latestFeat.temperature !== undefined ? `${latestFeat.temperature.toFixed(1)} °C` : '--'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Humidity (DHT22)</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  {latestFeat.humidity !== undefined ? `${latestFeat.humidity.toFixed(1)} %` : '--'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Accel Mag</span>
                <p className="text-base font-bold text-indigo-600 mt-0.5">
                  {latestFeat.acceleration_magnitude !== undefined
                    ? `${latestFeat.acceleration_magnitude.toFixed(2)} m/s²`
                    : latestFeat.accel_z !== undefined
                    ? `${Math.sqrt((latestFeat.accel_x||0)**2 + (latestFeat.accel_y||0)**2 + (latestFeat.accel_z||9.81)**2).toFixed(2)} m/s²`
                    : '--'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Vibration RMS</span>
                <p className="text-base font-bold text-amber-600 mt-0.5">
                  {latestFeat.vibration_rms !== undefined
                    ? `${latestFeat.vibration_rms.toFixed(3)} RMS`
                    : latestFeat.vibration !== undefined
                    ? `${latestFeat.vibration.toFixed(3)} g`
                    : '--'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">IMU Axis (X/Y/Z)</span>
                <p className="text-xs font-mono font-medium text-slate-700 mt-1">
                  {latestFeat.accel_x !== undefined
                    ? `${latestFeat.accel_x.toFixed(1)}, ${latestFeat.accel_y.toFixed(1)}, ${latestFeat.accel_z.toFixed(1)}`
                    : '0.0, 0.0, 9.8'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Source Origin</span>
                <div className="mt-1">
                  <Badge variant={isLatestPhysical ? 'success' : 'outline'} className="text-[10px]">
                    {isLatestPhysical ? 'HARDWARE' : 'SIMULATED'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Devices"
          value={availableDevices.length > 0 ? availableDevices.length : '0'}
          subtitle={
            physicalDevices.length > 0
              ? `${physicalDevices.length} Physical ESP32 + ${availableDevices.length - physicalDevices.length} Sim`
              : availableDevices.join(', ') || 'No active nodes'
          }
          icon={Radio}
        />
        <MetricCard
          title="Telemetry Buffer"
          value={filteredStream.length}
          subtitle={`Recent ${filteredStream.length} frames (${sourceFilter} filter)`}
          icon={Layers}
        />
        <MetricCard
          title="Latest Anomaly Score"
          value={
            latestItem?.prediction?.normalized_score !== undefined
              ? `${(latestItem.prediction.normalized_score * 100).toFixed(1)}%`
              : '0.0%'
          }
          subtitle={
            latestItem?.prediction?.is_anomaly
              ? 'Flagged as Outlier'
              : 'Normal Operating Range'
          }
          changePositive={!latestItem?.prediction?.is_anomaly}
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
                  {d} {d.startsWith('ESP32') ? '(Physical)' : ''}
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
              <option value="temperature">Temperature (°C) [DHT22 / Sim]</option>
              <option value="humidity">Humidity (%) [DHT22 / Sim]</option>
              <option value="vibration_rms">Vibration RMS (g) [MPU6050]</option>
              <option value="acceleration_magnitude">Accel Mag (m/s²) [MPU6050]</option>
              <option value="accel_z">Accel Z (m/s²) [MPU6050]</option>
              <option value="pressure">Pressure (kPa) [Sim]</option>
              <option value="current">Current (A) [Sim]</option>
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
            <p className="text-xs text-slate-500">
              Mode: <span className="font-semibold text-slate-700">{sourceFilter.toUpperCase()}</span> | Filtered Device: <span className="font-semibold text-slate-700">{selectedSensor}</span>
            </p>
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
              description="Flash and power your ESP32 node or click 'Start Sim' above to stream live sensor readings."
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
                    stroke={selectedChannel.includes('vib') || selectedChannel.includes('accel') ? '#059669' : '#2563EB'}
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
            <p className="text-xs text-slate-500">Live multi-channel frame payload with source origin tagging</p>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStream.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No live frames matching the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Device ID</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Temp (°C)</th>
                    <th className="py-2.5 px-3">Humidity (%)</th>
                    <th className="py-2.5 px-3">Vib RMS / Accel</th>
                    <th className="py-2.5 px-3">Model Score</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredStream.slice(-10).reverse().map((item: any, idx: number) => {
                    const f = item.features || {};
                    const isPhys = item.source === 'physical' || item.device_id?.startsWith('ESP32');
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.device_id}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isPhys ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isPhys ? 'PHYSICAL' : 'SIMULATED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{f.temperature !== undefined ? f.temperature.toFixed(2) : '--'}</td>
                        <td className="py-2.5 px-3">{f.humidity !== undefined ? f.humidity.toFixed(2) : '--'}</td>
                        <td className="py-2.5 px-3">
                          {f.vibration_rms !== undefined
                            ? `${f.vibration_rms.toFixed(3)} RMS`
                            : f.vibration !== undefined
                            ? `${f.vibration.toFixed(2)} g`
                            : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {item.prediction?.normalized_score !== undefined
                            ? `${(item.prediction.normalized_score * 100).toFixed(1)}%`
                            : '0.0%'}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={item.prediction?.is_anomaly ? 'destructive' : 'success'}
                            className="text-[10px]"
                          >
                            {item.prediction?.is_anomaly ? 'OUTLIER' : 'NORMAL'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
