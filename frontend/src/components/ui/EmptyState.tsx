import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-slate-200/80 bg-white/70 shadow-subtle ${className}`}
    >
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-slate-100/90 border border-slate-200 flex items-center justify-center text-slate-500 mb-3.5 shadow-sm">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction} className="text-xs">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

