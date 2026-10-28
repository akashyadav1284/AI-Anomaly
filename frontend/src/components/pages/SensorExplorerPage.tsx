import { useState, useEffect } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { SensorDevice, SensorReading } from '@/types/api';

export function SensorExplorerPage() {
  const [sensors, setSensors] = useState<SensorDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const fetchSensors = async () => {
    try {
      const list = await apiService.getSensors();
      setSensors(list);
      if (list.length > 0 && !selectedDevice) {
        setSelectedDevice(list[0].device_id);
      }
    } catch {
      // ignore
    }
  };

  const fetchReadings = async (deviceId: string, count: number) => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await apiService.getSensorReadings(deviceId, count);
      const sorted = [...res.items].reverse();
      setReadings(sorted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensors();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchReadings(selectedDevice, limit);
    }
  }, [selectedDevice, limit]);

  const chartData = readings.map((r, i) => ({
    idx: i,
    time: new Date(r.timestamp).toLocaleTimeString(),
    ...r.features,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Sensor Device Explorer & Time-Series History
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              {sensors.length} Devices
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Query persisted historical telemetry across virtual and ingested IoT edge devices.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            fetchSensors();
            if (selectedDevice) fetchReadings(selectedDevice, limit);
          }}
          disabled={loading}
          className="text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Device Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-subtle text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-600 font-medium">Select Device:</span>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            >
              {sensors.length === 0 ? (
                <option value="">No devices registered</option>
              ) : (
                sensors.map((s) => (
                  <option key={s.device_id} value={s.device_id}>
                    {s.device_id} ({s.dataset_id})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">History Window:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={20}>Last 20 Samples</option>
              <option value={50}>Last 50 Samples</option>
              <option value={100}>Last 100 Samples</option>
            </select>
          </div>
        </div>

        <Badge variant="secondary" className="font-mono text-xs">
          Loaded: {readings.length} records
        </Badge>
      </div>

      {/* Historical Multivariate Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Multivariate Sensor Channels — {selectedDevice || 'No Device Selected'}
            </CardTitle>
            <p className="text-xs text-slate-500">Historical telemetry persisted to MongoDB</p>
          </div>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No Historical Readings Found"
              description="Either start the IoT simulator with MongoDB persistence enabled or select a different device node."
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
                    dataKey="temperature"
                    stroke="#2563EB"
                    strokeWidth={1.75}
                    dot={false}
                    name="Temperature (°C)"
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#10B981"
                    strokeWidth={1.75}
                    dot={false}
                    name="Humidity (%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="pressure"
                    stroke="#8B5CF6"
                    strokeWidth={1.75}
                    dot={false}
                    name="Pressure (kPa)"
                  />
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    stroke="#F59E0B"
                    strokeWidth={1.75}
                    dot={false}
                    name="Vibration (g)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
