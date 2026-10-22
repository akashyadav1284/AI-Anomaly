import { Activity, Radio, Cpu, Layers } from "lucide-react";
import { Badge } from "../ui/Badge";

export function Header() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-base sm:text-lg tracking-tight">
                AI-Based IoT Sensor Anomaly Detection
              </span>
              <Badge variant="default" className="text-[10px] tracking-wide uppercase">
                Phase 1
              </Badge>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Software-Only Architecture & Research Platform
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400">
            <span className="inline-flex items-center">
              <Cpu className="h-3.5 w-3.5 mr-1 text-slate-500" />
              FastAPI Core
            </span>
            <span className="text-slate-600">•</span>
            <span className="inline-flex items-center">
              <Layers className="h-3.5 w-3.5 mr-1 text-slate-500" />
              React + TypeScript
            </span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800 hidden md:block" />
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">Phase 1 Initialized</span>
          </div>
        </div>
      </div>
    </header>
  );
}
