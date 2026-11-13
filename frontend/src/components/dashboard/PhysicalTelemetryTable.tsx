import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

export interface PhysicalTelemetryRow {
  reading_id: string;
  timestamp: string;
  sequence?: number;
  temperature?: number;
  humidity?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;
  acceleration_magnitude?: number;
  vibration_rms?: number;
  is_anomaly?: boolean;
}

interface PhysicalTelemetryTableProps {
  rows: PhysicalTelemetryRow[];
  deviceId: string;
}

export function PhysicalTelemetryTable({ rows, deviceId }: PhysicalTelemetryTableProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filter rows
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.reading_id.toLowerCase().includes(s) ||
      (r.sequence !== undefined && String(r.sequence).includes(s)) ||
      (r.temperature !== undefined && String(r.temperature).includes(s)) ||
      r.timestamp.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export to CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      'reading_id',
      'timestamp',
      'device_id',
      'sequence',
      'temperature_C',
      'humidity_pct',
      'accel_x_mps2',
      'accel_y_mps2',
      'accel_z_mps2',
      'gyro_x_dps',
      'gyro_y_dps',
      'gyro_z_dps',
      'accel_magnitude_mps2',
      'vibration_rms_g',
      'is_anomaly',
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...filtered.map((r) =>
          [
            r.reading_id,
            r.timestamp,
            deviceId,
            r.sequence ?? '',
            r.temperature ?? '',
            r.humidity ?? '',
            r.accel_x ?? '',
            r.accel_y ?? '',
            r.accel_z ?? '',
            r.gyro_x ?? '',
            r.gyro_y ?? '',
            r.gyro_z ?? '',
            r.acceleration_magnitude ?? '',
            r.vibration_rms ?? '',
            r.is_anomaly ? 1 : 0,
          ].join(',')
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `physical_telemetry_${deviceId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (filtered.length === 0) return;
    const jsonStr = JSON.stringify(filtered, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `physical_telemetry_${deviceId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-slate-200 shadow-card">
      <CardHeader className="py-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
        <div>
          <CardTitle className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Physical Hardware Telemetry Register
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified raw incoming frames from DHT22 (Temp, Humidity) and MPU6050 (6-DoF Accel/Gyro)
          </p>
        </div>

        {/* Toolbar & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search sequence / timestamp..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-56"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="text-xs h-7.5"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-600" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            disabled={filtered.length === 0}
            className="text-xs h-7.5"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-600" /> JSON
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Sequence</th>
                <th className="py-2.5 px-3.5">Timestamp (UTC)</th>
                <th className="py-2.5 px-3.5 text-right">Temp (°C)</th>
                <th className="py-2.5 px-3.5 text-right">Humidity (%)</th>
                <th className="py-2.5 px-3.5 text-right">AX (m/s²)</th>
                <th className="py-2.5 px-3.5 text-right">AY (m/s²)</th>
                <th className="py-2.5 px-3.5 text-right">AZ (m/s²)</th>
                <th className="py-2.5 px-3.5 text-right">GX (°/s)</th>
                <th className="py-2.5 px-3.5 text-right">GY (°/s)</th>
                <th className="py-2.5 px-3.5 text-right">GZ (°/s)</th>
                <th className="py-2.5 px-3.5 text-right">Vib RMS (g)</th>
                <th className="py-2.5 px-3.5 text-center">ML Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-xs text-slate-400 font-sans">
                    Awaiting physical telemetry frames from ESP32 DevKit...
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.reading_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                      #{row.sequence ?? '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-rose-600">
                      {row.temperature !== undefined ? row.temperature.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-blue-600">
                      {row.humidity !== undefined ? row.humidity.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600">
                      {row.accel_x !== undefined ? row.accel_x.toFixed(2) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600">
                      {row.accel_y !== undefined ? row.accel_y.toFixed(2) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600">
                      {row.accel_z !== undefined ? row.accel_z.toFixed(2) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500">
                      {row.gyro_x !== undefined ? row.gyro_x.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500">
                      {row.gyro_y !== undefined ? row.gyro_y.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500">
                      {row.gyro_z !== undefined ? row.gyro_z.toFixed(1) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-amber-600">
                      {row.vibration_rms !== undefined ? row.vibration_rms.toFixed(3) : '--'}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          row.is_anomaly
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {row.is_anomaly ? 'ANOMALY' : 'NOMINAL'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-3 px-4 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} frames
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="text-xs h-7 px-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="font-mono text-slate-700 px-1">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs h-7 px-2"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
