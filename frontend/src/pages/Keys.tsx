import { useState } from 'react';
import { Key, RotateCw } from 'lucide-react';
import { useEntities, useRotateEntityKeys } from '../hooks/useEntities';
import { useRole } from '../contexts/RoleContext';
import { HelpBanner } from '../components/HelpTip';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Keys() {
  const { data, isLoading } = useEntities();
  const rotateKeys = useRotateEntityKeys();
  const entities = data?.entities ?? [];
  const [rotateTarget, setRotateTarget] = useState<{ id: string; name: string } | null>(null);
  const { isManager, isOwnEntity } = useRole();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Signing Keys</h1>
        <p className="text-gray-500 text-sm mt-1">Manage entity signing keys</p>
      </div>

      <HelpBanner className="mb-6">
        Each entity has a <strong>JSON Web Key Set (JWKS)</strong> containing the cryptographic keys used to sign its Entity Configuration, subordinate statements, and trust marks.
        Keys use <strong>JWK</strong> format with properties: <code className="bg-blue-100 px-1 rounded">kty</code> (key type, e.g., EC), <code className="bg-blue-100 px-1 rounded">alg</code> (algorithm, e.g., ES256), <code className="bg-blue-100 px-1 rounded">kid</code> (key ID for matching signatures), and <code className="bg-blue-100 px-1 rounded">use</code> (sig = signing).
        <strong>Rotating</strong> keys generates a new key pair and re-signs all active statements. The old key remains valid until existing statements expire.
      </HelpBanner>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {entities.map(entity => (
            <div key={entity.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{entity.name}</h3>
                  <p className="text-xs text-gray-500">{entity.entity_id}</p>
                </div>
                {(isManager || isOwnEntity(entity.id)) && (
                  <button
                    onClick={() => setRotateTarget({ id: entity.id, name: entity.name })}
                    className="btn-secondary flex items-center gap-1 text-sm"
                    disabled={rotateKeys.isPending}
                  >
                    <RotateCw className="w-4 h-4" /> Rotate
                  </button>
                )}
              </div>
              {entity.jwks?.keys?.length > 0 ? (
                <div className="space-y-2">
                  {entity.jwks.keys.map(key => (
                    <div key={key.kid} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                      <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-gray-700 truncate">{key.kid}</p>
                        <p className="text-xs text-gray-500">{key.kty} · {key.alg} · {key.use || 'sig'}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">active</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No keys</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!rotateTarget}
        onClose={() => setRotateTarget(null)}
        onConfirm={() => {
          if (rotateTarget) rotateKeys.mutate(rotateTarget.id);
        }}
        title="Rotate Signing Keys"
        description={rotateTarget
          ? `Rotate signing keys for "${rotateTarget.name}"? This will generate a new cryptographic key pair and re-sign all active subordinate statements issued by this entity. The previous key remains valid until existing statements expire. Relying parties that have cached the old key will continue to verify signatures until they refresh.`
          : ''}
        confirmText="Rotate Keys"
      />
    </div>
  );
}
