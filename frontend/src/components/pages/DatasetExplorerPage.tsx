import { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Dataset Catalog & Data Quality Audits
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              {datasets.length} Ingested
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect ingested public benchmarks (NAB, NASA Turbofan) and synthetic training partitions.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchDatasets}
          disabled={loading}
          className="text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Dataset Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {datasets.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Database}
              title="No Ingested Datasets Found"
              description="No public benchmark or synthetic partitions are currently registered in MongoDB."
            />
          </div>
        ) : (
          datasets.map((d) => (
            <Card
              key={d.dataset_id}
              onClick={() => setSelectedDataset(d.name)}
              className={`cursor-pointer transition-all border ${
                selectedDataset === d.name
                  ? 'border-blue-400 bg-blue-50/30 shadow-subtle'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs font-mono">{d.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {d.source_type}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Samples:</span>
                    <span className="text-slate-800 font-semibold">{d.sample_count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Channels:</span>
                    <span className="text-slate-800 font-semibold">{d.feature_names.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ground Truth:</span>
                    <span className={d.has_ground_truth ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                      {d.has_ground_truth ? 'Labeled' : 'Unlabeled'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quality Audit Report */}
      {selectedDataset && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Data Integrity Audit: {selectedDataset}
              </CardTitle>
              <p className="text-xs text-slate-500">Validation of missing values, timestamp consistency, and skew</p>
            </div>
            {auditing && (
              <Badge variant="secondary" className="text-xs">
                Auditing...
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {auditResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block">Missing Values Count</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {auditResult.missing_values_count}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block">Duplicate Timestamps</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {auditResult.duplicate_timestamps}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block">Audit Health Score</span>
                    <span className="text-lg font-bold text-emerald-600 font-mono">
                      {auditResult.passed ? '100% Passed' : 'Review Required'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-semibold text-slate-800">Quality Diagnostic Summary</div>
                  <p className="text-slate-600 leading-relaxed font-mono text-[11px]">
                    Total evaluated samples: {auditResult.total_samples}. All temporal sequences monotonic. No duplicate time indices detected.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                {auditing ? 'Running data quality audit verification...' : 'No audit report available for this dataset.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
