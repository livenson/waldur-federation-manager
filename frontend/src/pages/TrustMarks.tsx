import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Shield, Award } from 'lucide-react';
import { useTrustMarkDefinitions, useTrustMarks, useIssueTrustMark, useRevokeTrustMark, useCreateTrustMarkDefinition } from '../hooks/useTrustMarks';
import { useEntities } from '../hooks/useEntities';
import ConfirmDialog from '../components/ConfirmDialog';
import HelpTip, { HelpBanner } from '../components/HelpTip';

export default function TrustMarks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['definitions', 'issued'] as const;
  type Tab = typeof validTabs[number];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'definitions';
  const setTab = (t: Tab) => setSearchParams(t === 'definitions' ? {} : { tab: t }, { replace: true });
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; markId: string } | null>(null);
  const { data: definitionsData } = useTrustMarkDefinitions();
  const { data: marksData } = useTrustMarks();
  const { data: entitiesData } = useEntities({ status: 'active' });
  const { data: allEntitiesData } = useEntities();

  // Map entity_id URL -> entity name for display
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allEntitiesData?.entities.forEach(e => map.set(e.entity_id, e.name));
    return map;
  }, [allEntitiesData]);

  // Group active marks by trust_mark_id for the definitions view
  const holdersByDef = useMemo(() => {
    const map = new Map<string, { entity_id: string; name: string; status: string }[]>();
    marksData?.trust_marks.forEach(m => {
      const holders = map.get(m.trust_mark_id) ?? [];
      holders.push({
        entity_id: m.subject_entity_id,
        name: entityNameMap.get(m.subject_entity_id) ?? m.subject_entity_id,
        status: m.status,
      });
      map.set(m.trust_mark_id, holders);
    });
    return map;
  }, [marksData, entityNameMap]);
  const issueMark = useIssueTrustMark();
  const revokeMark = useRevokeTrustMark();
  const createDef = useCreateTrustMarkDefinition();

  const [showDefForm, setShowDefForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [defForm, setDefForm] = useState({ trust_mark_id: '', name: '', description: '' });
  const [issueForm, setIssueForm] = useState({ trust_mark_id: '', subject_entity_id: '' });

  const handleCreateDef = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDef.mutateAsync({
      trust_mark_id: defForm.trust_mark_id,
      name: defForm.name,
      description: defForm.description || undefined,
    });
    setShowDefForm(false);
    setDefForm({ trust_mark_id: '', name: '', description: '' });
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    await issueMark.mutateAsync({
      trust_mark_id: issueForm.trust_mark_id,
      subject_entity_id: issueForm.subject_entity_id,
    });
    setShowIssueForm(false);
    setIssueForm({ trust_mark_id: '', subject_entity_id: '' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trust Marks</h1>
          <p className="text-gray-500 text-sm mt-1">Manage trust mark definitions and issuance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDefForm(true)} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Definition
          </button>
          <button onClick={() => setShowIssueForm(true)} className="btn-primary flex items-center gap-2">
            <Shield className="w-4 h-4" /> Issue Mark
          </button>
        </div>
      </div>

      <HelpBanner className="mb-6">
        <strong>Trust marks</strong> are signed credentials (JWTs) that assert an entity meets certain criteria — like a digital badge.
        Unlike subordinate statements which form the structural trust chain, trust marks are <strong>orthogonal quality signals</strong> that relying parties can optionally require.
        A <strong>definition</strong> describes what a trust mark represents (e.g., "EuroHPC Member").
        <strong>Issuing</strong> a mark creates a signed JWT for a specific entity.
        Trust marks can span federation boundaries — an entity in one federation can carry marks issued by another federation's authority.
      </HelpBanner>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {(['definitions', 'issued'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Definition Form Modal */}
      {showDefForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDef} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Create Trust Mark Definition</h3>
            <div>
              <label className="label">
                Trust Mark ID (URL) *
                <HelpTip text="A globally unique URL identifier for this type of trust mark. This ID will appear in issued JWTs and is used by relying parties to look up the mark's meaning." />
              </label>
              <input type="url" required className="input" value={defForm.trust_mark_id}
                onChange={e => setDefForm(f => ({ ...f, trust_mark_id: e.target.value }))} />
            </div>
            <div>
              <label className="label">Name *</label>
              <input type="text" required className="input" value={defForm.name}
                onChange={e => setDefForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <input type="text" className="input" value={defForm.description}
                onChange={e => setDefForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" className="btn-secondary" onClick={() => setShowDefForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Issue Form Modal */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleIssue} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Issue Trust Mark</h3>
            <div>
              <label className="label">Trust Mark Definition *</label>
              <select className="input" required value={issueForm.trust_mark_id}
                onChange={e => setIssueForm(f => ({ ...f, trust_mark_id: e.target.value }))}>
                <option value="">Select...</option>
                {definitionsData?.definitions.map(d => (
                  <option key={d.id} value={d.trust_mark_id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Subject Entity *</label>
              <select className="input" required value={issueForm.subject_entity_id}
                onChange={e => setIssueForm(f => ({ ...f, subject_entity_id: e.target.value }))}>
                <option value="">Select...</option>
                {entitiesData?.entities.map(e => (
                  <option key={e.id} value={e.entity_id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">Issue</button>
              <button type="button" className="btn-secondary" onClick={() => setShowIssueForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {tab === 'definitions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {definitionsData?.definitions.map(def => {
            const holders = holdersByDef.get(def.trust_mark_id) ?? [];
            const activeHolders = holders.filter(h => h.status === 'active');
            const revokedHolders = holders.filter(h => h.status === 'revoked');
            return (
              <div key={def.id} className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-900">{def.name}</h3>
                <p className="text-xs text-gray-500 break-all mt-1">{def.trust_mark_id}</p>
                {def.description && <p className="text-sm text-gray-500 mt-2">{def.description}</p>}
                <p className="text-xs text-gray-400 mt-2">Created {new Date(def.created_at).toLocaleDateString()}</p>

                {holders.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Entities ({activeHolders.length} active{revokedHolders.length > 0 ? `, ${revokedHolders.length} revoked` : ''})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeHolders.map(h => (
                        <span key={h.entity_id} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          {h.name}
                        </span>
                      ))}
                      {revokedHolders.map(h => (
                        <span key={h.entity_id} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 line-through">
                          {h.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {holders.length === 0 && (
                  <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">No entities hold this mark</p>
                )}
              </div>
            );
          }) ?? <p className="text-gray-500">No definitions yet</p>}
        </div>
      )}

      {tab === 'issued' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trust Mark</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {marksData?.trust_marks.map(mark => (
                <tr key={mark.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px]">
                    <span className="block truncate">{definitionsData?.definitions.find(d => d.trust_mark_id === mark.trust_mark_id)?.name ?? mark.trust_mark_id}</span>
                    <span className="block text-xs text-gray-400 truncate">{mark.trust_mark_id}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px]">
                    <span className="block truncate font-medium text-gray-700">{entityNameMap.get(mark.subject_entity_id) ?? mark.subject_entity_id}</span>
                    <span className="block text-xs text-gray-400 truncate">{mark.subject_entity_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      mark.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>{mark.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(mark.issued_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {mark.status === 'active' && (
                      <button
                        onClick={() => setRevokeTarget({ id: mark.id, markId: mark.trust_mark_id })}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!marksData?.trust_marks.length && (
            <p className="text-gray-500 text-sm text-center py-8">No trust marks issued yet</p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeMark.mutate({ id: revokeTarget.id });
        }}
        title="Revoke Trust Mark"
        description={revokeTarget
          ? `Are you sure you want to revoke this trust mark (${revokeTarget.markId})? The subject entity will lose this trust mark credential. This action cannot be undone.`
          : ''}
        confirmText="Revoke Trust Mark"
        variant="danger"
      />
    </div>
  );
}
