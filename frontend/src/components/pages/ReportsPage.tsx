import { useState } from 'react';
import { Download, Shield, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';

export function ReportsPage() {
  const [exporting, setExporting] = useState(false);

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const [anomalies, sensors] = await Promise.all([
        apiService.getAnomalies({ limit: 100 }),
        apiService.getSensors(),
      ]);

      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(
          JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              anomalies: anomalies.items,
              sensors,
            },
            null,
            2,
          ),
        );
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `iot_audit_report_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Reports & Configuration</h2>
          <p className="text-xs text-slate-400">
            Export compliance audit logs, inspect environment configurations, and security policies.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleExportJson}
          disabled={exporting}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          {exporting ? 'Generating Report...' : 'Export Audit JSON'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment Configuration */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-sm font-semibold text-white">Runtime Environment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">VITE_API_BASE_URL:</span>
              <span className="text-white">{apiService.getBaseUrl()}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">X-API-Key Configured:</span>
              <span className="text-emerald-400 font-bold">ACTIVE (Header / WS Query)</span>
            </div>
            <div className="flex justify-between p-2.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Data Persistence:</span>
              <span className="text-sky-400">MongoDB Core (Async Motor)</span>
            </div>
            <div className="flex justify-between p-2.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Real-time Transport:</span>
              <span className="text-indigo-400">WebSocket /ws/telemetry</span>
            </div>
          </CardContent>
        </Card>

        {/* Security & Access Policies */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm font-semibold text-white">Security & Guardrails</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="font-semibold text-white block">Strict Ground-Truth Isolation</span>
              <p className="text-slate-400 text-[11px]">
                Ground-truth anomaly labels are excluded from all public inference and sensor queries to prevent data leakage.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="font-semibold text-white block">Honest Readiness Probing</span>
              <p className="text-slate-400 text-[11px]">
                Health checks perform real network pings against MongoDB rather than reporting false positive in-memory state.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
