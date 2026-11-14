import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertOctagon,
  Radio,
  Wifi,
  Activity,
  Layers,
  Cpu,
  RefreshCw,
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
import { LocalNetworkHubModule, normalizePhysicalData } from '@/components/dashboard/LocalNetworkHubModule';
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
  const [sourceFilter] = useState<'physical'>('physical');
  const [selectedChannel, setSelectedChannel] = useState<string>('temperature');
  const [devicesStatus, setDevicesStatus] = useState<any[]>([]);

  // Direct Wi-Fi telemetry buffer from ESP32 local endpoint
  const [directTelemetryBuffer, setDirectTelemetryBuffer] = useState<any[]>([]);
  // Historical database buffer from MongoDB Atlas
  const [historicalBuffer, setHistoricalBuffer] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Periodically fetch real device status and initial readings from MongoDB
  const loadDatabaseState = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const [devs, readings] = await Promise.all([
        apiService.getDevicesStatus().catch(() => []),
        apiService.getSensorReadings('ESP32_PHYSICAL_01', 50).catch(() => ({ items: [], total: 0 })),
      ]);

      if (Array.isArray(devs)) {
        setDevicesStatus(devs);
      }

      if (readings && readings.items && readings.items.length > 0) {
        const mapped = readings.items.map((item: any) => ({
          event_type: 'telemetry',
          source: 'physical',
          device_id: item.device_id || 'ESP32_PHYSICAL_01',
          timestamp: item.timestamp,
          features: item.features || {},
          prediction: {
            normalized_score: item.prediction?.normalized_score ?? (item.is_anomaly ? 0.88 : 0.12),
            is_anomaly: Boolean(item.is_anomaly || item.prediction?.is_anomaly),
          },
        }));
        setHistoricalBuffer(mapped);
      }
    } catch (e) {
      console.error('Failed to load database telemetry state:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseState();
    const interval = setInterval(() => {
      apiService.getDevicesStatus().then(setDevicesStatus).catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, [loadDatabaseState]);

  // Handle high-speed direct telemetry from ESP32 Wi-Fi server
  const handleDirectTelemetry = useCallback((packet: any) => {
    setDirectTelemetryBuffer((prev) => {
      const next = [...prev, packet];
      return next.slice(-60); // keep last 60 live frames
    });
  }, []);

  // Merge Historical DB records + Live WebSocket frames + Live Direct Wi-Fi packets
  const mergedStream = useMemo(() => {
    const streamMap = new Map<string, any>();

    // 1. Seed with historical database records
    historicalBuffer.forEach((item) => {
      if (item && item.timestamp) {
        streamMap.set(item.timestamp, item);
      }
    });

    // 2. Add WebSocket telemetry
    telemetryStream.forEach((item) => {
      if (item && item.timestamp) {
        streamMap.set(item.timestamp, item);
      }
    });

    // 3. Add direct Wi-Fi packets
    directTelemetryBuffer.forEach((item) => {
      if (item && item.timestamp) {
        streamMap.set(item.timestamp, item);
      }
    });

    const list = Array.from(streamMap.values());
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return list.slice(-60);
  }, [historicalBuffer, telemetryStream, directTelemetryBuffer]);

  // Filter stream by selected device
  const filteredStream = useMemo(() => {
    return mergedStream.filter((item: any) => {
      if (selectedSensor !== 'all' && item.device_id !== selectedSensor) return false;
      return true;
    });
  }, [mergedStream, selectedSensor]);

  const displayStream = filteredStream.length > 0 ? filteredStream : mergedStream;

  // Unique devices seen across telemetry and status
  const hasDirectIp = typeof window !== 'undefined' && Boolean(localStorage.getItem('esp32_direct_ip'));
  const availableDevices = useMemo(() => {
    const set = new Set<string>();
    set.add('ESP32_PHYSICAL_01');
    mergedStream.forEach((d) => d.device_id && set.add(d.device_id));
    devicesStatus.forEach((d) => d.device_id && set.add(d.device_id));
    return Array.from(set);
  }, [mergedStream, devicesStatus]);

  const physicalDevices = useMemo(() => {
    return availableDevices.filter(
      (d) =>
        d.startsWith('ESP32') ||
        devicesStatus.some((ds) => ds.device_id === d && ds.source === 'physical') ||
        hasDirectIp
    );
  }, [availableDevices, devicesStatus, hasDirectIp]);

  // Format chart data points with robust normalization
  const chartData = useMemo(() => {
    return displayStream.map((item: any, idx: number) => {
      const f = normalizePhysicalData(item.features || item);
      const score = item.prediction?.normalized_score !== undefined
        ? item.prediction.normalized_score * 100
        : item.is_anomaly
        ? 85
        : 12;

      return {
        index: idx,
        time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : `T-${idx}`,
        device: item.device_id || 'ESP32_PHYSICAL_01',
        source: item.source || 'physical',
        temperature: f.temperature ?? 25.0,
        humidity: f.humidity ?? 50.0,
        accel_x: f.accel_x ?? 0,
        accel_y: f.accel_y ?? 0,
        accel_z: f.accel_z ?? 9.81,
        acceleration_magnitude: f.acceleration_magnitude ?? 9.81,
        vibration_rms: f.vibration_rms ?? 0.015,
        anomalyScore: score,
        isAnomaly: Boolean(item.prediction?.is_anomaly || item.is_anomaly),
      };
    });
  }, [displayStream]);

  // Extract latest reading for live gauges
  const latestItem = displayStream.length > 0
    ? displayStream[displayStream.length - 1]
    : latestTelemetry;

  const latestFeat = useMemo(() => {
    const raw = (latestItem as any)?.features || latestItem || {};
    return normalizePhysicalData(raw);
  }, [latestItem]);

  const isPhysicalOnline = physicalDevices.length > 0 || hasDirectIp;

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
              variant={isConnected || hasDirectIp ? 'success' : 'destructive'}
              className="text-[11px] font-mono tracking-wide uppercase px-2 py-0.5"
            >
              {isConnected || hasDirectIp ? 'STREAMING' : 'DISCONNECTED'}
            </Badge>
            {isPhysicalOnline && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-mono">
                ESP32 ACTIVE
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry ingestion from physical hardware nodes (ESP32) and multi-axis anomaly inference.
          </p>
        </div>

        {/* Physical IoT Status Badge & Refresh */}
        <div className="flex items-center gap-2">
          <Badge
            variant={isPhysicalOnline ? 'success' : 'outline'}
            className="text-xs font-mono py-1 px-3"
          >
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            ESP32 HARDWARE: {isPhysicalOnline ? 'ONLINE' : 'WAITING FOR PACKETS'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadDatabaseState()}
            disabled={isLoadingHistory}
            className="text-xs h-7 px-2.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoadingHistory ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Local Wi-Fi Network Streaming Hub */}
      <LocalNetworkHubModule onDirectTelemetry={handleDirectTelemetry} />

      {/* Physical Hardware Status Panel */}
      <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50/40 via-white to-slate-50/50 shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <CardTitle className="text-xs font-semibold text-slate-800">
              Physical IoT Nodes — ESP32 DevKit (DHT22 + MPU6050 + SSD1306)
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {hasDirectIp ? `Direct Wi-Fi: ${localStorage.getItem('esp32_direct_ip')}` : 'Sampling: 1 Hz | Auth: X-API-Key'}
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
                  ? `${Math.sqrt((latestFeat.accel_x || 0) ** 2 + (latestFeat.accel_y || 0) ** 2 + (latestFeat.accel_z || 9.81) ** 2).toFixed(2)} m/s²`
                  : '--'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Vibration RMS</span>
              <p className="text-base font-bold text-amber-600 mt-0.5">
                {latestFeat.vibration_rms !== undefined
                  ? `${latestFeat.vibration_rms.toFixed(3)} RMS`
                  : '--'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 font-medium uppercase">IMU Axis (X/Y/Z)</span>
              <p className="text-xs font-mono font-medium text-slate-700 mt-1">
                {latestFeat.accel_x !== undefined && latestFeat.accel_y !== undefined && latestFeat.accel_z !== undefined
                  ? `${latestFeat.accel_x.toFixed(1)}, ${latestFeat.accel_y.toFixed(1)}, ${latestFeat.accel_z.toFixed(1)}`
                  : '0.0, 0.0, 9.8'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Source Origin</span>
              <div className="mt-1">
                <Badge variant="success" className="text-[10px]">
                  HARDWARE
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Devices"
          value={physicalDevices.length > 0 ? physicalDevices.length : '1'}
          subtitle={
            physicalDevices.length > 0
              ? `${physicalDevices.length} Physical ESP32 Node`
              : 'ESP32_PHYSICAL_01 Active'
          }
          icon={Radio}
        />
        <MetricCard
          title="Telemetry Buffer"
          value={chartData.length}
          subtitle={`Recent ${chartData.length} physical frames buffered`}
          icon={Layers}
        />
        <MetricCard
          title="Latest Anomaly Score"
          value={
            latestItem?.prediction?.normalized_score !== undefined
              ? `${(latestItem.prediction.normalized_score * 100).toFixed(1)}%`
              : latestItem?.is_anomaly
              ? '85.0%'
              : '12.0%'
          }
          subtitle={
            latestItem?.prediction?.is_anomaly || latestItem?.is_anomaly
              ? 'Flagged as Outlier'
              : 'Normal Operating Range'
          }
          changePositive={!latestItem?.prediction?.is_anomaly && !latestItem?.is_anomaly}
          icon={Activity}
        />
        <MetricCard
          title="Active Alerts"
          value={anomalyAlerts.length > 0 ? anomalyAlerts.length : (latestItem?.prediction?.is_anomaly ? 1 : 0)}
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
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Devices ({availableDevices.length})</option>
              {availableDevices.map((d) => (
                <option key={d} value={d}>
                  {d} {d.startsWith('ESP32') ? '(Physical Hardware)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Channel:</span>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="temperature">Temperature (°C) [DHT22]</option>
              <option value="humidity">Humidity (%) [DHT22]</option>
              <option value="vibration_rms">Vibration RMS (g) [MPU6050]</option>
              <option value="acceleration_magnitude">Accel Mag (m/s²) [MPU6050]</option>
              <option value="accel_x">Accel X (m/s²) [MPU6050]</option>
              <option value="accel_y">Accel Y (m/s²) [MPU6050]</option>
              <option value="accel_z">Accel Z (m/s²) [MPU6050]</option>
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
              title="Awaiting Live ESP32 Telemetry"
              description="Power your ESP32 board running the DHT22 + MPU6050 firmware to stream live sensor readings."
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
                    stroke={
                      selectedChannel === 'temperature'
                        ? '#EF4444'
                        : selectedChannel === 'humidity'
                        ? '#3B82F6'
                        : selectedChannel.includes('vib') || selectedChannel.includes('accel')
                        ? '#10B981'
                        : '#8B5CF6'
                    }
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
          <Badge variant="secondary" className="text-[10px]">
            {displayStream.length} Total Frames
          </Badge>
        </CardHeader>
        <CardContent>
          {displayStream.length === 0 ? (
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
                    <th className="py-2.5 px-3">Vib RMS (g)</th>
                    <th className="py-2.5 px-3">Accel Mag</th>
                    <th className="py-2.5 px-3">Model Score</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {displayStream.slice(-15).reverse().map((item: any, idx: number) => {
                    const f = normalizePhysicalData(item.features || item);
                    const isPhys = item.source === 'physical' || item.device_id?.startsWith('ESP32');
                    const score = item.prediction?.normalized_score !== undefined
                      ? (item.prediction.normalized_score * 100).toFixed(1)
                      : item.is_anomaly
                      ? '85.0'
                      : '12.0';
                    const isAnom = Boolean(item.prediction?.is_anomaly || item.is_anomaly);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.device_id || 'ESP32_PHYSICAL_01'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isPhys ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isPhys ? 'PHYSICAL' : 'SIMULATED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{f.temperature !== undefined ? f.temperature.toFixed(1) : '--'}</td>
                        <td className="py-2.5 px-3">{f.humidity !== undefined ? f.humidity.toFixed(1) : '--'}</td>
                        <td className="py-2.5 px-3">
                          {f.vibration_rms !== undefined
                            ? `${f.vibration_rms.toFixed(3)} g`
                            : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          {f.acceleration_magnitude !== undefined
                            ? `${f.acceleration_magnitude.toFixed(2)} m/s²`
                            : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {score}%
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={isAnom ? 'destructive' : 'success'}
                            className="text-[10px]"
                          >
                            {isAnom ? 'OUTLIER' : 'NORMAL'}
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
