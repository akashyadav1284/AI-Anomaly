import { NavTab } from './Sidebar';
import { Radio, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  activeTab: NavTab;
  isWsConnected?: boolean;
  simulatorStatus?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string }> = {
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
  simulatorStatus = 'stopped',
  onRefresh,
  isRefreshing = false,
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
        {/* Simulator Session Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              simulatorStatus === 'running'
                ? 'bg-emerald-500 animate-pulse'
                : simulatorStatus === 'paused'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-[11px] font-mono tracking-wide uppercase font-medium">
            Sim: {simulatorStatus}
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
