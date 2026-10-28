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
      <Card className={cn('bg-white border-slate-200/90 shadow-card animate-pulse', className)}>
        <CardContent className="p-5">
          <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
          <div className="h-7 w-28 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-36 bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'bg-white border-slate-200/90 hover:border-slate-300 shadow-card hover:shadow-card-hover transition-all duration-200 group',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {Icon && (
            <div className="p-2 rounded-lg bg-blue-50/80 text-blue-600 border border-blue-100/80 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {value}
          </span>
          {badge}
        </div>

        {(subtitle || change) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            {change && (
              <span
                className={cn(
                  'font-medium text-[11px] px-1.5 py-0.2 rounded',
                  changePositive
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-rose-700 bg-rose-50'
                )}
              >
                {change}
              </span>
            )}
            {subtitle && <span className="truncate text-slate-500 text-[11px]">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
