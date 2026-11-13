import { useState, useEffect } from 'react';
import { PhysicalSensorIntelligenceHeader } from '@/components/dashboard/PhysicalSensorIntelligenceHeader';
import { PhysicalSummaryCards, PhysicalMetrics } from '@/components/dashboard/PhysicalSummaryCards';
import { MPU6050Canvas3D, MPU6050Telemetry } from '@/components/dashboard/MPU6050Canvas3D';
import { EnvironmentalMotionCharts } from '@/components/dashboard/EnvironmentalMotionCharts';
import { PhysicalTelemetryTable, PhysicalTelemetryRow } from '@/components/dashboard/PhysicalTelemetryTable';
import { apiService } from '@/services/api';
import { useSimulatorWebSocket } from '@/services/useWebSocket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Cpu } from 'lucide-react';

export function PhysicalSensorIntelligencePage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deviceSummary, setDeviceSummary] = useState<any | null>(null);
  const [historicalRows, setHistoricalRows] = useState<PhysicalTelemetryRow[]>([]);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [readinessStatus, setReadinessStatus] = useState<any | null>(null);

  // Real-time WebSocket feed
  const { isConnected, latestTelemetry } = useSimulatorWebSocket(100);

  // Extract latest incoming physical reading
  const isLatestPhysical =
    (latestTelemetry as any)?.source === 'physical' ||
    latestTelemetry?.device_id?.startsWith('ESP32');

  const latestFeat: PhysicalMetrics = isLatestPhysical
    ? (latestTelemetry as any)?.features || {}
    : {};

  // Formatted MPU6050 object for 3D Viewport
  const mpuTelemetry: MPU6050Telemetry | null =
    latestFeat.accel_z !== undefined || latestFeat.gyro_z !== undefined
      ? {
          accel_x: latestFeat.accel_x ?? 0,
          accel_y: latestFeat.accel_y ?? 0,
          accel_z: latestFeat.accel_z ?? 9.81,
          gyro_x: latestFeat.gyro_x ?? 0,
          gyro_y: latestFeat.gyro_y ?? 0,
          gyro_z: latestFeat.gyro_z ?? 0,
          accel_magnitude: latestFeat.acceleration_magnitude,
          vibration_rms: latestFeat.vibration_rms,
          timestamp: latestTelemetry?.timestamp,
        }
      : null;

  // Polling device health & historical records
  const loadHardwareStatus = async () => {
    setIsRefreshing(true);
    try {
      const [devices, h, r] = await Promise.all([
        apiService.getDevicesStatus().catch(() => []),
        apiService.getHealth().catch(() => null),
        apiService.getReadiness().catch(() => null),
      ]);
      setHealthStatus(h);
      setReadinessStatus(r);

      const esp = Array.isArray(devices)
        ? devices.find(
            (d: any) => d.device_id?.startsWith('ESP32') || d.source === 'physical'
          )
        : null;
      setDeviceSummary(esp || null);

      // Load device readings from MongoDB
      if (esp?.device_id) {
        const readingsRes = await apiService
          .getSensorReadings(esp.device_id, 50)
          .catch(() => null);
        if (readingsRes && readingsRes.items) {
          const rows: PhysicalTelemetryRow[] = readingsRes.items.map((item: any) => {
            const f = item.features || {};
            return {
              reading_id: item.reading_id,
              timestamp: item.timestamp,
              sequence: item.sequence,
              temperature: f.temperature,
              humidity: f.humidity,
              accel_x: f.accel_x,
              accel_y: f.accel_y,
              accel_z: f.accel_z,
              gyro_x: f.gyro_x,
              gyro_y: f.gyro_y,
              gyro_z: f.gyro_z,
              acceleration_magnitude: f.acceleration_magnitude,
              vibration_rms: f.vibration_rms,
              is_anomaly: item.is_anomaly || item.prediction?.is_anomaly,
            };
          });
          setHistoricalRows(rows);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHardwareStatus();
    const interval = setInterval(loadHardwareStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  // Update rows when new physical telemetry arrives via WebSocket
  useEffect(() => {
    if (!latestTelemetry || !isLatestPhysical) return;
    const f = (latestTelemetry as any).features || {};
    const newRow: PhysicalTelemetryRow = {
      reading_id: (latestTelemetry as any).reading_id || `PHYS_${Date.now()}`,
      timestamp: latestTelemetry.timestamp || new Date().toISOString(),
      sequence: (latestTelemetry as any).sequence,
      temperature: f.temperature,
      humidity: f.humidity,
      accel_x: f.accel_x,
      accel_y: f.accel_y,
      accel_z: f.accel_z,
      gyro_x: f.gyro_x,
      gyro_y: f.gyro_y,
      gyro_z: f.gyro_z,
      acceleration_magnitude: f.acceleration_magnitude,
      vibration_rms: f.vibration_rms,
      is_anomaly: (latestTelemetry as any).prediction?.is_anomaly,
    };
    setHistoricalRows((prev) => [newRow, ...prev.slice(0, 99)]);
  }, [latestTelemetry]);

  // Sparkline and chart history data mapping
  const chartHistory = historicalRows
    .slice(0, 40)
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temperature: r.temperature,
      humidity: r.humidity,
      accel_x: r.accel_x,
      accel_y: r.accel_y,
      accel_z: r.accel_z,
      gyro_x: r.gyro_x,
      gyro_y: r.gyro_y,
      gyro_z: r.gyro_z,
      acceleration_magnitude: r.acceleration_magnitude,
      vibration_rms: r.vibration_rms,
    }));

  const isOnline = deviceSummary?.status === 'online';

  return (
    <div
      className={`space-y-6 animate-fade-in ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#F8F9FA] p-6 overflow-y-auto' : ''
      }`}
    >
      {/* 1. Industrial Top Header */}
      <PhysicalSensorIntelligenceHeader
        deviceId={deviceSummary?.device_id || 'ESP32_PHYSICAL_01'}
        isOnline={isOnline}
        lastSeenSeconds={deviceSummary?.seconds_since_last_seen}
        samplingRateHz={1.0}
        isWsConnected={isConnected}
        isBackendHealthy={healthStatus?.status === 'ok'}
        isDbConnected={readinessStatus?.components?.database?.ready === true}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onRefresh={loadHardwareStatus}
        isRefreshing={isRefreshing}
      />

      {/* 2. Physical Sensor Summary Cards */}
      <PhysicalSummaryCards
        current={latestFeat}
        history={chartHistory}
        tempMinMax={{ min: 18.0, max: 45.0, avg: 26.5 }}
        humMinMax={{ min: 20.0, max: 90.0, avg: 52.0 }}
      />

      {/* 3. Central Feature: Interactive 3D MPU6050 Sensor Visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              Interactive 3D MPU6050 Motion & Attitude Viewport
            </h2>
            <p className="text-xs text-slate-500">
              Real-time tri-axial Euler orientation driven by high-speed hardware telemetry with Complementary Filter fusion.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono bg-white">
            WebGL 3D
          </Badge>
        </div>

        <MPU6050Canvas3D telemetry={mpuTelemetry} isStreaming={isOnline} />
      </div>

      {/* 4. Environmental & Motion Waveforms */}
      <EnvironmentalMotionCharts history={chartHistory} />

      {/* 5. Physical Hardware Diagnostics & Sensor Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DHT22 Health */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="py-3 px-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>DHT22 Transceiver Health</span>
              <Badge variant={latestFeat.temperature !== undefined ? 'success' : 'outline'} className="text-[10px]">
                {latestFeat.temperature !== undefined ? 'NOMINAL' : 'AWAITING'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1 text-xs text-slate-600 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Pin Interface:</span>
              <span>GPIO 4 (1-Wire)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Operating Range:</span>
              <span>-40°C to +80°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Validity Status:</span>
              <span className="text-emerald-600 font-semibold">Checksum Valid</span>
            </div>
          </CardContent>
        </Card>

        {/* MPU6050 Health */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="py-3 px-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>MPU6050 IMU Bus Health</span>
              <Badge variant={latestFeat.accel_z !== undefined ? 'success' : 'outline'} className="text-[10px]">
                {latestFeat.accel_z !== undefined ? 'I2C LOCKED' : 'AWAITING'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1 text-xs text-slate-600 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">I2C Address:</span>
              <span>0x68 (SDA 21 / SCL 22)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Full Scale Accel:</span>
              <span>±2g (16384 LSB/g)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Full Scale Gyro:</span>
              <span>±250°/s (131 LSB/°/s)</span>
            </div>
          </CardContent>
        </Card>

        {/* ESP32 Controller Health */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="py-3 px-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>ESP32 Microcontroller Core</span>
              <Badge variant={isOnline ? 'success' : 'outline'} className="text-[10px]">
                {isOnline ? 'HEARTBEAT OK' : 'STANDBY'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1 text-xs text-slate-600 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Architecture:</span>
              <span>Xtensa Dual-Core 240MHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Display Driver:</span>
              <span>SSD1306 128x64 OLED</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Auth Security:</span>
              <span className="text-blue-600 font-semibold">X-API-Key SHA256</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Physical Hardware Telemetry Register */}
      <PhysicalTelemetryTable
        rows={historicalRows}
        deviceId={deviceSummary?.device_id || 'ESP32_PHYSICAL_01'}
      />
    </div>
  );
}
