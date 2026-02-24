import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, XCircle, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useEntity, useActivateEntity, useSuspendEntity, useRevokeEntity, useRotateEntityKeys } from '../hooks/useEntities';
import { useStatements } from '../hooks/useStatements';
import { useTrustMarks } from '../hooks/useTrustMarks';
import { useRole } from '../contexts/RoleContext';
import ConfirmDialog from '../components/ConfirmDialog';
import HelpTip from '../components/HelpTip';

export default function EntityDetail() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: entity, isLoading } = useEntity(entityId!);
  const { isManager, isOwnEntity } = useRole();
  const { data: statementsData } = useStatements({ subject_entity_id: entity?.entity_id });
  const { data: marksData } = useTrustMarks({ subject_entity_id: entity?.entity_id });
  const activate = useActivateEntity();
  const suspend = useSuspendEntity();
  const revoke = useRevokeEntity();
  const rotateKeys = useRotateEntityKeys();

  const validTabs = ['overview', 'statements', 'trust-marks', 'keys'] as const;
  type Tab = typeof validTabs[number];
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = (t: Tab) => setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showRotateKeysConfirm, setShowRotateKeysConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!entity) {
    return <div className="text-center py-12 text-gray-500">Entity not found</div>;
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    revoked: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <button onClick={() => navigate('/entities')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Entities
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
            <p className="text-sm text-gray-500 mt-1 break-all">{entity.entity_id}</p>
            {entity.organization && <p className="text-sm text-gray-500 mt-0.5">{entity.organization}{entity.country ? ` · ${entity.country}` : ''}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[entity.status]}`}>
            {entity.status}
          </span>
        </div>
        {/* Actions: manager = all, member + own = rotate keys only, member + other = none */}
        {(isManager || isOwnEntity(entityId!)) && (
          <div className="flex items-center gap-2 mt-4">
            {isManager && (entity.status === 'draft' || entity.status === 'suspended') && (
              <button onClick={() => setShowActivateConfirm(true)} className="btn-primary flex items-center gap-1 text-sm">
                <Play className="w-4 h-4" /> Activate
              </button>
            )}
            {isManager && entity.status === 'active' && (
              <button onClick={() => setShowSuspendConfirm(true)} className="btn-secondary flex items-center gap-1 text-sm">
                <Pause className="w-4 h-4" /> Suspend
              </button>
            )}
            {isManager && entity.status !== 'revoked' && (
              <button onClick={() => setShowRevokeConfirm(true)} className="btn-danger flex items-center gap-1 text-sm">
                <XCircle className="w-4 h-4" /> Revoke
              </button>
            )}
            <button onClick={() => setShowRotateKeysConfirm(true)} className="btn-secondary flex items-center gap-1 text-sm">
              <RotateCw className="w-4 h-4" /> Rotate Keys
            </button>
            <HelpTip text="Entity lifecycle: Draft (not yet published) → Active (participating in trust chain, statements can be issued) → Suspended (temporarily excluded, can be reactivated) → Revoked (permanently removed, all statements and trust marks invalidated). Key rotation generates a new signing key pair without changing status." />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {(['overview', 'statements', 'trust-marks', 'keys'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Entity Types</label>
              <p className="text-sm mt-1">{entity.entity_types.map(t => t.replace(/_/g, ' ')).join(', ') || 'None'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Contacts</label>
              <p className="text-sm mt-1">{entity.contacts.join(', ') || 'None'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
              <p className="text-sm mt-1">{new Date(entity.created_at).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Updated</label>
              <p className="text-sm mt-1">{new Date(entity.updated_at).toLocaleString()}</p>
            </div>
          </div>
          {Object.keys(entity.metadata).length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Metadata</label>
              <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-64">
                {JSON.stringify(entity.metadata, null, 2)}
              </pre>
            </div>
          )}
          {(() => {
            const currentStmt = statementsData?.statements.find(s => s.is_current);
            if (!currentStmt?.metadata_policy || Object.keys(currentStmt.metadata_policy).length === 0) return null;
            return (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Federation Policy <HelpTip text="Rules the Trust Anchor enforces on this entity's metadata. Each operator (essential, one_of, add, etc.) constrains what values the entity may publish." /></label>
                <div className="bg-gray-50 p-3 rounded mt-1 space-y-2">
                  {Object.entries(currentStmt.metadata_policy).map(([entityType, attributes]) => {
                    const attrs = attributes as Record<string, unknown> | null;
                    return (
                    <div key={entityType}>
                      <div className="text-xs font-semibold text-gray-700">{entityType.replace(/_/g, ' ')}</div>
                      {attrs && typeof attrs === 'object' && (
                        <dl className="ml-3 mt-1 space-y-0.5">
                          {Object.entries(attrs).map(([attr, operators]) => (
                            <div key={attr} className="flex items-start gap-2 text-xs">
                              <dt className="font-mono text-gray-800 shrink-0">{attr}</dt>
                              <dd className="text-gray-600">
                                {operators && typeof operators === 'object'
                                  ? Object.entries(operators as Record<string, unknown>)
                                      .map(([op, val]) => `${op}: ${JSON.stringify(val)}`)
                                      .join(', ')
                                  : JSON.stringify(operators)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'statements' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Subordinate Statements</h3>
          {statementsData?.statements.length ? (
            <div className="space-y-3">
              {statementsData.statements.map(stmt => (
                <div key={stmt.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">From: {stmt.issuer_entity_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${stmt.is_current ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {stmt.is_current ? 'Current' : 'Historical'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Issued: {new Date(stmt.issued_at).toLocaleString()} · Expires: {new Date(stmt.expires_at).toLocaleString()}
                  </div>

                  {stmt.metadata_policy && Object.keys(stmt.metadata_policy).length > 0 && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-500 uppercase">Metadata Policy <HelpTip text="Rules the Trust Anchor enforces on this entity's metadata. Each operator (essential, one_of, add, etc.) constrains what values the entity may publish." /></label>
                      <div className="bg-gray-50 p-3 rounded mt-1 space-y-2">
                        {Object.entries(stmt.metadata_policy).map(([entityType, attributes]) => {
                          const attrs = attributes as Record<string, unknown> | null;
                          return (
                          <div key={entityType}>
                            <div className="text-xs font-semibold text-gray-700">{entityType.replace(/_/g, ' ')}</div>
                            {attrs && typeof attrs === 'object' && (
                              <dl className="ml-3 mt-1 space-y-0.5">
                                {Object.entries(attrs).map(([attr, operators]) => (
                                  <div key={attr} className="flex items-start gap-2 text-xs">
                                    <dt className="font-mono text-gray-800 shrink-0">{attr}</dt>
                                    <dd className="text-gray-600">
                                      {operators && typeof operators === 'object'
                                        ? Object.entries(operators as Record<string, unknown>)
                                            .map(([op, val]) => `${op}: ${JSON.stringify(val)}`)
                                            .join(', ')
                                        : JSON.stringify(operators)}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {stmt.metadata_override && Object.keys(stmt.metadata_override).length > 0 && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-500 uppercase">Metadata Override <HelpTip text="Values set here by the Trust Anchor replace whatever the entity itself publishes. Used to correct or standardise fields like organization name across the federation." /></label>
                      <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-48">
                        {JSON.stringify(stmt.metadata_override, null, 2)}
                      </pre>
                    </div>
                  )}

                  {stmt.constraints && Object.keys(stmt.constraints).length > 0 && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-500 uppercase">Constraints <HelpTip text="Limits on the entity's role in the trust chain. max_path_length controls how many levels of subordinates it may have (0 = leaf entity, no further delegation)." /></label>
                      <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-48">
                        {JSON.stringify(stmt.constraints, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No statements found</p>
          )}
        </div>
      )}

      {activeTab === 'trust-marks' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Trust Marks</h3>
          {marksData?.trust_marks.length ? (
            <div className="space-y-3">
              {marksData.trust_marks.map(mark => (
                <div key={mark.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{mark.trust_mark_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${mark.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {mark.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Issued: {new Date(mark.issued_at).toLocaleString()}
                    {mark.expires_at && ` · Expires: ${new Date(mark.expires_at).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No trust marks issued</p>
          )}
        </div>
      )}

      {activeTab === 'keys' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Signing Keys</h3>
          {entity.jwks?.keys?.length ? (
            <div className="space-y-3">
              {entity.jwks.keys.map(key => (
                <div key={key.kid} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">{key.kid}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{key.alg}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Type: {key.kty} · Use: {key.use || 'sig'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No keys found</p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showActivateConfirm}
        onClose={() => setShowActivateConfirm(false)}
        onConfirm={() => activate.mutate(entity.id)}
        title="Activate Entity"
        description={`Activate "${entity.name}"? This will publish the entity in the federation trust chain. Other entities and relying parties will be able to discover and resolve trust to it. Subordinate statements can be issued for this entity once active.`}
        confirmText="Activate"
      />
      <ConfirmDialog
        isOpen={showSuspendConfirm}
        onClose={() => setShowSuspendConfirm(false)}
        onConfirm={() => suspend.mutate(entity.id)}
        title="Suspend Entity"
        description={`Suspend "${entity.name}"? The entity will be temporarily excluded from the trust chain. Existing subordinate statements remain but will fail trust chain resolution. Trust marks stay issued but may not be honoured by relying parties. The entity can be reactivated later.`}
        confirmText="Suspend"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={() => revoke.mutate(entity.id)}
        title="Revoke Entity"
        description={`Are you sure you want to revoke "${entity.name}"? This will permanently invalidate all subordinate statements and trust marks issued to this entity. This action cannot be undone.`}
        confirmText="Revoke Entity"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={showRotateKeysConfirm}
        onClose={() => setShowRotateKeysConfirm(false)}
        onConfirm={() => rotateKeys.mutate(entity.id)}
        title="Rotate Signing Keys"
        description={`Rotate signing keys for "${entity.name}"? This will generate a new cryptographic key pair and re-sign all active subordinate statements. The previous key remains valid until existing statements expire. Relying parties that have cached the old key will continue to verify signatures until they refresh.`}
        confirmText="Rotate Keys"
      />
    </div>
  );
}
