import { X, ExternalLink, Award } from 'lucide-react';
import type { Entity } from '../../api/types';
import type { TrustMarkBadge } from '../../hooks/useTrustChainGraph';

interface NodeDetailPanelProps {
  entity: Entity | null;
  trustMarks?: TrustMarkBadge[];
  onClose: () => void;
}

export function NodeDetailPanel({ entity, trustMarks, onClose }: NodeDetailPanelProps) {
  if (!entity) return null;

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-10 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Entity Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
          <p className="text-sm font-medium text-gray-900">{entity.name}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Entity ID</label>
          <p className="text-sm text-gray-700 break-all flex items-center gap-1">
            {entity.entity_id}
            <a href={entity.entity_id} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </p>
        </div>
        {entity.organization && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Organization</label>
            <p className="text-sm text-gray-700">{entity.organization}</p>
          </div>
        )}
        {entity.country && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Country</label>
            <p className="text-sm text-gray-700">{entity.country}</p>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
          <p className="text-sm">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              entity.status === 'active' ? 'bg-green-100 text-green-800' :
              entity.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
              entity.status === 'revoked' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {entity.status}
            </span>
          </p>
        </div>
        {entity.entity_types.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Entity Types</label>
            <div className="flex gap-1 flex-wrap mt-1">
              {entity.entity_types.map(t => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {entity.contacts.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Contacts</label>
            {entity.contacts.map(c => (
              <p key={c} className="text-sm text-gray-700">{c}</p>
            ))}
          </div>
        )}
        {entity.jwks?.keys?.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Keys</label>
            {entity.jwks.keys.map(k => (
              <p key={k.kid} className="text-xs text-gray-600 font-mono">
                {k.alg} — {k.kid.slice(0, 16)}...
              </p>
            ))}
          </div>
        )}
        {trustMarks && trustMarks.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Trust Marks</label>
            <div className="mt-1 space-y-1.5">
              {trustMarks.map(tm => (
                <div
                  key={tm.trust_mark_id}
                  className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-amber-800 text-xs">{tm.name}</p>
                    <p className="text-[10px] text-amber-600 truncate">{tm.trust_mark_id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
