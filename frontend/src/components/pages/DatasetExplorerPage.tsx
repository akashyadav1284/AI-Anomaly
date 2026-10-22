import { useState, useEffect } from 'react';
import { Database, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiService } from '@/services/api';
import { DatasetItem, QualityAuditResponse } from '@/types/api';

export function DatasetExplorerPage() {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [auditResult, setAuditResult] = useState<QualityAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const list = await apiService.getDatasets();
      setDatasets(list);
      if (list.length > 0 && !selectedDataset) {
        setSelectedDataset(list[0].name);
      }
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async (name: string) => {
    if (!name) return;
    setAuditing(true);
    try {
      const res = await apiService.getDatasetAudit(name);
      setAuditResult(res);
    } catch {
      setAuditResult(null);
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (selectedDataset) {
      runAudit(selectedDataset);
    }
  }, [selectedDataset]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Dataset Explorer & Quality Audits</h2>
          <p className="text-xs text-slate-400">
            Inspect ingested public benchmarks (NAB, NASA Turbofan) and synthetic training partitions.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchDatasets} disabled={loading} className="text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Dataset Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {datasets.length === 0 ? (
          <div className="col-span-full p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No datasets currently registered in MongoDB.
          </div>
        ) : (
          datasets.map((d) => (
            <Card
              key={d.dataset_id}
              onClick={() => setSelectedDataset(d.name)}
              className={`cursor-pointer transition-all border-slate-800 ${
                selectedDataset === d.name
                  ? 'bg-blue-950/20 border-blue-500/80 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-sm text-white">{d.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {d.source_type}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {d.description || 'No description provided.'}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">SAMPLES</span>
                    {d.sample_count?.toLocaleString() ?? '—'}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CHANNELS</span>
                    {d.feature_names?.length ?? 0} features
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Data Quality & Schema Integrity Panel */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Data Quality & Preprocessing Audit: {selectedDataset || 'None'}
            </CardTitle>
            <p className="text-xs text-slate-400">
              Automated validation against NaN values, duplicate timestamps, and causal leakage
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => runAudit(selectedDataset)}
            disabled={auditing || !selectedDataset}
            className="text-xs"
          >
            <ShieldCheck className={`w-3.5 h-3.5 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
            Run Audit
          </Button>
        </CardHeader>
        <CardContent>
          {!auditResult ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Select a dataset or click "Run Audit" to inspect data quality.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Audit Status</span>
                  <Badge variant={auditResult.passed ? 'success' : 'destructive'} className="mt-1">
                    {auditResult.passed ? 'PASSED' : 'FLAGGED ISSUES'}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Missing / NaNs</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {auditResult.missing_values_count}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Duplicate Timestamps</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {auditResult.duplicate_timestamps}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Infinite Values</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {auditResult.infinite_values_count}
                  </span>
                </div>
              </div>

              {auditResult.issues.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-300 block">Identified Issues</span>
                  <div className="space-y-1.5">
                    {auditResult.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>
                          <strong>{issue.check}:</strong> {issue.detail}
                        </span>
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
  );
}
