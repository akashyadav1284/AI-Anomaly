import { useState, useEffect } from 'react';
import { Radio, RefreshCw, Filter } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
      // Sort chronologically for chart display
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sensor Device Explorer</h2>
          <p className="text-xs text-slate-400">
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
          className="text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Sensor Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Select Device Node</span>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-slate-800 text-sm font-semibold text-white rounded px-3 py-1.5 border border-slate-700 outline-none mt-1"
            >
              {sensors.length === 0 ? (
                <option value="">No devices registered</option>
              ) : (
                sensors.map((s) => (
                  <option key={s.device_id} value={s.device_id}>
                    {s.device_id} ({s.total_readings} records)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Record limit:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-slate-800 text-xs text-white rounded px-2 py-1 border border-slate-700"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Telemetry Chart */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">
            Historical Multivariate Signal Profiles ({selectedDevice || 'None'})
          </CardTitle>
          <p className="text-xs text-slate-400">Temperature, Vibration, Pressure & Current channels</p>
        </CardHeader>
        <CardContent className="h-72 pt-2">
          {readings.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No historical telemetry points found for this device in MongoDB.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="temperature" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="vibration" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="pressure" stroke="#10b981" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="current" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Readings Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Readings Log</CardTitle>
            <p className="text-xs text-slate-400">Chronological telemetry records</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {readings.length} ROWS
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 sticky top-0 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-2 px-3">Reading ID</th>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Temp (°C)</th>
                  <th className="py-2 px-3">Humidity (%)</th>
                  <th className="py-2 px-3">Pressure (kPa)</th>
                  <th className="py-2 px-3">Vibration (mm/s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {readings.map((r) => (
                  <tr key={r.reading_id} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-3 text-slate-500">{r.reading_id}</td>
                    <td className="py-1.5 px-3 text-slate-400">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="py-1.5 px-3 text-red-400">{r.features.temperature ?? '—'}</td>
                    <td className="py-1.5 px-3 text-sky-400">{r.features.humidity ?? '—'}</td>
                    <td className="py-1.5 px-3 text-emerald-400">{r.features.pressure ?? '—'}</td>
                    <td className="py-1.5 px-3 text-blue-400">{r.features.vibration ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
