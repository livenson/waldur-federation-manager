import { Handle, Position } from '@xyflow/react';
import { Shield } from 'lucide-react';
import type { GraphNode } from '../../hooks/useTrustChainGraph';

interface TrustAnchorNodeProps {
  data: GraphNode;
  selected?: boolean;
}

export function TrustAnchorNode({ data, selected }: TrustAnchorNodeProps) {
  const { entity } = data;

  return (
    <div
      className={`px-5 py-3.5 rounded-lg border-2 shadow-lg min-w-[200px] max-w-[280px] bg-gradient-to-br from-indigo-50 to-white ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-indigo-400'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-5 h-5 text-indigo-600" />
        <span className="text-xs font-semibold uppercase text-indigo-600">Trust Anchor</span>
      </div>
      <div className="font-semibold text-gray-900 text-sm">{entity.name}</div>
      {entity.organization && (
        <div className="text-xs text-gray-500 mt-0.5">{entity.organization}</div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </div>
  );
}
