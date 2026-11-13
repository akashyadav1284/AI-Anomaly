import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Activity,
  Cpu,
  RefreshCw,
  Wifi,
  Database,
  Server,
  Maximize2,
  Minimize2,
  Clock,
} from 'lucide-react';

interface PhysicalSensorIntelligenceHeaderProps {
  deviceId: string;
  isOnline: boolean;
  lastSeenSeconds?: number;
  samplingRateHz?: number;
  isWsConnected: boolean;
  isBackendHealthy: boolean;
  isDbConnected: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function PhysicalSensorIntelligenceHeader({
  deviceId,
  isOnline,
  lastSeenSeconds,
  samplingRateHz = 1.0,
  isWsConnected,
  isBackendHealthy,
  isDbConnected,
  isFullscreen,
  onToggleFullscreen,
  onRefresh,
  isRefreshing,
}: PhysicalSensorIntelligenceHeaderProps) {
  // Format data freshness
  const freshnessText =
    lastSeenSeconds !== undefined
      ? lastSeenSeconds < 5
        ? 'Live (<5s)'
        : `${Math.round(lastSeenSeconds)}s ago`
      : 'Awaiting connection';

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card select-none">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Branding */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  PHYSICAL SENSOR INTELLIGENCE
                </h1>
                <Badge
                  variant={isOnline ? 'success' : 'destructive'}
                  className="text-[11px] font-mono tracking-wider uppercase px-2 py-0.5"
                >
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-Time IoT Telemetry & 3D Sensor Analytics — Hardware Node: <span className="font-mono font-semibold text-slate-800">{deviceId}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Telemetry Health Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Telemetry Freshness */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-sans">Freshness:</span>
            <span className="font-semibold text-slate-900">{freshnessText}</span>
          </div>

          {/* Sampling Rate */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-500 font-sans">Rate:</span>
            <span className="font-semibold text-slate-900">{samplingRateHz.toFixed(1)} Hz</span>
          </div>

          {/* Subsystem Health Indicators */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono">
            <span
              title={isWsConnected ? 'WebSocket Stream Active' : 'WebSocket Reconnecting'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                isWsConnected ? 'bg-emerald-100/70 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Wifi className="w-3 h-3" /> WS
            </span>
            <span
              title={isBackendHealthy ? 'FastAPI Gateway Healthy' : 'FastAPI Degraded'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                isBackendHealthy ? 'bg-emerald-100/70 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <Server className="w-3 h-3" /> API
            </span>
            <span
              title={isDbConnected ? 'MongoDB Atlas Cluster Connected' : 'MongoDB Offline'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                isDbConnected ? 'bg-emerald-100/70 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <Database className="w-3 h-3" /> DB
            </span>
          </div>

          {/* Control Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs h-8 px-3 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              Sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFullscreen}
              className="text-xs h-8 px-2.5"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Dashboard'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-slate-600" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
