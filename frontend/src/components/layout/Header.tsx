import { NavTab } from './Sidebar';
import { Radio, RefreshCw, LogOut, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  activeTab: NavTab;
  isWsConnected?: boolean;
  isHardwareOnline?: boolean;
  backendReadiness?: 'ready' | 'waking_up' | 'connecting' | 'unavailable';
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onLogout?: () => void;
  userName?: string;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string }> = {
  physical: { title: 'Physical Sensor Intelligence & 3D Viewport', category: 'Monitor' },
  overview: { title: 'System Overview', category: 'Monitor' },
  live: { title: 'Live Telemetry Workspace', category: 'Monitor' },
  sensors: { title: 'Sensor Device Explorer', category: 'Monitor' },
  anomalies: { title: 'Incident Triage & Explainability', category: 'Monitor' },
  datasets: { title: 'Dataset Explorer & Quality Audits', category: 'Data & Models' },
  models: { title: 'Model Registry & Artifacts', category: 'Data & Models' },
  simulator: { title: 'Simulation Control Center', category: 'Experiments' },
  research: { title: 'Model Research Lab', category: 'Experiments' },
  experiments: { title: 'Experiment Tracking & Benchmarks', category: 'Experiments' },
  reports: { title: 'Reports & Runtime Configuration', category: 'System' },
};

export function Header({
  activeTab,
  isWsConnected = false,
  isHardwareOnline = false,
  backendReadiness = 'connecting',
  onRefresh,
  isRefreshing = false,
  onLogout,
  userName = 'Operator',
}: HeaderProps) {
  const current = TAB_TITLES[activeTab] || { title: 'Analytics', category: 'System' };

  return (
    <header className="h-16 border-b border-slate-200/90 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shrink-0 select-none shadow-subtle">
      {/* Breadcrumb & Context Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span>{current.category}</span>
          <span>/</span>
          <span className="text-slate-800 font-semibold">{current.title}</span>
        </div>
      </div>

      {/* Real-time Indicators & Controls */}
      <div className="flex items-center gap-3">
        {/* Physical IoT Hardware Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              isHardwareOnline
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-rose-400'
            }`}
          />
          <span className="text-[11px] font-mono tracking-wide uppercase font-semibold">
            ESP32: {isHardwareOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Service Readiness Status Indicator */}
        <div
          title={
            backendReadiness === 'ready'
              ? 'Cloud cluster and database ready'
              : backendReadiness === 'waking_up'
              ? 'Waking up free-tier backend and database...'
              : backendReadiness === 'unavailable'
              ? 'Services temporarily unavailable. Retry in a moment.'
              : 'Verifying service connection...'
          }
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border bg-slate-50 border-slate-200"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendReadiness === 'ready'
                ? 'bg-emerald-500'
                : backendReadiness === 'waking_up'
                ? 'bg-amber-500 animate-pulse'
                : backendReadiness === 'unavailable'
                ? 'bg-rose-500'
                : 'bg-blue-500 animate-ping'
            }`}
          />
          <span className="text-slate-700 font-medium capitalize">
            {backendReadiness === 'ready'
              ? 'Services: Ready'
              : backendReadiness === 'waking_up'
              ? 'Services: Waking Up'
              : backendReadiness === 'unavailable'
              ? 'Services: Unavailable'
              : 'Services: Connecting'}
          </span>
        </div>

        {/* Live Stream Telemetry Indicator */}
        <Badge
          variant={isWsConnected ? 'success' : 'secondary'}
          className="hidden md:inline-flex items-center gap-1.5 text-[11px]"
        >
          <Radio className={`w-3 h-3 ${isWsConnected ? 'animate-pulse text-emerald-600' : 'text-slate-400'}`} />
          {isWsConnected ? 'Live Stream 100%' : 'WebSocket Standby'}
        </Badge>

        {/* User Account / Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
            <User className="w-3 h-3 text-slate-500" />
            <span>{userName}</span>
          </div>

          {onLogout && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onLogout}
              className="text-xs h-8 px-2 text-slate-500 hover:text-rose-600"
              title="Sign out of console"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>

        {/* Refresh Action */}
        {onRefresh && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs h-8 px-2.5"
            title="Refresh active view"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
    </header>
  );
}
