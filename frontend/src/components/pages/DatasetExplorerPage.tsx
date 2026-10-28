import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database,
  ShieldCheck,
  RefreshCw,
  UploadCloud,
  AlertTriangle,
  XCircle,
  Sliders,
  Sparkles,
  BarChart3,
  Layers,
  Search,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { DatasetItem, QualityAuditResponse } from '@/types/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export function DatasetExplorerPage() {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [auditResult, setAuditResult] = useState<QualityAuditResponse | null>(null);
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, any>[] }>({
    columns: [],
    rows: [],
  });
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'catalog' | 'preview' | 'audit' | 'preprocess' | 'generate'>('catalog');

  // Modal / Generator State
  const [isGenerating, setIsGenerating] = useState(false);
  const [synthForm, setSynthForm] = useState({
    dataset_name: 'Synthetic_Turbine_Cluster',
    description: 'High-frequency vibration & thermal stress simulation',
    device_count: 2,
    samples_per_device: 1500,
    sampling_freq: '1min',
    inject_anomalies: true,
    anomaly_rate: 0.04,
    random_seed: 42,
  });

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadSource] = useState('generic');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preprocessing State
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [preprocessForm, setPreprocessForm] = useState({
    handle_missing: 'forward_fill',
    drop_duplicates: true,
    normalize_features: true,
    train_split_ratio: 0.7,
    val_split_ratio: 0.15,
  });
  const [preprocessResult, setPreprocessResult] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const res = await apiService.getDatasets({
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        search: searchQuery.trim() || undefined,
        page_size: 50,
      });
      setDatasets(res.items);
      setTotalCount(res.total);

      if (res.items.length > 0) {
        if (!selectedDataset || !res.items.some((d) => d.dataset_id === selectedDataset.dataset_id)) {
          setSelectedDataset(res.items[0]);
        }
      } else {
        setSelectedDataset(null);
      }
    } catch {
      showToast('Error syncing dataset catalog from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [sourceFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDatasets();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // When selected dataset changes, load its preview & audit findings
  useEffect(() => {
    if (!selectedDataset) {
      setPreviewData({ columns: [], rows: [] });
      setAuditResult(null);
      return;
    }

    const loadDetails = async () => {
      setLoadingPreview(true);
      try {
        const p = await apiService.getDatasetPreview(selectedDataset.dataset_id, 35);
        setPreviewData({
          columns: p.columns || [],
          rows: p.preview || [],
        });
      } catch {
        setPreviewData({ columns: [], rows: [] });
      } finally {
        setLoadingPreview(false);
      }

      try {
        const audit = await apiService.getDatasetAudit(selectedDataset.dataset_id);
        setAuditResult(audit);
      } catch {
        setAuditResult(null);
      }
    };
    loadDetails();
  }, [selectedDataset?.dataset_id]);

  const handleRunAudit = async () => {
    if (!selectedDataset) return;
    setAuditing(true);
    try {
      const audit = await apiService.getDatasetAudit(selectedDataset.dataset_id);
      setAuditResult(audit);
      showToast(`Data quality audit executed for ${selectedDataset.name}`);
    } catch {
      showToast('Audit execution failed');
    } finally {
      setAuditing(false);
    }
  };

  const handleCreateSynthetic = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const newDs = await apiService.generateSyntheticDataset(synthForm);
      showToast(`Generated and registered '${newDs.name}' (${newDs.row_count} rows)`);
      setActiveTab('catalog');
      await fetchDatasets();
      setSelectedDataset(newDs);
    } catch {
      showToast('Error generating synthetic telemetry dataset');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Please select a .csv or .parquet file');
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('dataset_name', uploadName || uploadFile.name.replace(/\.[^/.]+$/, ''));
      if (uploadDesc) fd.append('description', uploadDesc);
      fd.append('source_type', uploadSource);

      const created = await apiService.uploadDatasetFile(fd);
      showToast(`Uploaded and cataloged '${created.name}' successfully!`);
      setUploadFile(null);
      setUploadName('');
      setUploadDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('catalog');
      await fetchDatasets();
      setSelectedDataset(created);
    } catch (err: any) {
      showToast(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreprocessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDataset) return;
    setIsPreprocessing(true);
    try {
      const res = await apiService.preprocessDataset({
        dataset_id: selectedDataset.dataset_id,
        handle_missing: preprocessForm.handle_missing,
        drop_duplicates: preprocessForm.drop_duplicates,
        normalize_features: preprocessForm.normalize_features,
        train_split_ratio: preprocessForm.train_split_ratio,
        val_split_ratio: preprocessForm.val_split_ratio,
      });
      setPreprocessResult(res);
      showToast(`Preprocessing completed: ${res.final_rows} rows ready`);
    } catch {
      showToast('Preprocessing failed');
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handleDelete = async (datasetId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete dataset '${name}'?`)) return;
    try {
      await apiService.deleteDataset(datasetId);
      showToast(`Dataset '${name}' removed.`);
      fetchDatasets();
    } catch {
      showToast('Delete operation failed');
    }
  };

  // KPI Computations
  const stats = useMemo(() => {
    const totalDatasets = totalCount || datasets.length;
    let totalRows = 0;
    let labeledCount = 0;
    const allFeatures = new Set<string>();

    datasets.forEach((d) => {
      totalRows += d.row_count || 0;
      if (d.label_availability) labeledCount++;
      (d.feature_names || []).forEach((f) => allFeatures.add(f));
    });

    return {
      totalDatasets,
      totalRows,
      labeledCount,
      uniqueFeaturesCount: allFeatures.size,
    };
  }, [datasets, totalCount]);

  // Chart Telemetry Formatter
  const chartData = useMemo(() => {
    if (!previewData.rows || previewData.rows.length === 0) return [];
    return previewData.rows.slice(0, 30).map((r, i) => {
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : `Pt ${i + 1}`;
      return {
        time: ts,
        temperature: r.temperature ?? r.features?.temperature ?? 0,
        humidity: r.humidity ?? r.features?.humidity ?? 0,
        pressure: r.pressure ?? r.features?.pressure ?? 0,
        vibration: r.vibration ?? r.features?.vibration ?? 0,
        current: r.current ?? r.features?.current ?? 0,
        value: r.value ?? 0,
      };
    });
  }, [previewData]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-xl text-xs font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Database className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Lab Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Dataset Intelligence & Data Quality Lab
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 font-mono text-slate-700 font-medium">
              {stats.totalDatasets} Registered Datasets
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Multi-modal data ingestion engine supporting synthetic physics generators, NAB benchmarks, CSV/Parquet uploads, automated quality audits, and leakage-proof split preparation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDatasets}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setActiveTab('generate')}
            className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Synthetic
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab('preprocess')}
            className="text-xs h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Sliders className="w-3.5 h-3.5" />
            Preprocess Lab
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Catalog Datasets</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.totalDatasets}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Active telemetry partitions</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Records</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.totalRows.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Sensor observations</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Unique Features</span>
            <BarChart3 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.uniqueFeaturesCount}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Physical sensor channels</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ground Truth Labels</span>
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{stats.labeledCount}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Supervised benchmarks</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'catalog'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Catalog & Preview
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Data Quality Audits
        </button>
        <button
          onClick={() => setActiveTab('preprocess')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'preprocess'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Preprocessing Lab
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'generate'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-blue-600 hover:bg-blue-50'
          }`}
        >
          + Generate Synthetic
        </button>
      </div>

      {/* TAB 1: CATALOG & PREVIEW */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Dataset List */}
          <div className="lg:col-span-5 space-y-3">
            <Card className="border border-slate-200/90 shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50/60 border-b border-slate-200 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Dataset Catalog
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="text-[11px] font-mono bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700"
                  >
                    <option value="all">All Sources</option>
                    <option value="synthetic">Synthetic</option>
                    <option value="nab">NAB Benchmark</option>
                    <option value="nasa">NASA SMAP</option>
                    <option value="generic">CSV Uploads</option>
                  </select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Search */}
                <div className="p-3 border-b border-slate-100 bg-white">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Filter dataset by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {loading && datasets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading dataset registry...
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={Database}
                      title="No Datasets Cataloged"
                      description="Click '+ Generate Synthetic' or upload a CSV file to register a dataset."
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                    {datasets.map((d) => {
                      const isSelected = selectedDataset?.dataset_id === d.dataset_id;
                      return (
                        <div
                          key={d.dataset_id}
                          onClick={() => setSelectedDataset(d)}
                          className={`p-3.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900 text-xs font-mono truncate">
                              {d.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-mono bg-white border-slate-200 text-slate-600"
                            >
                              {d.source}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                            {d.description || 'No description provided'}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span>{d.row_count.toLocaleString()} rows</span>
                            <span>{d.feature_names?.length || 0} features</span>
                            <span className={d.label_availability ? 'text-rose-600 font-semibold' : 'text-slate-400'}>
                              {d.label_availability ? 'Labeled' : 'Unlabeled'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Upload Card */}
            <Card className="border border-slate-200/90 shadow-sm p-4 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                Quick CSV / Parquet Upload
              </span>
              <form onSubmit={handleUploadSubmit} className="space-y-2.5">
                <input
                  type="file"
                  accept=".csv,.parquet"
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600 w-full file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <input
                  type="text"
                  placeholder="Dataset Name (e.g. Pump_Sensors_April)"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="w-full text-xs h-7.5 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {isUploading ? 'Uploading & Auditing...' : 'Upload & Catalog'}
                </Button>
              </form>
            </Card>
          </div>

          {/* RIGHT: Selected Dataset Details & Visuals */}
          <div className="lg:col-span-7 space-y-4">
            {selectedDataset ? (
              <div className="space-y-4">
                {/* Metadata Card */}
                <Card className="border border-slate-200/90 shadow-sm bg-white">
                  <CardHeader className="py-3.5 px-5 bg-slate-50/60 border-b border-slate-200 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        {selectedDataset.name}
                      </CardTitle>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        ID: {selectedDataset.dataset_id} | Storage: {selectedDataset.storage_path || 'Mongo Virtual'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRunAudit}
                        disabled={auditing}
                        className="text-xs h-7.5 border-slate-200 gap-1 text-slate-700"
                      >
                        <ShieldCheck className={`w-3.5 h-3.5 ${auditing ? 'animate-spin text-blue-600' : 'text-emerald-600'}`} />
                        Run Audit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(selectedDataset.dataset_id, selectedDataset.name)}
                        className="text-xs h-7.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-xs">
                    {/* Channel Tag Badges */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                        Active Features ({selectedDataset.feature_names?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedDataset.feature_names || []).map((f) => (
                          <Badge key={f} variant="secondary" className="font-mono text-xs capitalize bg-slate-100 text-slate-700">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Sensor Signal Waveform Preview */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Telemetry Time-Series Preview
                      </span>
                      <div className="h-44 w-full bg-slate-50/50 rounded-xl border border-slate-200/80 p-2">
                        {loadingPreview ? (
                          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                            <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> Loading traces...
                          </div>
                        ) : chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                              <Legend wrapperStyle={{ fontSize: '10px' }} />
                              <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Temp" />
                              <Line type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Humidity" />
                              <Line type="monotone" dataKey="vibration" stroke="#10b981" strokeWidth={1.5} dot={false} name="Vibration" />
                              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Metric" />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
                            No telemetry stream available
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Data Preview Table */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Tabular Sample Rows (First {previewData.rows.length})
                      </span>
                      <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                        <table className="w-full text-left border-collapse text-[11px] font-mono">
                          <thead className="bg-slate-100 text-slate-600 sticky top-0">
                            <tr>
                              {previewData.columns.slice(0, 7).map((col) => (
                                <th key={col} className="p-2 border-b border-slate-200 capitalize">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {previewData.rows.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                {previewData.columns.slice(0, 7).map((col) => (
                                  <td key={col} className="p-2 truncate max-w-[120px]">
                                    {typeof row[col] === 'number'
                                      ? row[col].toFixed(3)
                                      : String(row[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-slate-200 p-12 text-center bg-white">
                <EmptyState
                  icon={Database}
                  title="Select a Dataset"
                  description="Choose a dataset from the catalog on the left to inspect its schema, sensor traces, and preview rows."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DATA QUALITY AUDIT FINDINGS */}
      {activeTab === 'audit' && (
        <Card className="border border-slate-200/90 shadow-sm bg-white p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Data Quality & Anomaly Integrity Audit Report
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dataset target: <span className="font-semibold text-slate-800 font-mono">{selectedDataset?.name || 'None selected'}</span>
              </p>
            </div>

            <Button
              size="sm"
              onClick={handleRunAudit}
              disabled={auditing || !selectedDataset}
              className="text-xs h-8 bg-slate-900 text-white hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
              Re-run Audit Engine
            </Button>
          </div>

          {auditResult ? (
            <div className="space-y-6 text-xs">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Audit Verification</span>
                  <span className={`text-base font-bold font-mono ${auditResult.is_valid !== false ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {auditResult.is_valid !== false ? 'PASSED CLEAN' : 'WARNINGS FOUND'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Audited Rows</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {(auditResult.row_count || selectedDataset?.row_count || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Duplicate Rows</span>
                  <span className="text-base font-bold text-slate-700 font-mono">
                    {auditResult.duplicate_rows_count ?? 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Ground Truth Anomalies</span>
                  <span className="text-base font-bold text-rose-600 font-mono">
                    {auditResult.anomaly_summary?.total_anomalies ?? 0} (
                    {((auditResult.anomaly_summary?.anomaly_ratio ?? 0) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Missing Values by Column */}
              {auditResult.missing_values_by_column && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Null / Missing Value Distribution by Channel
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                    {Object.entries(auditResult.missing_values_by_column).map(([col, cnt]) => (
                      <div key={col} className="p-2 rounded bg-slate-50 border border-slate-100 flex justify-between">
                        <span className="text-slate-600 truncate mr-2">{col}:</span>
                        <span className={cnt > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                          {cnt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues / Errors List */}
              {auditResult.errors && auditResult.errors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Validation Errors & Schema Inconsistencies ({auditResult.errors.length})
                  </span>
                  <div className="space-y-1.5">
                    {auditResult.errors.map((err, i) => (
                      <div key={i} className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{err.check_name || err.check || 'Error'}: </span>
                          <span>{err.message || err.detail}</span>
                          {err.column && <span className="font-mono text-xs ml-1">(Column: {err.column})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Click "Re-run Audit Engine" to generate a real-time data quality check for this dataset.
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: PREPROCESSING LAB */}
      {activeTab === 'preprocess' && (
        <Card className="border border-slate-200/90 shadow-sm bg-white p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Time-Series Data Preprocessing & Leakage-Proof Splitting
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fit transformations only on train splits, impute missing values, and configure chronological train/val/test splits.
            </p>
          </div>

          <form onSubmit={handlePreprocessSubmit} className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target Dataset</label>
              <select
                value={selectedDataset?.dataset_id || ''}
                onChange={(e) => {
                  const d = datasets.find((x) => x.dataset_id === e.target.value);
                  if (d) setSelectedDataset(d);
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
              >
                {datasets.map((d) => (
                  <option key={d.dataset_id} value={d.dataset_id}>
                    {d.name} ({d.row_count} rows)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Missing Value Imputation</label>
                <select
                  value={preprocessForm.handle_missing}
                  onChange={(e) => setPreprocessForm({ ...preprocessForm, handle_missing: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800"
                >
                  <option value="forward_fill">Forward Fill (ffill)</option>
                  <option value="mean">Column Mean</option>
                  <option value="drop">Drop Missing Rows</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Deduplication</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="dropDupes"
                    checked={preprocessForm.drop_duplicates}
                    onChange={(e) => setPreprocessForm({ ...preprocessForm, drop_duplicates: e.target.checked })}
                  />
                  <label htmlFor="dropDupes" className="text-slate-700">Drop Duplicate Timestamps</label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Train Split Ratio ({Math.round(preprocessForm.train_split_ratio * 100)}%)</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.85"
                  step="0.05"
                  value={preprocessForm.train_split_ratio}
                  onChange={(e) => setPreprocessForm({ ...preprocessForm, train_split_ratio: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Validation Split Ratio ({Math.round(preprocessForm.val_split_ratio * 100)}%)</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.3"
                  step="0.05"
                  value={preprocessForm.val_split_ratio}
                  onChange={(e) => setPreprocessForm({ ...preprocessForm, val_split_ratio: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <Button
              size="sm"
              type="submit"
              disabled={isPreprocessing || !selectedDataset}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPreprocessing ? 'Executing Preprocessing...' : 'Run Preprocessing Pipeline'}
            </Button>
          </form>

          {preprocessResult && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider block">
                Pipeline Execution Metrics
              </span>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Train Samples</span>
                  <span className="text-sm font-bold text-slate-800">{preprocessResult.splits?.train_samples}</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Validation Samples</span>
                  <span className="text-sm font-bold text-slate-800">{preprocessResult.splits?.val_samples}</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Test Samples</span>
                  <span className="text-sm font-bold text-slate-800">{preprocessResult.splits?.test_samples}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: SYNTHETIC DATA GENERATOR */}
      {activeTab === 'generate' && (
        <Card className="border border-slate-200/90 shadow-sm bg-white p-6 space-y-6 max-w-2xl">
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Synthetic IoT Telemetry Generator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate high-frequency multi-variate telemetry across virtual nodes with physics-based spikes, drift, stuck sensors, and noise bursts.
            </p>
          </div>

          <form onSubmit={handleCreateSynthetic} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dataset Name</label>
                <input
                  type="text"
                  value={synthForm.dataset_name}
                  onChange={(e) => setSynthForm({ ...synthForm, dataset_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Virtual Device Nodes</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={synthForm.device_count}
                  onChange={(e) => setSynthForm({ ...synthForm, device_count: parseInt(e.target.value) || 2 })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Samples per Device</label>
                <input
                  type="number"
                  min="200"
                  max="5000"
                  step="100"
                  value={synthForm.samples_per_device}
                  onChange={(e) => setSynthForm({ ...synthForm, samples_per_device: parseInt(e.target.value) || 1000 })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Anomaly Rate ({Math.round(synthForm.anomaly_rate * 100)}%)</label>
                <input
                  type="range"
                  min="0"
                  max="0.2"
                  step="0.01"
                  value={synthForm.anomaly_rate}
                  onChange={(e) => setSynthForm({ ...synthForm, anomaly_rate: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description / Notes</label>
              <textarea
                rows={2}
                value={synthForm.description}
                onChange={(e) => setSynthForm({ ...synthForm, description: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setActiveTab('catalog')}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={isGenerating}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGenerating ? 'Generating Telemetry...' : 'Generate & Register Dataset'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
