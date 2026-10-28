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
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Server,
  LogOut,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { BrandLogo } from '../brand/BrandLogo';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  userName?: string;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'MONITOR',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'live', label: 'Live Monitoring', icon: Activity },
      { id: 'sensors', label: 'Sensor Explorer', icon: Radio },
      { id: 'anomalies', label: 'Anomaly Investigation', icon: AlertTriangle },
    ],
  },
  {
    groupName: 'DATA & MODELS',
    items: [
      { id: 'datasets', label: 'Dataset Explorer', icon: Database },
      { id: 'models', label: 'Model Registry', icon: Box },
    ],
  },
  {
    groupName: 'EXPERIMENTS',
    items: [
      { id: 'simulator', label: 'Simulation Center', icon: Sliders },
      { id: 'research', label: 'Model Research Lab', icon: FlaskConical },
      { id: 'experiments', label: 'Experiment Compare', icon: GitCompare },
    ],
  },
  {
    groupName: 'SYSTEM',
    items: [{ id: 'reports', label: 'Reports & Config', icon: FileText }],
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  isWsConnected = false,
  activeSimulatorStatus = 'stopped',
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
  userName = 'Operator',
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'bg-white border-r border-slate-200 flex flex-col shrink-0 select-none transition-all duration-300 relative z-30 shadow-subtle',
        isCollapsed ? 'w-18' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <BrandLogo size={32} />
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                IoT Anomaly Guard
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Research v0.1.0 • Phase 6
              </span>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupName} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.groupName}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left relative group',
                    isActive
                      ? 'bg-blue-50/80 text-blue-700 font-semibold shadow-subtle'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70',
                    isCollapsed && 'justify-center px-2'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-600" />
                  )}

                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
                    )}
                  />

                  {!isCollapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}

                  {!isCollapsed && item.id === 'simulator' && activeSimulatorStatus === 'running' && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Session & Connectivity Footer */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/60 space-y-2">
        {!isCollapsed ? (
          <>
            {/* Authenticated User Pill */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="font-mono text-slate-800 font-semibold truncate text-[11px]">
                  {userName}
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Sign out of console"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  Backend Node
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  {isWsConnected ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  Telemetry WS
                </span>
                <span
                  className={cn(
                    'text-[11px] font-medium font-mono',
                    isWsConnected ? 'text-emerald-600' : 'text-slate-400'
                  )}
                >
                  {isWsConnected ? 'STREAMING' : 'IDLE'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <span
              title={`WebSocket: ${isWsConnected ? 'Connected' : 'Disconnected'}`}
              className={cn(
                'w-2 h-2 rounded-full',
                isWsConnected ? 'bg-emerald-500' : 'bg-slate-300'
              )}
            />
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
