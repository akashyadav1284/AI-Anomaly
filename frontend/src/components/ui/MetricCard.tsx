import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';
import { cn } from '@/utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changePositive?: boolean;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changePositive,
  icon: Icon,
  badge,
  className,
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn('bg-slate-900/60 border-slate-800 animate-pulse', className)}>
        <CardContent className="p-5">
          <div className="h-4 w-24 bg-slate-800 rounded mb-3" />
          <div className="h-8 w-32 bg-slate-800 rounded mb-2" />
          <div className="h-3 w-40 bg-slate-800 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-colors', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
          {Icon && (
            <div className="p-2 rounded-lg bg-slate-800/80 text-blue-400">
              <Icon className="w-4 h-4" />
            </div>
          )}
          {badge}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-white font-mono">{value}</span>
          {change && (
            <span
              className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded',
                changePositive
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-rose-400 bg-rose-500/10',
              )}
            >
              {change}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
