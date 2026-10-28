import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Activity,
  Sliders,
  Settings,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { apiService } from '@/services/api';
import {
  AnomalyInjectionConfig,
  SimulatorStartRequest,
  SimulatorStatusResponse,
} from '@/types/api';

export function SimulationControlCenterPage() {
  const [status, setStatus] = useState<SimulatorStatusResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Configuration form state
  const [samplingRate, setSamplingRate] = useState(2.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [randomSeed, setRandomSeed] = useState(42);
  const [modelName, setModelName] = useState('isolation_forest');
  const [persistToDb, setPersistToDb] = useState(true);
  const [devicesInput, setDevicesInput] = useState('sensor-01, sensor-02');
  const [injections, setInjections] = useState<AnomalyInjectionConfig[]>([
    {
      anomaly_type: 'spike',
      target_channels: ['temperature'],
      magnitude: 5.0,
      duration_steps: 5,
      start_step: 10,
    },
  ]);

  const fetchStatus = async () => {
    try {
      const s = await apiService.getSimulatorStatus();
      setStatus(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const devList = devicesInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const req: SimulatorStartRequest = {
        devices: devList.length > 0 ? devList : ['sensor-01'],
        sampling_rate_hz: Number(samplingRate),
        playback_speed: Number(playbackSpeed),
        model_name: modelName,
        random_seed: Number(randomSeed),
        persist_to_db: persistToDb,
        anomaly_injections: injections,
      };
      await apiService.startSimulator(req);
      await fetchStatus();
    } catch (e) {
      alert(`Start failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await apiService.pauseSimulator();
      await fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await apiService.resumeSimulator();
      await fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await apiService.stopSimulator();
      await fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      await apiService.resetSimulator();
      await fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const addInjection = () => {
    setInjections((prev) => [
      ...prev,
      {
        anomaly_type: 'drift',
        target_channels: ['vibration'],
        magnitude: 3.0,
        duration_steps: 10,
        start_step: 20,
      },
    ]);
  };

  const removeInjection = (idx: number) => {
    setInjections((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              IoT Simulation & Fault Injection Control
            </h2>
            <Badge
              variant={
                status?.status === 'running'
                  ? 'success'
                  : status?.status === 'paused'
                  ? 'warning'
                  : 'secondary'
              }
              className="capitalize text-xs font-mono"
            >
              Session: {status?.status || 'stopped'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure virtual industrial sensor devices, synthetic disturbance injectors, and playback frequency.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          {status?.status === 'running' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePause}
              disabled={actionLoading}
              className="text-xs"
            >
              <Pause className="w-3.5 h-3.5 mr-1 text-amber-600" /> Pause
            </Button>
          ) : status?.status === 'paused' ? (
            <Button
              size="sm"
              onClick={handleResume}
              disabled={actionLoading}
              className="text-xs bg-emerald-600 text-white"
            >
              <Play className="w-3.5 h-3.5 mr-1" /> Resume
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={actionLoading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-3.5 h-3.5 mr-1" /> Launch Session
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleStop}
            disabled={actionLoading || status?.status === 'stopped'}
            className="text-xs text-rose-600 hover:text-rose-700"
          >
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={actionLoading}
            className="text-xs text-slate-600 hover:text-slate-900"
            title="Reset telemetry counters and devices"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Simulator Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Generated Frames"
          value={status?.metrics?.generated_count ?? 0}
          subtitle="Synthesized telemetry frames"
          icon={Activity}
        />
        <MetricCard
          title="Inferences Run"
          value={status?.metrics?.inferred_count ?? 0}
          subtitle="Model predictions executed"
          icon={Zap}
        />
        <MetricCard
          title="Detected Anomalies"
          value={status?.metrics?.anomalies_detected ?? 0}
          subtitle="Outliers flagged"
          icon={Sliders}
        />
        <MetricCard
          title="Avg Inference Time"
          value={
            status?.metrics?.avg_latency_ms
              ? `${status.metrics.avg_latency_ms.toFixed(2)} ms`
              : '0.00 ms'
          }
          subtitle={`Throughput: ${(status?.metrics?.throughput_rps || 0).toFixed(1)} rps`}
          icon={Settings}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Session Configuration Card */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Simulation Parameters & Target Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Virtual Devices (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={devicesInput}
                    onChange={(e) => setDevicesInput(e.target.value)}
                    disabled={status?.status === 'running'}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Active ML Inference Model
                  </label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    disabled={status?.status === 'running'}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="isolation_forest">Isolation Forest (v1.0.0)</option>
                    <option value="one_class_svm">One-Class SVM (v1.0.0)</option>
                    <option value="lof">Local Outlier Factor (v1.0.0)</option>
                    <option value="autoencoder">Deep Autoencoder (PyTorch)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Sampling Rate (Hz)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    value={samplingRate}
                    onChange={(e) => setSamplingRate(Number(e.target.value))}
                    disabled={status?.status === 'running'}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Playback Speed (x)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    disabled={status?.status === 'running'}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Random Seed
                  </label>
                  <input
                    type="number"
                    value={randomSeed}
                    onChange={(e) => setRandomSeed(Number(e.target.value))}
                    disabled={status?.status === 'running'}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="persistCheck"
                  checked={persistToDb}
                  onChange={(e) => setPersistToDb(e.target.checked)}
                  disabled={status?.status === 'running'}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="persistCheck" className="text-xs text-slate-700 font-medium">
                  Persist generated telemetry & inference records to MongoDB
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Anomaly Injections Config Card */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Disturbance & Fault Injections
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={addInjection}
                disabled={status?.status === 'running'}
                className="text-xs h-7 px-2"
              >
                <Plus className="w-3 h-3 mr-1 text-blue-600" /> Add Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {injections.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No anomaly injections configured (Clean stream mode).
                </div>
              ) : (
                injections.map((inj, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/90 text-xs space-y-2 relative"
                  >
                    <button
                      onClick={() => removeInjection(idx)}
                      disabled={status?.status === 'running'}
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-rose-600"
                      title="Remove injection rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 uppercase tracking-wider text-[10px]">
                        Fault #{idx + 1}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {inj.anomaly_type}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                      <div>Channel: {inj.target_channels.join(', ')}</div>
                      <div>Magnitude: {inj.magnitude}x</div>
                      <div>Start Step: {inj.start_step ?? 0}</div>
                      <div>Duration: {inj.duration_steps ?? 5} steps</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
