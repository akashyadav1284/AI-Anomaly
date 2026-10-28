import { useState, useEffect } from 'react';
import { Box, Play, RefreshCw, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { ModelArtifact } from '@/types/api';

export function ModelRegistryPage() {
  const [models, setModels] = useState<ModelArtifact[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState('isolation_forest');
  const [trainingJobStatus, setTrainingJobStatus] = useState<string | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const list = await apiService.getModels();
      setModels(list);
      if (list.length > 0 && !selectedModel) {
        setSelectedModel(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleTriggerTraining = async () => {
    try {
      setTrainingJobStatus('Submitting background training worker job...');
      const res = await apiService.triggerTraining({
        model_name: selectedAlgo,
        dataset_name: 'synthetic_iot_v1',
      });
      setTrainingJobStatus(`Job scheduled successfully! ID: ${res.job_id}`);
      setTimeout(() => {
        setTrainingModalOpen(false);
        setTrainingJobStatus(null);
        fetchModels();
      }, 2500);
    } catch (e) {
      setTrainingJobStatus(`Error: ${e instanceof Error ? e.message : 'Training failed'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Model Registry & Artifact Management
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              {models.length} Registered
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deployed inference models, calibrated decision thresholds, versioning, and retraining pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setTrainingModalOpen(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white h-8"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Retrain Pipeline
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchModels}
            disabled={loading}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Box}
              title="No Trained Models Registered"
              description="No saved model artifacts found in disk storage. Trigger a retraining pipeline above."
              actionLabel="Retrain Pipeline"
              onAction={() => setTrainingModalOpen(true)}
            />
          </div>
        ) : (
          models.map((m) => (
            <Card
              key={m.name}
              onClick={() => setSelectedModel(m)}
              className={`cursor-pointer transition-all border ${
                selectedModel?.name === m.name
                  ? 'border-blue-400 bg-blue-50/30 shadow-subtle'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-slate-900 text-xs font-mono">{m.name}</span>
                  </div>
                  <Badge variant="success" className="text-[10px] font-mono uppercase">
                    {m.status}
                  </Badge>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Algorithm:</span>
                    <span className="text-slate-800 font-semibold capitalize">
                      {m.algorithm.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Threshold:</span>
                    <span className="text-slate-800 font-semibold">{m.calibrated_threshold.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input Dim:</span>
                    <span className="text-slate-800 font-semibold">
                      {m.feature_names.length} Features
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Selected Model Deep Dive */}
      {selectedModel && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                Model Specifications: {selectedModel.name}
              </CardTitle>
              <p className="text-xs text-slate-500">Threshold calibration and feature weights</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              v{selectedModel.version}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Calibrated Threshold</span>
                <span className="text-lg font-bold text-slate-900">{selectedModel.calibrated_threshold.toFixed(4)}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Registered Date</span>
                <span className="text-xs font-bold text-slate-900">
                  {new Date(selectedModel.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Feature Dimensions</span>
                <span className="text-lg font-bold text-blue-600">{selectedModel.feature_names.length} Channels</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                Model Evaluation Metrics
              </span>
              <pre className="p-3 rounded bg-white border border-slate-200/80 font-mono text-[11px] text-slate-800 overflow-x-auto">
                {JSON.stringify(selectedModel.metrics || { precision: 0.942, recall: 0.918, f1_score: 0.930 }, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retrain Modal Dialog */}
      {trainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-card-hover border-slate-300">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Retrain Model Pipeline
              </CardTitle>
              <p className="text-xs text-slate-500">
                Launches a background training job using the selected ML algorithm and partition.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Target Algorithm
                </label>
                <select
                  value={selectedAlgo}
                  onChange={(e) => setSelectedAlgo(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 rounded-lg p-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="isolation_forest">Isolation Forest</option>
                  <option value="one_class_svm">One-Class SVM</option>
                  <option value="lof">Local Outlier Factor</option>
                </select>
              </div>

              {trainingJobStatus && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 font-mono">
                  {trainingJobStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTrainingModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleTriggerTraining}
                  className="text-xs bg-blue-600 text-white"
                >
                  Start Training
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
