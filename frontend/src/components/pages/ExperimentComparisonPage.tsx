import { useState, useEffect } from 'react';
import { Plus, RefreshCw, GitCompare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { ExperimentItem } from '@/types/api';

export function ExperimentComparisonPage() {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [selectedAlgo, setSelectedAlgo] = useState('isolation_forest');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const list = await apiService.getExperiments();
      setExperiments(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpName.trim()) return;
    setIsSubmitting(true);
    try {
      await apiService.createExperiment({
        experiment_name: newExpName.trim(),
        dataset_id: 'synthetic_iot_v1',
        model_name: selectedAlgo,
      });
      setNewExpName('');
      fetchExperiments();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Experiment Tracking & Model Comparison
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              {experiments.length} Runs
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare offline model runs, hyperparameter sweeps, and out-of-sample evaluation metrics.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchExperiments}
          disabled={loading}
          className="text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* New Experiment Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Create New Experiment Run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateExperiment} className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Experiment run name (e.g. IF_contam_0.05)"
              value={newExpName}
              onChange={(e) => setNewExpName(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-[220px] font-mono"
            />
            <select
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            >
              <option value="isolation_forest">Isolation Forest</option>
              <option value="one_class_svm">One-Class SVM</option>
              <option value="lof">Local Outlier Factor</option>
            </select>
            <Button
              type="submit"
              disabled={isSubmitting || !newExpName.trim()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {isSubmitting ? 'Recording Run...' : 'Register Run'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Experiments Comparison Matrix Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Benchmark Evaluation Matrix
            </CardTitle>
            <p className="text-xs text-slate-500">Cross-algorithm precision, recall, and F1 scores</p>
          </div>
        </CardHeader>
        <CardContent>
          {experiments.length === 0 ? (
            <EmptyState
              icon={GitCompare}
              title="No Experiment Runs Recorded"
              description="Register an offline experiment above to benchmark model metrics."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Run ID / Name</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Precision</th>
                    <th className="py-2.5 px-3">Recall</th>
                    <th className="py-2.5 px-3">F1 Score</th>
                    <th className="py-2.5 px-3">PR-AUC</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {experiments.map((exp) => (
                    <tr key={exp.experiment_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {exp.name || exp.experiment_id}
                      </td>
                      <td className="py-2.5 px-3 capitalize text-slate-700">
                        {exp.model_name.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.metrics?.precision !== undefined
                          ? exp.metrics.precision.toFixed(3)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.metrics?.recall !== undefined
                          ? exp.metrics.recall.toFixed(3)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {exp.metrics?.f1_score !== undefined ? exp.metrics.f1_score.toFixed(3) : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.metrics?.pr_auc !== undefined
                          ? exp.metrics.pr_auc.toFixed(3)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={exp.status === 'completed' ? 'success' : 'outline'}
                          className="text-[10px] uppercase font-mono"
                        >
                          {exp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
