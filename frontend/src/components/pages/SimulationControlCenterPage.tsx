import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Activity,
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
        anomaly_type: 'spike',
        target_channels: ['vibration'],
        magnitude: 4.0,
        duration_steps: 5,
        start_step: 15,
      },
    ]);
  };

  const removeInjection = (index: number) => {
    setInjections((prev) => prev.filter((_, i) => i !== index));
  };

  const isRunning = status?.status === 'running';
  const isPaused = status?.status === 'paused';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Software IoT Simulation Control Center</h2>
          <p className="text-xs text-slate-400">
            Configure multivariate virtual sensors, frequency parameters, playback speed, and inject controlled synthetic anomalies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Button size="sm" variant="outline" onClick={handlePause} disabled={actionLoading} className="text-xs">
                <Pause className="w-3.5 h-3.5 mr-1" /> Pause
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop} disabled={actionLoading} className="text-xs">
                <Square className="w-3.5 h-3.5 mr-1" /> Terminate Session
              </Button>
            </>
          ) : isPaused ? (
            <>
              <Button size="sm" onClick={handleResume} disabled={actionLoading} className="text-xs bg-emerald-600">
                <Play className="w-3.5 h-3.5 mr-1" /> Resume
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop} disabled={actionLoading} className="text-xs">
                <Square className="w-3.5 h-3.5 mr-1" /> Terminate
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleStart} disabled={actionLoading} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
              <Play className="w-3.5 h-3.5 mr-1" /> Launch Simulation
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleReset} disabled={actionLoading} className="text-xs text-slate-400">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Real-time Status Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Session Status"
          value={(status?.status || 'stopped').toUpperCase()}
          subtitle={`Session: ${status?.simulation_id || 'None'}`}
          badge={
            <Badge variant={isRunning ? 'success' : isPaused ? 'warning' : 'outline'} className="capitalize">
              {status?.status || 'stopped'}
            </Badge>
          }
        />
        <MetricCard
          title="Execution Uptime"
          value={`${status?.uptime_seconds ?? 0}s`}
          subtitle="Continuous generation time"
          icon={Activity}
        />
        <MetricCard
          title="Telemetry Generated"
          value={status?.metrics?.generated_count ?? 0}
          subtitle={`Persisted: ${status?.metrics?.persisted_count ?? 0}`}
        />
        <MetricCard
          title="Connected WS Clients"
          value={status?.connected_ws_clients ?? 0}
          subtitle="Listening on WebSocket feed"
        />
      </div>

      {/* Control & Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulation Parameters */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Simulation Setup & Runtime Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Virtual Devices (comma separated)</label>
                <input
                  type="text"
                  value={devicesInput}
                  onChange={(e) => setDevicesInput(e.target.value)}
                  disabled={isRunning || isPaused}
                  className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Sampling Frequency (Hz)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={samplingRate}
                    onChange={(e) => setSamplingRate(Number(e.target.value))}
                    disabled={isRunning || isPaused}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Playback Speed Multiplier</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    disabled={isRunning || isPaused}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Random Seed (RNG)</label>
                  <input
                    type="number"
                    value={randomSeed}
                    onChange={(e) => setRandomSeed(Number(e.target.value))}
                    disabled={isRunning || isPaused}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Inference Model</label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    disabled={isRunning || isPaused}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  >
                    <option value="isolation_forest">Isolation Forest</option>
                    <option value="one_class_svm">One-Class SVM</option>
                    <option value="lof">Local Outlier Factor</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="persist-db"
                  checked={persistToDb}
                  onChange={(e) => setPersistToDb(e.target.checked)}
                  disabled={isRunning || isPaused}
                  className="rounded bg-slate-800 border-slate-700"
                />
                <label htmlFor="persist-db" className="text-xs text-slate-300">
                  Persist generated telemetry & flagged anomalies directly into MongoDB
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Anomaly Injections */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Controlled Anomaly Injections</CardTitle>
                <p className="text-xs text-slate-400">Inject spikes, drifts, noise, or freezes at designated step offsets</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addInjection}
                disabled={isRunning || isPaused}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Injection
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {injections.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No anomaly injections configured. The simulator will stream normal baseline telemetry.
                </div>
              ) : (
                injections.map((inj, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Injection #{idx + 1}</span>
                      <button
                        onClick={() => removeInjection(idx)}
                        disabled={isRunning || isPaused}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">TYPE</span>
                        <select
                          value={inj.anomaly_type}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInjections((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, anomaly_type: val } : item)),
                            );
                          }}
                          disabled={isRunning || isPaused}
                          className="bg-slate-800 text-[11px] text-white rounded p-1 w-full border border-slate-700"
                        >
                          <option value="spike">Spike</option>
                          <option value="drift">Drift</option>
                          <option value="noise">Noise</option>
                          <option value="freeze">Freeze</option>
                          <option value="regime_shift">Regime Shift</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">OFFSET (STEP)</span>
                        <input
                          type="number"
                          value={inj.start_step}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setInjections((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, start_step: val } : item)),
                            );
                          }}
                          disabled={isRunning || isPaused}
                          className="bg-slate-800 text-[11px] text-white rounded p-1 w-full border border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">MAGNITUDE</span>
                        <input
                          type="number"
                          step="0.5"
                          value={inj.magnitude}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setInjections((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, magnitude: val } : item)),
                            );
                          }}
                          disabled={isRunning || isPaused}
                          className="bg-slate-800 text-[11px] text-white rounded p-1 w-full border border-slate-700"
                        />
                      </div>
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
