import { Handle, Position } from '@xyflow/react';
import { Server, Award } from 'lucide-react';
import type { GraphNode } from '../../hooks/useTrustChainGraph';

const statusColors: Record<string, { accent: string; text: string }> = {
  active: { accent: 'border-l-green-500', text: 'text-green-700' },
  suspended: { accent: 'border-l-yellow-500', text: 'text-yellow-700' },
  revoked: { accent: 'border-l-red-500', text: 'text-red-700' },
  draft: { accent: 'border-l-gray-400', text: 'text-gray-500' },
};

interface EntityNodeProps {
  data: GraphNode;
  selected?: boolean;
}

export function EntityNode({ data, selected }: EntityNodeProps) {
  const { entity, trustMarks } = data;
  const colors = statusColors[entity.status] || statusColors.draft;

  return (
    <div
      className={`px-4 py-3 rounded-lg border border-gray-200 border-l-4 ${colors.accent} bg-white shadow-sm max-w-[260px] hover:shadow-md transition-shadow ${
        selected ? 'ring-2 ring-blue-300 !border-l-blue-500' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2 mb-1 leading-tight">
        <Server className="w-4 h-4 text-gray-400 shrink-0" />
        <span className={`text-xs font-medium uppercase ${colors.text}`}>{entity.status}</span>
        {entity.country && (
          <span className="text-xs text-gray-400 ml-auto">{entity.country}</span>
        )}
      </div>
      <div className="font-semibold text-gray-900 text-sm leading-tight">{entity.name}</div>
      {entity.organization && (
        <div className="text-xs text-gray-500 mt-0.5 leading-tight">{entity.organization}</div>
      )}
      {entity.entity_types.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {entity.entity_types.map(t => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {trustMarks.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {trustMarks.map(tm => (
            <span
              key={tm.trust_mark_id}
              title={tm.name}
              className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
            >
              <Award className="w-2.5 h-2.5" />
              {tm.name}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
