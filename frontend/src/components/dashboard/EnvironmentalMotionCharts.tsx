import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Activity, Thermometer, Droplets } from 'lucide-react';

interface EnvironmentalMotionChartsProps {
  history: Array<{
    time: string;
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
  }>;
}

export function EnvironmentalMotionCharts({ history }: EnvironmentalMotionChartsProps) {
  // Axis visibility toggles
  const [showAX, setShowAX] = useState(true);
  const [showAY, setShowAY] = useState(true);
  const [showAZ, setShowAZ] = useState(true);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. DHT22 Environmental Telemetry Chart */}
      <Card className="border-slate-200 shadow-card">
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-rose-500" />
              DHT22 Environmental Dynamic Waveform
            </CardTitle>
            <p className="text-xs text-slate-500">Dual-axis temperature (°C) & relative humidity (% RH)</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
            {history.length} READINGS
          </Badge>
        </CardHeader>
        <CardContent className="pt-2">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              <Droplets className="w-8 h-8 text-slate-400 mb-1.5 animate-pulse" />
              <p className="text-xs font-semibold text-slate-700">Awaiting DHT22 Telemetry</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Physical temperature & humidity will graph here live.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="temp" stroke="#ef4444" fontSize={10} tickLine={false} axisLine={false} unit="°C" />
                  <YAxis yAxisId="hum" orientation="right" stroke="#3b82f6" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. MPU6050 Accelerometer 3-Axis Chart */}
      <Card className="border-slate-200 shadow-card">
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              MPU6050 Tri-Axial Accelerometer Waveform
            </CardTitle>
            <p className="text-xs text-slate-500">Real-time linear acceleration (m/s²)</p>
          </div>
          {/* Axis Toggles */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <button
              onClick={() => setShowAX(!showAX)}
              className={`px-2 py-0.5 rounded border ${showAX ? 'bg-red-50 text-red-700 border-red-300 font-bold' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
            >
              AX
            </button>
            <button
              onClick={() => setShowAY(!showAY)}
              className={`px-2 py-0.5 rounded border ${showAY ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
            >
              AY
            </button>
            <button
              onClick={() => setShowAZ(!showAZ)}
              className={`px-2 py-0.5 rounded border ${showAZ ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
            >
              AZ
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              <Activity className="w-8 h-8 text-slate-400 mb-1.5 animate-pulse" />
              <p className="text-xs font-semibold text-slate-700">Awaiting Accelerometer Frames</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Physical X, Y, Z acceleration vectors will stream here live.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} unit="m/s²" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {showAX && <Line type="monotone" dataKey="accel_x" name="Accel X (m/s²)" stroke="#ef4444" strokeWidth={1.8} dot={false} isAnimationActive={false} />}
                  {showAY && <Line type="monotone" dataKey="accel_y" name="Accel Y (m/s²)" stroke="#10b981" strokeWidth={1.8} dot={false} isAnimationActive={false} />}
                  {showAZ && <Line type="monotone" dataKey="accel_z" name="Accel Z (m/s²)" stroke="#3b82f6" strokeWidth={1.8} dot={false} isAnimationActive={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
