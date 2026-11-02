import { useState, useEffect } from 'react';
import { Server, Database, Sparkles, ArrowRight, Activity, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiService } from '@/services/api';

interface BroadcastModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export type ReadinessState = 'connecting' | 'waking_up' | 'ready' | 'unavailable';

export function BroadcastModal({ isOpen, onDismiss }: BroadcastModalProps) {
  const [readinessState, setReadinessState] = useState<ReadinessState>('connecting');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const probeReadiness = async () => {
      try {
        const [h, r] = await Promise.all([
          apiService.getHealth().catch(() => null),
          apiService.getReadiness().catch(() => null),
        ]);

        if (!isMounted) return;

        const isBackendUp = h !== null && h.status === 'ok';
        const isDbUp = r?.components?.database?.ready === true;

        if (isBackendUp && isDbUp) {
          setReadinessState('ready');
        } else if (isBackendUp && !isDbUp) {
          setReadinessState('waking_up');
        } else {
          setReadinessState('waking_up');
        }
      } catch {
        if (!isMounted) return;
        setReadinessState('waking_up');
      }
    };

    probeReadiness();
    const interval = setInterval(probeReadiness, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-300 scale-100 animate-in zoom-in-95">
        {/* Subtle top ambient glow strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header section with icon and badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-sm shrink-0">
                <Server className="w-6 h-6 animate-pulse" />
                <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white border border-slate-200">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              </div>
              <div>
                <Badge variant="outline" className="text-[10px] font-mono tracking-wider uppercase font-semibold text-blue-700 bg-blue-50/80 border-blue-200 mb-1">
                  SYSTEM NOTICE
                </Badge>
                <h2 id="broadcast-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Welcome to IoT Anomaly Guard!
                </h2>
              </div>
            </div>
          </div>

          {/* Announcement Body */}
          <div className="space-y-3.5 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              A quick heads-up before you begin!
            </p>

            <p>
              Our application is hosted on free-tier infrastructure. The backend and database may take approximately <strong>3–4 minutes</strong> to wake up after a period of inactivity.
            </p>

            <p>
              During this time, some features, including live monitoring, sensor simulations, and anomaly detection, may take a little longer to respond.
            </p>

            <p>
              Please wait while the services initialize. Once they are ready, you can enjoy the complete IoT Anomaly Guard experience.
            </p>

            <p className="pt-1 text-slate-700 font-medium italic">
              Thank you for your patience!
            </p>
          </div>

          {/* Live Background Probe Badge inside modal */}
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-mono">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>Free-tier cluster status:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {readinessState === 'ready' ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Ready (DB Connected)
                </span>
              ) : readinessState === 'waking_up' ? (
                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Waking Up services...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Connecting...
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button
              onClick={onDismiss}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
            >
              <span>Got it, Continue</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

