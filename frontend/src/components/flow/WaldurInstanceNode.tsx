import { Handle, Position } from '@xyflow/react';
import { Server } from 'lucide-react';

interface WaldurInstanceNodeData {
  label: string;
  status: string;
  base_url: string;
  entity_count: number;
  user_count: number;
}

interface WaldurInstanceNodeProps {
  data: WaldurInstanceNodeData;
  selected?: boolean;
}

export function WaldurInstanceNode({ data, selected }: WaldurInstanceNodeProps) {
  const borderColor =
    data.status === 'healthy'
      ? 'border-green-400'
      : data.status === 'unhealthy'
        ? 'border-red-400'
        : 'border-gray-300';

  const statusDot =
    data.status === 'healthy'
      ? 'bg-green-500'
      : data.status === 'unhealthy'
        ? 'bg-red-500'
        : 'bg-gray-400';

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-md min-w-[180px] max-w-[240px] bg-white ${borderColor} ${
        selected ? 'ring-2 ring-indigo-300' : ''
      }`}
    >
      <Handle type="source" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${statusDot} flex-shrink-0`} />
        <Server className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700 truncate">{data.label}</span>
      </div>
      <div className="text-[10px] text-gray-400 truncate mb-1.5">{data.base_url}</div>
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span>{data.entity_count} entities</span>
        <span>{data.user_count} users</span>
      </div>
    </div>
  );
}
