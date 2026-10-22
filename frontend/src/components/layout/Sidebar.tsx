import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Radio,
  AlertTriangle,
  Database,
  Box,
  Sliders,
  FlaskConical,
  GitCompare,
  FileText,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export type NavTab =
  | 'overview'
  | 'live'
  | 'sensors'
  | 'anomalies'
  | 'datasets'
  | 'models'
  | 'simulator'
  | 'research'
  | 'experiments'
  | 'reports';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isWsConnected?: boolean;
  activeSimulatorStatus?: string;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', icon: Activity },
  { id: 'sensors', label: 'Sensor Explorer', icon: Radio },
  { id: 'anomalies', label: 'Anomaly Investigation', icon: AlertTriangle },
  { id: 'datasets', label: 'Dataset Explorer', icon: Database },
  { id: 'models', label: 'Model Registry', icon: Box },
  { id: 'simulator', label: 'Simulation Center', icon: Sliders },
  { id: 'research', label: 'Model Research Lab', icon: FlaskConical },
  { id: 'experiments', label: 'Experiment Compare', icon: GitCompare },
  { id: 'reports', label: 'Reports & Config', icon: FileText },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  isWsConnected = false,
  activeSimulatorStatus = 'stopped',
}: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">IoT Anomaly Guard</h1>
            <p className="text-[11px] text-slate-400 font-mono">v0.1.0 • Phase 6</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Analytics & Telemetry
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
              <span>{item.label}</span>
              {item.id === 'simulator' && activeSimulatorStatus === 'running' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status Panel */}
      <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            {isWsConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            WebSocket Feed
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium',
              isWsConnected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400',
            )}
          >
            {isWsConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Simulator</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium capitalize',
              activeSimulatorStatus === 'running'
                ? 'bg-emerald-500/10 text-emerald-400'
                : activeSimulatorStatus === 'paused'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-slate-800 text-slate-400',
            )}
          >
            {activeSimulatorStatus}
          </span>
        </div>
      </div>
    </aside>
  );
}
