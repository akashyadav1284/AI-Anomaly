import { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, Filter, Sparkles, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Anomaly Incident Triage & Explainability
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              {anomalies.length} Flagged
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Investigate flagged anomalies, model confidence thresholds, feature attribution, and audit review status.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchAnomalies}
          disabled={loading}
          className="text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-subtle text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-600 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="confirmed">Confirmed Anomaly</option>
            <option value="false_positive">False Positive</option>
          </select>
        </div>
      </div>

      {/* Master/Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Anomaly Incidents List */}
        <div className="lg:col-span-6 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Incident Register
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="No Incident Logs Found"
                  description="No anomalies match your active filter criteria."
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {anomalies.map((anom) => {
                    const isSelected = selectedAnomaly?.anomaly_id === anom.anomaly_id;
                    return (
                      <div
                        key={anom.anomaly_id}
                        onClick={() => setSelectedAnomaly(anom)}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-300 shadow-subtle'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-900 text-xs font-mono">
                            {anom.device_id}
                          </span>
                          <Badge
                            variant={
                              anom.severity === 'critical'
                                ? 'destructive'
                                : anom.severity === 'high'
                                ? 'warning'
                                : 'secondary'
                            }
                            className="text-[10px] uppercase font-mono"
                          >
                            {anom.severity}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>{new Date(anom.timestamp).toLocaleString()}</span>
                          <span className="font-semibold text-slate-800">
                            Confidence: {(anom.normalized_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Incident Deep-Dive */}
        <div className="lg:col-span-6 space-y-4">
          {selectedAnomaly ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Incident Forensic Analysis
                  </CardTitle>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    ID: {selectedAnomaly.anomaly_id}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs uppercase font-mono">
                  {selectedAnomaly.review_status.replace('_', ' ')}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Affected Channels */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Affected Sensor Channels
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnomaly.affected_features.map((feat) => (
                      <Badge key={feat} variant="secondary" className="font-mono text-xs capitalize">
                        {feat}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Model Attribution & Explainability */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Model Decision Attribution
                  </div>

                  {explanationObj && explanationObj.top_contributions ? (
                    <div className="space-y-1.5 pt-1">
                      {explanationObj.top_contributions.map((contrib) => {
                        const pct = Math.min(100, Math.max(0, contrib.score * 100));
                        return (
                          <div key={contrib.feature} className="space-y-0.5">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="text-slate-600 capitalize">{contrib.feature}</span>
                              <span className="font-semibold text-slate-900">{pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Standard isolation partition score. Multivariate anomaly detected across active telemetry channels.
                    </p>
                  )}
                </div>

                {/* Triage Decision Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 text-xs font-medium">Update Status:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus('under_review')}
                    disabled={updatingStatus}
                    className="text-xs h-7.5"
                  >
                    Under Review
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus('confirmed')}
                    disabled={updatingStatus}
                    className="text-xs h-7.5 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Confirm Anomaly
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus('false_positive')}
                    disabled={updatingStatus}
                    className="text-xs h-7.5 text-emerald-700 hover:bg-emerald-50"
                  >
                    False Positive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="Select an Incident"
              description="Choose an incident record from the register to inspect feature values and explainability."
            />
          )}
        </div>
      </div>
    </div>
  );
}
