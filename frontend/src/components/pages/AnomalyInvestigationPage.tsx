import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  RefreshCw,
  Search,
  AlertTriangle,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowUpDown,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Save,
  MessageSquare,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiService } from '@/services/api';
import { AnomalyRecord, PredictionExplanation, SensorReading } from '@/types/api';
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

export function AnomalyInvestigationPage() {
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);

  // Forensic Chart Context Readings
  const [contextReadings, setContextReadings] = useState<SensorReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  // Notes state for selected incident
  const [incidentNotes, setIncidentNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch anomalies from backend with real filters & pagination
  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAnomalies({
        device_id: deviceFilter === 'all' ? undefined : deviceFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        review_status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        sort_by: sortBy,
        order: sortOrder,
        page: currentPage,
        page_size: pageSize,
      });

      setAnomalies(res.items);
      setTotalCount(res.total);

      // Auto-select first item if current selection is invalid or null
      if (res.items.length > 0) {
        if (!selectedAnomaly || !res.items.some((a) => a.anomaly_id === selectedAnomaly.anomaly_id)) {
          setSelectedAnomaly(res.items[0]);
          setIncidentNotes(res.items[0].notes || '');
        }
      } else {
        setSelectedAnomaly(null);
        setIncidentNotes('');
      }
    } catch {
      showToast('Error syncing incident register from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 8000);
    return () => clearInterval(interval);
  }, [severityFilter, statusFilter, deviceFilter, sortBy, sortOrder, currentPage, pageSize]);

  // Handle live search debounce or manual submit
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchAnomalies();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // When selected anomaly changes, fetch forensic context readings for charts
  useEffect(() => {
    if (!selectedAnomaly) {
      setContextReadings([]);
      return;
    }
    setIncidentNotes(selectedAnomaly.notes || '');

    const loadContext = async () => {
      setLoadingReadings(true);
      try {
        const readingsRes = await apiService.getSensorReadings(selectedAnomaly.device_id, 30);
        setContextReadings(readingsRes.items || []);
      } catch {
        setContextReadings([]);
      } finally {
        setLoadingReadings(false);
      }
    };
    loadContext();
  }, [selectedAnomaly?.anomaly_id]);

  // Distinct devices list for filter dropdown
  const uniqueDevices = useMemo(() => {
    const set = new Set<string>();
    anomalies.forEach((a) => set.add(a.device_id));
    return Array.from(set);
  }, [anomalies]);

  // Calculate live counts across the active batch for the KPI summary cards
  const kpiStats = useMemo(() => {
    let pending = 0;
    let underReview = 0;
    let confirmed = 0;
    let falsePositive = 0;
    let resolved = 0;
    let critical = 0;

    anomalies.forEach((a) => {
      const st = a.review_status?.toLowerCase();
      const sev = a.severity?.toLowerCase();
      if (st === 'pending' || st === 'new') pending++;
      else if (st === 'under_review') underReview++;
      else if (st === 'confirmed') confirmed++;
      else if (st === 'false_positive') falsePositive++;
      else if (st === 'resolved' || st === 'acknowledged') resolved++;

      if (sev === 'critical') critical++;
    });

    return {
      total: totalCount || anomalies.length,
      pending,
      underReview,
      confirmed,
      falsePositive,
      resolved,
      critical,
    };
  }, [anomalies, totalCount]);

  // Status progression action
  const handleUpdateStatus = async (
    newStatus: 'under_review' | 'confirmed' | 'false_positive' | 'resolved' | 'pending',
    notesVal?: string,
  ) => {
    if (!selectedAnomaly) return;
    setUpdatingStatus(true);
    const previous = { ...selectedAnomaly };

    // Optimistic UI update
    const optimistic = {
      ...selectedAnomaly,
      review_status: newStatus,
      notes: notesVal !== undefined ? notesVal : selectedAnomaly.notes,
    };
    setSelectedAnomaly(optimistic);
    setAnomalies((prev) =>
      prev.map((a) => (a.anomaly_id === optimistic.anomaly_id ? optimistic : a)),
    );

    try {
      const updated = await apiService.updateAnomalyStatus(
        selectedAnomaly.anomaly_id,
        newStatus,
        notesVal !== undefined ? notesVal : selectedAnomaly.notes,
      );
      setSelectedAnomaly(updated);
      setAnomalies((prev) =>
        prev.map((a) => (a.anomaly_id === updated.anomaly_id ? updated : a)),
      );
      showToast(`Incident #${selectedAnomaly.anomaly_id.slice(-6)} updated to ${newStatus.replace('_', ' ')}`);
    } catch {
      // Rollback on rejection
      setSelectedAnomaly(previous);
      setAnomalies((prev) =>
        prev.map((a) => (a.anomaly_id === previous.anomaly_id ? previous : a)),
      );
      showToast('Failed to persist status change. Server rolled back.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Save Investigator Notes
  const handleSaveNotes = async () => {
    if (!selectedAnomaly) return;
    setSavingNotes(true);
    try {
      const updated = await apiService.updateAnomalyStatus(
        selectedAnomaly.anomaly_id,
        selectedAnomaly.review_status,
        incidentNotes,
      );
      setSelectedAnomaly(updated);
      setAnomalies((prev) =>
        prev.map((a) => (a.anomaly_id === updated.anomaly_id ? updated : a)),
      );
      showToast('Forensic notes saved and recorded in audit log');
    } catch {
      showToast('Error saving investigator notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Bulk status update action
  const handleBulkStatusChange = async (
    newStatus: 'under_review' | 'confirmed' | 'false_positive' | 'resolved',
  ) => {
    if (selectedIds.length === 0) return;
    setUpdatingStatus(true);
    try {
      await apiService.bulkUpdateAnomalyStatus(selectedIds, newStatus);
      showToast(`Bulk updated ${selectedIds.length} incident(s) to ${newStatus.replace('_', ' ')}`);
      setSelectedIds([]);
      fetchAnomalies();
    } catch {
      showToast('Failed to perform bulk update');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Multi-select helpers
  const handleSelectAll = () => {
    if (selectedIds.length === anomalies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(anomalies.map((a) => a.anomaly_id));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Export handlers
  const handleExportCSV = () => {
    if (anomalies.length === 0) return;
    const headers = [
      'Incident ID',
      'Device ID',
      'Timestamp',
      'Severity',
      'Normalized Score',
      'Review Status',
      'Affected Features',
      'Model Name',
      'Notes',
    ];
    const rows = anomalies.map((a) => [
      a.anomaly_id,
      a.device_id,
      a.timestamp,
      a.severity,
      (a.normalized_score * 100).toFixed(1) + '%',
      a.review_status,
      `"${a.affected_features.join(', ')}"`,
      a.model_name,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `incidents_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported incidents as CSV file');
  };

  const handleExportJSON = () => {
    if (anomalies.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(anomalies, null, 2),
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `incidents_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported incidents as JSON format');
  };

  // Chart telemetry formatting
  const chartTelemetryData = useMemo(() => {
    if (!contextReadings || contextReadings.length === 0) {
      return [];
    }
    return contextReadings.map((r) => {
      const d = new Date(r.timestamp);
      const timeStr = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        time: timeStr,
        temperature: r.features?.temperature ?? 0,
        humidity: r.features?.humidity ?? 0,
        vibration: r.features?.vibration ?? 0,
        current: r.features?.current ?? 0,
        pressure: r.features?.pressure ?? 0,
      };
    });
  }, [contextReadings]);

  const explanationObj =
    typeof selectedAnomaly?.explanation === 'object'
      ? (selectedAnomaly?.explanation as PredictionExplanation)
      : null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-xl text-xs font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Incident Command Center Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Incident Command Center & Explainability
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 font-mono text-slate-700 font-medium">
              {totalCount} Total Incidents
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Forensic triage workbench for evaluating multi-variate telemetry anomalies, decision attribution, confidence calibrator thresholds, and authenticated root-cause auditing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAnomalies}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Registry
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            className="text-xs h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* KPI Interactive Summary Cards (Clickable to Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Card */}
        <div
          onClick={() => {
            setStatusFilter('all');
            setSeverityFilter('all');
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            statusFilter === 'all' && severityFilter === 'all'
              ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">All Incidents</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{kpiStats.total}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded events</span>
        </div>

        {/* Pending Card */}
        <div
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            statusFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">New / Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono">{kpiStats.pending}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting triage</span>
        </div>

        {/* Critical Card */}
        <div
          onClick={() => setSeverityFilter('critical')}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            severityFilter === 'critical'
              ? 'border-rose-500 ring-2 ring-rose-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Critical</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-700 font-mono">{kpiStats.critical}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Score &gt; 90%</span>
        </div>

        {/* Under Review Card */}
        <div
          onClick={() => setStatusFilter('under_review')}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            statusFilter === 'under_review'
              ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Under Review</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700 font-mono">{kpiStats.underReview}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Investigating</span>
        </div>

        {/* Confirmed Card */}
        <div
          onClick={() => setStatusFilter('confirmed')}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            statusFilter === 'confirmed'
              ? 'border-purple-500 ring-2 ring-purple-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Confirmed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-purple-700 font-mono">{kpiStats.confirmed}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">True anomaly</span>
        </div>

        {/* Resolved / FP Card */}
        <div
          onClick={() => setStatusFilter('resolved')}
          className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
            statusFilter === 'resolved'
              ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-subtle'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Resolved</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">{kpiStats.resolved}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Closed incidents</span>
        </div>
      </div>

      {/* Filter and Command Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search incident ID or node..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono"
          />
        </div>

        {/* Center: Dropdown Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Device Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400 font-medium">Node:</span>
            <select
              value={deviceFilter}
              onChange={(e) => {
                setDeviceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Devices</option>
              {uniqueDevices.map((dev) => (
                <option key={dev} value={dev}>
                  {dev}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400 font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs capitalize bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs capitalize bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="confirmed">Confirmed</option>
              <option value="false_positive">False Positive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="timestamp">Timestamp</option>
              <option value="normalized_score">Anomaly Score</option>
              <option value="severity">Severity</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              title="Toggle Sort Order"
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Reset Filters button */}
        {(searchQuery || severityFilter !== 'all' || statusFilter !== 'all' || deviceFilter !== 'all') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setSeverityFilter('all');
              setStatusFilter('all');
              setDeviceFilter('all');
              setCurrentPage(1);
            }}
            className="text-[11px] h-7 text-slate-500 hover:text-slate-800"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Bulk Action Banner (when records are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-blue-50/80 border border-blue-200 rounded-xl animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedIds.length} incidents selected</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Bulk Action:</span>
            <Button
              size="sm"
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleBulkStatusChange('under_review')}
              className="text-xs h-7 bg-white hover:bg-slate-50"
            >
              Mark Under Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleBulkStatusChange('confirmed')}
              className="text-xs h-7 bg-white text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              Confirm Anomalies
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleBulkStatusChange('false_positive')}
              className="text-xs h-7 bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200"
            >
              False Positive
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleBulkStatusChange('resolved')}
              className="text-xs h-7 bg-white text-slate-700 hover:bg-slate-100"
            >
              Resolve
            </Button>
          </div>
        </div>
      )}

      {/* Main Split-Screen Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Searchable Incident Register */}
        <div className="lg:col-span-6 space-y-3">
          <Card className="border border-slate-200/90 shadow-sm overflow-hidden">
            <CardHeader className="py-3.5 px-4 bg-slate-50/60 border-b border-slate-200 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-slate-400 hover:text-slate-700 focus:outline-none"
                  title="Select / Deselect All on page"
                >
                  {selectedIds.length === anomalies.length && anomalies.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Incident Register
                </CardTitle>
              </div>

              <div className="text-[11px] font-mono text-slate-500">
                Page {currentPage} of {totalPages}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading && anomalies.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Fetching real-time incident records...</p>
                </div>
              ) : anomalies.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={CheckCircle}
                    title="No Incident Logs Found"
                    description="No telemetry anomalies match your active filter criteria."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                  {anomalies.map((anom) => {
                    const isSelected = selectedAnomaly?.anomaly_id === anom.anomaly_id;
                    const isChecked = selectedIds.includes(anom.anomaly_id);
                    const severity = (anom.severity || 'high').toLowerCase();
                    const status = (anom.review_status || 'pending').toLowerCase();

                    return (
                      <div
                        key={anom.anomaly_id}
                        onClick={() => setSelectedAnomaly(anom)}
                        className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className="pt-0.5 text-slate-400 hover:text-slate-700"
                          onClick={(e) => handleToggleSelect(anom.anomaly_id, e)}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Incident Main Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-900 text-xs font-mono truncate">
                              {anom.device_id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {/* Severity Badge */}
                              <Badge
                                variant={
                                  severity === 'critical'
                                    ? 'destructive'
                                    : severity === 'high'
                                    ? 'warning'
                                    : 'secondary'
                                }
                                className="text-[10px] uppercase font-mono px-1.5 py-0.5"
                              >
                                {severity}
                              </Badge>

                              {/* Review Status Badge */}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                  status === 'confirmed'
                                    ? 'bg-purple-100 text-purple-700'
                                    : status === 'false_positive'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : status === 'under_review'
                                    ? 'bg-blue-100 text-blue-700'
                                    : status === 'resolved'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          {/* Time & Channels */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-1">
                            <span className="truncate">
                              {new Date(anom.timestamp).toLocaleString()}
                            </span>
                            <span className="font-semibold text-slate-800">
                              Score: {(anom.normalized_score * 100).toFixed(1)}%
                            </span>
                          </div>

                          {/* Affected channels tags */}
                          {anom.affected_features && anom.affected_features.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {anom.affected_features.slice(0, 3).map((f) => (
                                <span
                                  key={f}
                                  className="text-[9px] font-mono bg-white border border-slate-200 px-1 py-0.2 rounded text-slate-600 capitalize"
                                >
                                  {f}
                                </span>
                              ))}
                              {anom.affected_features.length > 3 && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  +{anom.affected_features.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <div className="text-[11px] text-slate-500">
                    Showing {(currentPage - 1) * pageSize + 1} -{' '}
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-7 px-2 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs font-mono font-medium px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 px-2 text-xs"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL: Forensic Analysis & Explainability */}
        <div className="lg:col-span-6 space-y-4">
          {selectedAnomaly ? (
            <Card className="border border-slate-200/90 shadow-sm overflow-hidden bg-white">
              {/* Incident Forensic Header */}
              <CardHeader className="py-3.5 px-5 bg-slate-50/60 border-b border-slate-200 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Incident Forensic Dossier
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono text-slate-600 bg-white">
                      {selectedAnomaly.model_name}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    ID: {selectedAnomaly.anomaly_id} | Node: {selectedAnomaly.device_id}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`text-xs uppercase font-mono px-2 py-0.5 ${
                    selectedAnomaly.review_status === 'confirmed'
                      ? 'border-purple-300 bg-purple-50 text-purple-700'
                      : selectedAnomaly.review_status === 'false_positive'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : selectedAnomaly.review_status === 'under_review'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}
                >
                  {selectedAnomaly.review_status.replace('_', ' ')}
                </Badge>
              </CardHeader>

              <CardContent className="p-5 space-y-5 text-xs">
                {/* Metric Summary Bar */}
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Anomaly Score</span>
                    <span className="text-sm font-bold text-rose-600 font-mono">
                      {(selectedAnomaly.normalized_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Decision Threshold</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      {(selectedAnomaly.threshold * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Detection Delta</span>
                    <span className="text-sm font-bold text-purple-700 font-mono">
                      +{Math.max(0, (selectedAnomaly.normalized_score - selectedAnomaly.threshold) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Multi-channel Sensor Waveform Around Incident */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      Multivariate Telemetry Waveform Window
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {contextReadings.length} context samples
                    </span>
                  </div>

                  <div className="h-44 w-full bg-slate-50/50 rounded-xl border border-slate-200/80 p-2">
                    {loadingReadings ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> Loading sensor traces...
                      </div>
                    ) : chartTelemetryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartTelemetryData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Line
                            type="monotone"
                            dataKey="temperature"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            dot={false}
                            name="Temp (°C)"
                          />
                          <Line
                            type="monotone"
                            dataKey="humidity"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dot={false}
                            name="Humidity (%)"
                          />
                          <Line
                            type="monotone"
                            dataKey="vibration"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            dot={false}
                            name="Vibration (g)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
                        No continuous telemetry buffer logged for device {selectedAnomaly.device_id}
                      </div>
                    )}
                  </div>
                </div>

                {/* Model Attribution & Explainability */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Model Feature Attribution & Decision Impact
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white font-mono">
                      Explainable AI
                    </Badge>
                  </div>

                  {explanationObj && explanationObj.top_contributions ? (
                    <div className="space-y-2 pt-1">
                      {explanationObj.top_contributions.map((contrib) => {
                        const pct = Math.min(100, Math.max(0, contrib.score * 100));
                        return (
                          <div key={contrib.feature} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="text-slate-600 capitalize font-medium">{contrib.feature}</span>
                              <span className="font-semibold text-slate-900">{pct.toFixed(1)}% weight</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600 leading-relaxed font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                      {typeof selectedAnomaly.explanation === 'string'
                        ? selectedAnomaly.explanation
                        : `Multivariate anomaly detected on ${selectedAnomaly.device_id}. Outlier score exceeds baseline partition threshold.`}
                    </div>
                  )}
                </div>

                {/* Investigator Audit Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      Investigator Forensic Notes & Audit Log
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Persisted in MongoDB</span>
                  </div>

                  <textarea
                    rows={2}
                    value={incidentNotes}
                    onChange={(e) => setIncidentNotes(e.target.value)}
                    placeholder="Enter root-cause diagnosis, maintenance ticket ID, or forensic audit comments..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                  />

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="text-xs h-7 gap-1 border-slate-200 hover:bg-slate-100"
                    >
                      <Save className="w-3 h-3" />
                      {savingNotes ? 'Saving...' : 'Save Audit Notes'}
                    </Button>
                  </div>
                </div>

                {/* Triage Decision Action Toolbar */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">
                    Advance Incident Review Workflow:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus('under_review')}
                      disabled={updatingStatus}
                      className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      Under Review
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus('confirmed')}
                      disabled={updatingStatus}
                      className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Confirm Anomaly
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus('false_positive')}
                      disabled={updatingStatus}
                      className="text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Mark False Positive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={updatingStatus}
                      className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      Resolve & Close
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-slate-200/90 shadow-sm p-12 text-center bg-white">
              <EmptyState
                icon={ShieldAlert}
                title="Select an Incident"
                description="Choose an incident record from the register to inspect sensor traces, feature attribution, and audit review status."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
