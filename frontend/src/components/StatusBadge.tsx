import clsx from 'clsx';

const statusColorMap: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-gray-100 text-gray-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  revoked: 'bg-red-100 text-red-800',
  rotated: 'bg-blue-100 text-blue-800',
  expired: 'bg-red-100 text-red-800',
};

const defaultColor = 'bg-gray-100 text-gray-800';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorClasses = statusColorMap[status.toLowerCase()] || defaultColor;

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full capitalize',
        colorClasses,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      {status}
    </span>
  );
}
