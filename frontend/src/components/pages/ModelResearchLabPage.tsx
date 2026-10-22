import { useState } from 'react';
import { FlaskConical, Send, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiService } from '@/services/api';
import { PredictionResponse } from '@/types/api';

export function ModelResearchLabPage() {
  const [modelName, setModelName] = useState('isolation_forest');
  const [deviceId, setDeviceId] = useState('lab-device-01');
  const [features, setFeatures] = useState({
    temperature: 45.0,
    humidity: 55.0,
    pressure: 101.3,
    vibration: 1.2,
    current: 12.5,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const handleTestInference = async () => {
    setLoading(true);
    try {
      const res = await apiService.predictSingle(deviceId, features, modelName);
      setResult(res);
    } catch (e) {
      alert(`Inference failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureChange = (name: string, value: number) => {
    setFeatures((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Model Research & Inference Lab</h2>
          <p className="text-xs text-slate-400">
            Interactive playground: adjust multivariate sensor values, run real inference, and test feature attribution models.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Input Telemetry Vector</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Model</label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  >
                    <option value="isolation_forest">Isolation Forest</option>
                    <option value="one_class_svm">One-Class SVM</option>
                    <option value="lof">Local Outlier Factor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Device ID</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white rounded p-2.5 border border-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* Channel Sliders */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Temperature (°C)</span>
                    <span className="font-mono text-white font-bold">{features.temperature}°C</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="0.5"
                    value={features.temperature}
                    onChange={(e) => handleFeatureChange('temperature', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Humidity (%)</span>
                    <span className="font-mono text-white font-bold">{features.humidity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={features.humidity}
                    onChange={(e) => handleFeatureChange('humidity', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Pressure (kPa)</span>
                    <span className="font-mono text-white font-bold">{features.pressure} kPa</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    step="0.1"
                    value={features.pressure}
                    onChange={(e) => handleFeatureChange('pressure', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Vibration (mm/s)</span>
                    <span className="font-mono text-white font-bold">{features.vibration} mm/s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.1"
                    value={features.vibration}
                    onChange={(e) => handleFeatureChange('vibration', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Current (Amperes)</span>
                    <span className="font-mono text-white font-bold">{features.current} A</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="0.2"
                    value={features.current}
                    onChange={(e) => handleFeatureChange('current', Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <Button
                onClick={handleTestInference}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs mt-2"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {loading ? 'Evaluating Model...' : 'Execute Model Inference'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Prediction Results Column */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Synchronous Inference Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  Adjust the telemetry sliders on the left and click "Execute Model Inference".
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">STATUS</span>
                      <span
                        className={`text-xl font-bold tracking-tight font-mono ${
                          result.is_anomaly ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {result.is_anomaly ? 'ANOMALY DETECTED' : 'NORMAL TELEMETRY'}
                      </span>
                    </div>
                    <Badge variant={result.is_anomaly ? 'destructive' : 'success'} className="text-xs">
                      {result.is_anomaly ? 'FLAGGED' : 'PASSED'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        Anomaly Score
                      </span>
                      <span className="text-2xl font-bold font-mono text-rose-400">
                        {(result.normalized_anomaly_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        Calibrated Threshold
                      </span>
                      <span className="text-2xl font-bold font-mono text-slate-300">
                        {(result.decision_threshold * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Feature Contribution Breakdown */}
                  {result.top_contributing_features && result.top_contributing_features.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Feature Attributions (Deviation from Normal Baseline)
                      </div>
                      <div className="space-y-2 pt-1">
                        {result.top_contributing_features.map((c) => (
                          <div key={c.feature} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-mono text-slate-300">{c.feature}</span>
                              <span className="font-mono text-rose-400 font-semibold">
                                {(c.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-rose-500 rounded-full"
                                style={{ width: `${Math.min(100, c.score * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
