import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Thermometer,
  Droplets,
  Activity,
  Compass,
  Zap,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export interface PhysicalMetrics {
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
}

interface PhysicalSummaryCardsProps {
  current: PhysicalMetrics | null;
  history: Array<{ time: string } & Partial<PhysicalMetrics>>;
  tempMinMax?: { min: number; max: number; avg: number };
  humMinMax?: { min: number; max: number; avg: number };
}

export function PhysicalSummaryCards({
  current,
  history,
  tempMinMax,
  humMinMax,
}: PhysicalSummaryCardsProps) {
  const temp = current?.temperature;
  const hum = current?.humidity;
  const ax = current?.accel_x;
  const ay = current?.accel_y;
  const az = current?.accel_z;
  const gx = current?.gyro_x;
  const gy = current?.gyro_y;
  const gz = current?.gyro_z;
  const mag = current?.acceleration_magnitude ?? (ax !== undefined && ay !== undefined && az !== undefined ? Math.sqrt(ax * ax + ay * ay + az * az) : undefined);
  const vib = current?.vibration_rms;

  // Mini Sparkline slice
  const sparkData = history.slice(-20);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* 1. DHT22 Temperature Card */}
      <Card className="relative overflow-hidden border-slate-200/90 hover:border-blue-300 transition-all shadow-subtle">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-500" /> DHT22 Temp
            </span>
            <Badge variant={temp !== undefined && temp > 40 ? 'warning' : 'outline'} className="text-[10px] font-mono">
              {temp !== undefined ? `${temp > 28 ? 'HIGH' : 'NOMINAL'}` : 'OFFLINE'}
            </Badge>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                {temp !== undefined ? temp.toFixed(1) : '--'}
              </span>
              <span className="text-xs font-medium text-slate-500">°C</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Min: {tempMinMax?.min !== undefined ? tempMinMax.min.toFixed(1) : '--'}° | Max: {tempMinMax?.max !== undefined ? tempMinMax.max.toFixed(1) : '--'}°
            </p>
          </div>
          {/* Mini Sparkline */}
          <div className="h-9 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="temperature" stroke="#ef4444" fill="#fee2e2" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. DHT22 Humidity Card */}
      <Card className="relative overflow-hidden border-slate-200/90 hover:border-blue-300 transition-all shadow-subtle">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> DHT22 Humidity
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {hum !== undefined ? 'MEASURING' : 'OFFLINE'}
            </Badge>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                {hum !== undefined ? hum.toFixed(1) : '--'}
              </span>
              <span className="text-xs font-medium text-slate-500">% RH</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Min: {humMinMax?.min !== undefined ? humMinMax.min.toFixed(1) : '--'}% | Max: {humMinMax?.max !== undefined ? humMinMax.max.toFixed(1) : '--'}%
            </p>
          </div>
          <div className="h-9 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="humidity" stroke="#3b82f6" fill="#dbeafe" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3. MPU6050 Acceleration Magnitude */}
      <Card className="relative overflow-hidden border-slate-200/90 hover:border-indigo-300 transition-all shadow-subtle">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" /> Accel Vector
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              |A| G-NORM
            </Badge>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-indigo-600">
                {mag !== undefined ? mag.toFixed(2) : '--'}
              </span>
              <span className="text-xs font-medium text-slate-500">m/s²</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {mag !== undefined ? `${(mag / 9.80665).toFixed(2)} G (Earth gravity)` : '--'}
            </p>
          </div>
          <div className="h-9 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="acceleration_magnitude" stroke="#6366f1" fill="#e0e7ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 4. MPU6050 Vibration RMS */}
      <Card className="relative overflow-hidden border-slate-200/90 hover:border-amber-300 transition-all shadow-subtle">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Vibration RMS
            </span>
            <Badge variant={vib !== undefined && vib > 1.5 ? 'destructive' : 'outline'} className="text-[10px] font-mono">
              {vib !== undefined ? (vib > 1.5 ? 'CRITICAL' : 'QUIET') : 'OFFLINE'}
            </Badge>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-amber-600">
                {vib !== undefined ? vib.toFixed(3) : '--'}
              </span>
              <span className="text-xs font-medium text-slate-500">RMS (g)</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Threshold: &lt; 2.50 g nominal
            </p>
          </div>
          <div className="h-9 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="vibration_rms" stroke="#d97706" fill="#fef3c7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 5. MPU6050 Gyroscope Velocity */}
      <Card className="relative overflow-hidden border-slate-200/90 hover:border-emerald-300 transition-all shadow-subtle">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-500" /> Angular Rate
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              GYRO Z
            </Badge>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600">
                {gz !== undefined ? gz.toFixed(1) : '--'}
              </span>
              <span className="text-xs font-medium text-slate-500">°/s</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              GX: {gx !== undefined ? gx.toFixed(0) : '--'} | GY: {gy !== undefined ? gy.toFixed(0) : '--'}
            </p>
          </div>
          <div className="h-9 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="gyro_z" stroke="#10b981" fill="#d1fae5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
