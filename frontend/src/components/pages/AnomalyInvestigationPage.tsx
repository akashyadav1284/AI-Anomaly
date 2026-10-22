import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Filter, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiService } from '@/services/api';
import { AnomalyRecord, PredictionExplanation } from '@/types/api';

export function AnomalyInvestigationPage() {
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAnomalies({
        severity: severityFilter === 'all' ? undefined : severityFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      });
      setAnomalies(res.items);
      if (res.items.length > 0 && !selectedAnomaly) {
        setSelectedAnomaly(res.items[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [severityFilter, statusFilter]);

  const handleUpdateStatus = async (newStatus: 'under_review' | 'confirmed' | 'false_positive') => {
    if (!selectedAnomaly) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiService.updateAnomalyStatus(selectedAnomaly.anomaly_id, newStatus);
      setSelectedAnomaly(updated);
      setAnomalies((prev) =>
        prev.map((a) => (a.anomaly_id === updated.anomaly_id ? updated : a)),
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const explanationObj =
    typeof selectedAnomaly?.explanation === 'object'
      ? (selectedAnomaly?.explanation as PredictionExplanation)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Anomaly Incident Triage & Explainability</h2>
          <p className="text-xs text-slate-400">
            Investigate flagged anomalies, model confidence thresholds, feature attribution, and audit review status.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAnomalies} disabled={loading} className="text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-800 text-white rounded px-2.5 py-1 border border-slate-700 outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 text-white rounded px-2.5 py-1 border border-slate-700 outline-none"
          >
            <option value="all">All Review States</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="confirmed">Confirmed</option>
            <option value="false_positive">False Positive</option>
          </select>
        </div>
      </div>

      {/* Main Split View: Incident List & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Incident List Table */}
        <div className="lg:col-span-7">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">Incident Queue</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                {anomalies.length} TOTAL
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 sticky top-0 text-slate-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Device</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {anomalies.map((a) => {
                      const isSelected = selectedAnomaly?.anomaly_id === a.anomaly_id;
                      return (
                        <tr
                          key={a.anomaly_id}
                          onClick={() => setSelectedAnomaly(a)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-600/15 border-l-2 border-blue-500' : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-white">{a.device_id}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            {new Date(a.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                            {(a.normalized_score * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                a.severity === 'critical' || a.severity === 'high'
                                  ? 'destructive'
                                  : 'warning'
                              }
                              className="text-[10px] uppercase"
                            >
                              {a.severity}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] text-slate-400 capitalize">
                              {a.review_status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Inspection & Explanation Panel */}
        <div className="lg:col-span-5">
          {selectedAnomaly ? (
            <Card className="bg-slate-900/60 border-slate-800 sticky top-6">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <CardTitle className="text-sm font-bold text-white">
                      Incident {selectedAnomaly.anomaly_id}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selectedAnomaly.model_name}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  Detected on {new Date(selectedAnomaly.timestamp).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Score vs Threshold Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">
                      Anomaly Likelihood
                    </span>
                    <span className="text-xl font-bold font-mono text-rose-400">
                      {(selectedAnomaly.normalized_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">
                      Decision Threshold
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-300">
                      {(selectedAnomaly.threshold * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Explainability Breakdown */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Model Explainability Attribution
                  </div>
                  {explanationObj ? (
                    <div className="space-y-2 text-xs">
                      <p className="text-[11px] text-slate-400">
                        Primary driver:{' '}
                        <span className="text-amber-400 font-semibold font-mono">
                          {explanationObj.primary_contributing_feature}
                        </span>
                      </p>
                      <div className="space-y-1.5">
                        {explanationObj.top_contributions.map((c) => (
                          <div key={c.feature} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-300 font-mono">{c.feature}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">
                                Dev: {c.deviation?.toFixed(2) ?? '—'}σ
                              </span>
                              <span className="text-rose-400 font-mono font-semibold">
                                {(c.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {typeof selectedAnomaly.explanation === 'string'
                        ? selectedAnomaly.explanation
                        : 'No detailed feature attribution available.'}
                    </p>
                  )}
                </div>

                {/* Affected Channels */}
                <div>
                  <span className="text-[11px] text-slate-400 font-mono uppercase block mb-1.5">
                    Flagged Channels
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAnomaly.affected_features.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Review Workflow Controls */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Update Investigation Status:
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingStatus || selectedAnomaly.review_status === 'under_review'}
                      onClick={() => handleUpdateStatus('under_review')}
                      className="text-xs flex-1"
                    >
                      Under Review
                    </Button>
                    <Button
                      size="sm"
                      disabled={updatingStatus || selectedAnomaly.review_status === 'confirmed'}
                      onClick={() => handleUpdateStatus('confirmed')}
                      className="text-xs flex-1 bg-rose-600 hover:bg-rose-500 text-white"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={updatingStatus || selectedAnomaly.review_status === 'false_positive'}
                      onClick={() => handleUpdateStatus('false_positive')}
                      className="text-xs flex-1 text-slate-400 hover:text-white"
                    >
                      Dismiss (FP)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/60 border-slate-800 p-8 text-center text-xs text-slate-500">
              Select an incident from the queue to inspect root-cause attribution.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
