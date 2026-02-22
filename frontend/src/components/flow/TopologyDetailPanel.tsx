import { X, ExternalLink, Server, Shield } from 'lucide-react';
import type { TopologyNode, InstanceHealth } from '../../api/types';

interface TopologyDetailPanelProps {
  node: TopologyNode | null;
  instances: InstanceHealth[];
  onClose: () => void;
}

export function TopologyDetailPanel({ node, instances, onClose }: TopologyDetailPanelProps) {
  if (!node) return null;

  const isTrustAnchor = node.type === 'trust_anchor';
  const url = (node.data.url as string) || (node.data.base_url as string) || '';

  // Find connected instances for trust anchor
  const connectedInstances = isTrustAnchor
    ? instances.filter((i) => i.trust_anchor_urls.includes(url))
    : [];

  // Find matching instance health data
  const instanceHealth = !isTrustAnchor
    ? instances.find((i) => `inst-${i.instance_id}` === node.id)
    : null;

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-10 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {isTrustAnchor ? 'Trust Anchor' : 'Instance Details'}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
          <p className="text-sm font-medium text-gray-900">{node.label}</p>
        </div>
        {url && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">URL</label>
            <p className="text-sm text-gray-700 break-all flex items-center gap-1">
              {url}
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            </p>
          </div>
        )}

        {isTrustAnchor && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">
              Connected Instances ({connectedInstances.length})
            </label>
            <div className="mt-1 space-y-2">
              {connectedInstances.map((inst) => (
                <div
                  key={inst.instance_id}
                  className="flex items-center gap-2 text-sm bg-gray-50 rounded px-2 py-1.5"
                >
                  <Server className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-700">{inst.name}</span>
                  <span
                    className={`ml-auto w-2 h-2 rounded-full ${
                      inst.status === 'healthy' ? 'bg-green-500' : inst.status === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {instanceHealth && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
              <p className="text-sm">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    instanceHealth.status === 'healthy'
                      ? 'bg-green-100 text-green-800'
                      : instanceHealth.status === 'unhealthy'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {instanceHealth.status}
                </span>
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">
                Trust Anchors ({instanceHealth.trust_anchor_urls.length})
              </label>
              <div className="mt-1 space-y-1">
                {instanceHealth.trust_anchor_urls.map((url) => (
                  <div key={url} className="flex items-center gap-2 text-sm bg-indigo-50 rounded px-2 py-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-indigo-700 text-xs truncate">{url}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Entities</label>
                <p className="text-lg font-bold text-gray-900">{instanceHealth.entity_count}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Users</label>
                <p className="text-lg font-bold text-gray-900">{instanceHealth.user_count}</p>
              </div>
            </div>
            {instanceHealth.federation_entities.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Federation Entities ({instanceHealth.federation_entities.length})
                </label>
                <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
                  {instanceHealth.federation_entities.map((fe) => (
                    <div
                      key={fe.entity_id}
                      className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 truncate"
                    >
                      {fe.entity_id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
