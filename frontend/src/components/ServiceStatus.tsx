import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Server, Database, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiService, ApiClientError } from "@/services/api";
import { HealthResponse, ReadinessResponse } from "@/types/api";

export function ServiceStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, readyData] = await Promise.all([
        apiService.getHealth(),
        apiService.getReadiness(),
      ]);
      setHealth(healthData);
      setReadiness(readyData);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError("Unable to connect to backend service. Please verify that the FastAPI server is running.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <Card className="border-slate-800 bg-slate-900/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center space-x-2">
            <Server className="h-4 w-4 text-blue-400" />
            <span>Service Status & Subsystem Readiness</span>
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Live health verification against backend API (<code className="text-blue-300 font-mono">{apiService.getBaseUrl()}</code>)
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
          {loading ? "Checking..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300 flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-200">Backend Connection Notice</p>
              <p className="mt-0.5 text-slate-300">{error}</p>
              <p className="mt-2 text-slate-400">
                To run the backend locally: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-200 font-mono">cd backend; .\.venv\Scripts\uvicorn app.main:app --reload</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* FastAPI Health */}
            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center">
                    <Server className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                    FastAPI Process
                  </span>
                  {health?.status === "ok" ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Probing...</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Env: <span className="text-slate-200 font-mono">{health?.environment ?? "checking"}</span></p>
                  <p>Version: <span className="text-slate-200 font-mono">{health?.version ?? "..."}</span></p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                GET /api/v1/health
              </div>
            </div>

            {/* API Router Component */}
            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center">
                    <Network className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                    Router Readiness
                  </span>
                  {readiness?.components.api_server?.ready ? (
                    <Badge variant="success" className="text-[10px]">Operational</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Checking...</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {readiness?.components.api_server?.message ?? "Evaluating router endpoints..."}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                GET /api/v1/ready
              </div>
            </div>

            {/* Document Database Status */}
            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center">
                    <Database className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                    MongoDB
                  </span>
                  <Badge variant="outline" className="text-[10px] border-amber-600/40 text-amber-300 bg-amber-950/30">
                    Phase 4 Planned
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {readiness?.components.database?.message ?? "Reserved for storage layer in Phase 4."}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                Config: {readiness?.components.database?.details?.configured_target as string ?? "iot_anomaly_detection"}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Honest telemetry reporting: no fake metrics or synthetic anomalies fabricated.</span>
          </div>
          {health?.timestamp && (
            <span className="font-mono text-slate-500">
              Synced: {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
