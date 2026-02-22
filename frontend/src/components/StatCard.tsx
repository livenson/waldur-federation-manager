import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  color?: string;
}

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'indigo' }: StatCardProps) {
  const iconColorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  const iconClasses = iconColorMap[color] || iconColorMap.indigo;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('rounded-lg p-3 shrink-0', iconClasses)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
