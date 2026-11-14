import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Sliders,
  Zap,
  RotateCcw,
  Check,
  Thermometer,
  Droplets,
  Activity,
  Vibrate,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { apiService } from '@/services/api';

export interface PhysicalThresholds {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  accel_x_max: number;
  accel_y_max: number;
  accel_z_dev_max: number;
  vibration_max: number;
  gyro_max?: number;
}

export const DEFAULT_THRESHOLDS: PhysicalThresholds = {
  temp_min: 18.0,
  temp_max: 32.0,
  hum_min: 25.0,
  hum_max: 70.0,
  accel_x_max: 2.5,
  accel_y_max: 2.5,
  accel_z_dev_max: 3.0,
  vibration_max: 0.35,
  gyro_max: 50.0,
};

export const THRESHOLDS_STORAGE_KEY = 'iot_anomaly_thresholds';

export function getStoredThresholds(): PhysicalThresholds {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS;
  try {
    const raw = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

interface PhysicalThresholdControllerProps {
  onThresholdsChanged?: (thresholds: PhysicalThresholds) => void;
  onAnomalyTriggered?: (anomaly: any) => void;
}

export function PhysicalThresholdController({
  onThresholdsChanged,
  onAnomalyTriggered,
}: PhysicalThresholdControllerProps) {
  const [thresholds, setThresholds] = useState<PhysicalThresholds>(getStoredThresholds);
  const [isSaved, setIsSaved] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedTestFeature, setSelectedTestFeature] = useState<string>('accel_x');
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getStoredThresholds();
    setThresholds(loaded);
  }, []);

  const handleChange = (key: keyof PhysicalThresholds, value: number) => {
    const updated = { ...thresholds, [key]: Number(value) };
    setThresholds(updated);
    setIsSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
      setIsSaved(true);
      if (onThresholdsChanged) onThresholdsChanged(thresholds);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save thresholds:', e);
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    try {
      localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(DEFAULT_THRESHOLDS));
      if (onThresholdsChanged) onThresholdsChanged(DEFAULT_THRESHOLDS);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerTestAnomaly = async () => {
    setIsTriggering(true);
    setTriggerStatus(null);
    try {
      let val: number | undefined;
      let exp: string | undefined;

      switch (selectedTestFeature) {
        case 'accel_x':
          val = 3.85;
          exp = `Simulated Lateral Tilt Shock: Accel X = +3.85 m/s² (threshold: ±${thresholds.accel_x_max} m/s²)`;
          break;
        case 'accel_y':
          val = 3.65;
          exp = `Simulated Forward/Back Tilt Shock: Accel Y = +3.65 m/s² (threshold: ±${thresholds.accel_y_max} m/s²)`;
          break;
        case 'accel_z':
          val = 14.80;
          exp = `Simulated Drop / Vertical Shock: Accel Z = 14.80 m/s² (dev > ${thresholds.accel_z_dev_max} m/s²)`;
          break;
        case 'temperature':
          val = 38.5;
          exp = `Simulated Thermal Excursion: Temperature = 38.5°C (threshold: ${thresholds.temp_max}°C)`;
          break;
        case 'humidity':
          val = 78.5;
          exp = `Simulated Moisture Condensation Surge: Humidity = 78.5% (threshold: ${thresholds.hum_max}%)`;
          break;
        case 'vibration_rms':
          val = 0.85;
          exp = `Simulated Rapid Motor Oscillation: Vibration RMS = 0.85 g (threshold: ${thresholds.vibration_max} g)`;
          break;
        default:
          val = 3.5;
      }

      const res = await apiService.triggerPhysicalAnomaly({
        device_id: 'ESP32_PHYSICAL_01',
        feature_type: selectedTestFeature,
        value: val,
        severity: 'HIGH',
        explanation: exp,
      });

      setTriggerStatus(`Flagged & saved ${res.anomaly_id || 'anomaly'} to MongoDB Atlas!`);
      if (onAnomalyTriggered) onAnomalyTriggered(res);
      setTimeout(() => setTriggerStatus(null), 5000);
    } catch (err: any) {
      setTriggerStatus(`Trigger failed: ${err.message || 'Server error'}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-white overflow-hidden">
      <CardHeader className="py-3.5 px-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-900">
              Multi-Axis Anomaly Detection Thresholds
            </CardTitle>
            <p className="text-[11px] text-slate-500">
              Tweak sensitivity bounds for Physical DHT22 and MPU6050 axes to trigger incident alerts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="text-[11px] h-7 px-2.5 text-slate-600"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className={`text-[11px] h-7 px-3 font-semibold ${
              isSaved
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Saved
              </>
            ) : (
              'Apply Bounds'
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Temperature Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                Max Temperature
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                {thresholds.temp_max}°C
              </Badge>
            </div>
            <input
              type="range"
              min="22"
              max="50"
              step="0.5"
              value={thresholds.temp_max}
              onChange={(e) => handleChange('temp_max', parseFloat(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Triggered if sensor exceeds {thresholds.temp_max}°C</p>
          </div>

          {/* Humidity Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                Max Humidity
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                {thresholds.hum_max}%
              </Badge>
            </div>
            <input
              type="range"
              min="40"
              max="95"
              step="1"
              value={thresholds.hum_max}
              onChange={(e) => handleChange('hum_max', parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Breathing or steam exceeding {thresholds.hum_max}% triggers alert</p>
          </div>

          {/* Accel X Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                Accel X Lateral Tilt
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                ±{thresholds.accel_x_max} m/s²
              </Badge>
            </div>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.1"
              value={thresholds.accel_x_max}
              onChange={(e) => handleChange('accel_x_max', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Tilting or shaking X axis beyond ±{thresholds.accel_x_max} m/s²</p>
          </div>

          {/* Accel Y Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Accel Y Longitudinal Tilt
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                ±{thresholds.accel_y_max} m/s²
              </Badge>
            </div>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.1"
              value={thresholds.accel_y_max}
              onChange={(e) => handleChange('accel_y_max', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Pitch tilt or surge on Y beyond ±{thresholds.accel_y_max} m/s²</p>
          </div>

          {/* Accel Z Deviation Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Accel Z Shock Deviation
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                Δ &gt; {thresholds.accel_z_dev_max} m/s²
              </Badge>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.2"
              value={thresholds.accel_z_dev_max}
              onChange={(e) => handleChange('accel_z_dev_max', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Deviation from 1G standard gravity (free-fall or shock)</p>
          </div>

          {/* Vibration RMS Threshold */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Vibrate className="w-3.5 h-3.5 text-purple-500" />
                Vibration RMS Limit
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-slate-700 font-bold bg-white">
                {thresholds.vibration_max} g
              </Badge>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.50"
              step="0.05"
              value={thresholds.vibration_max}
              onChange={(e) => handleChange('vibration_max', parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">High-frequency mechanical vibration limit</p>
          </div>
        </div>

        {/* Live Anomaly Trigger Injector */}
        <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Hardware Validation & Anomaly Testing
            </span>
            <p className="text-[11px] text-slate-600">
              Select an axis channel below to inject a verified physical anomaly pulse to MongoDB Atlas and view in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTestFeature}
              onChange={(e) => setSelectedTestFeature(e.target.value)}
              className="text-xs h-8 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="accel_x">↔️ Accel X Lateral Spike (3.85 m/s²)</option>
              <option value="accel_y">↕️ Accel Y Pitch Surge (3.65 m/s²)</option>
              <option value="accel_z">⬆️ Accel Z Shock (14.8 m/s²)</option>
              <option value="temperature">🌡️ Temp Thermal Excursion (38.5°C)</option>
              <option value="humidity">💧 Humidity Condensation (78.5%)</option>
              <option value="vibration_rms">📳 High Vibration Surge (0.85 g)</option>
            </select>

            <Button
              size="sm"
              onClick={handleTriggerTestAnomaly}
              disabled={isTriggering}
              className="text-xs h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium shrink-0"
            >
              {isTriggering ? (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5 animate-spin text-amber-400" />
                  Injecting...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Trigger Test Anomaly
                </>
              )}
            </Button>
          </div>
        </div>

        {triggerStatus && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{triggerStatus}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

