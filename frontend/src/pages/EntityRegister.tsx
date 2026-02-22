import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCreateEntity } from '../hooks/useEntities';
import HelpTip, { HelpBanner } from '../components/HelpTip';

export default function EntityRegister() {
  const navigate = useNavigate();
  const createEntity = useCreateEntity();
  const [form, setForm] = useState({
    entity_id: '',
    name: '',
    organization: '',
    country: '',
    entity_types: '' as string,
    contacts: '' as string,
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createEntity.mutateAsync({
        entity_id: form.entity_id,
        name: form.name,
        organization: form.organization || undefined,
        country: form.country || undefined,
        entity_types: form.entity_types ? form.entity_types.split(',').map(s => s.trim()) : [],
        contacts: form.contacts ? form.contacts.split(',').map(s => s.trim()) : [],
      });
      navigate('/entities');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/entities')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Entities
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Register Entity</h1>

      <HelpBanner className="mb-4">
        An <strong>entity</strong> in OIDC Federation is any participant — an OpenID Provider, a Relying Party, or a federation operator.
        Each entity publishes an <strong>Entity Configuration</strong> at its Entity ID URL and is identified by one or more <strong>entity types</strong> that define its role in the federation.
        New entities start in <strong>draft</strong> status and must be activated before they can participate in the trust chain.
      </HelpBanner>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="label">
            Entity ID (URL) *
            <HelpTip text="The globally unique identifier for this entity — a URL where its Entity Configuration (.well-known/openid-federation) is published. Must be an HTTPS URL that this entity controls." />
          </label>
          <input
            type="url"
            required
            className="input"
            placeholder="https://example.com"
            value={form.entity_id}
            onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">
            Name *
            <HelpTip text="A human-readable display name for this entity. This is shown in the UI and trust chain visualisation but is not part of the OIDC Federation protocol." />
          </label>
          <input
            type="text"
            required
            className="input"
            placeholder="Entity name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Organization</label>
            <input
              type="text"
              className="input"
              placeholder="Organization name"
              value={form.organization}
              onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Country (ISO alpha-2)</label>
            <input
              type="text"
              className="input"
              placeholder="FI"
              maxLength={2}
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>
        <div>
          <label className="label">
            Entity Types (comma-separated)
            <HelpTip text="Roles this entity plays in the federation. Options: openid_provider (issues ID tokens), openid_relying_party (consumes ID tokens), oauth_authorization_server, oauth_client, oauth_resource, federation_entity (can act as an intermediate authority and issue subordinate statements)." />
          </label>
          <input
            type="text"
            className="input"
            placeholder="openid_relying_party, federation_entity"
            value={form.entity_types}
            onChange={e => setForm(f => ({ ...f, entity_types: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">
            openid_provider, openid_relying_party, oauth_authorization_server, oauth_client, oauth_resource, federation_entity
          </p>
        </div>
        <div>
          <label className="label">
            Contacts (comma-separated emails)
            <HelpTip text="Administrative contact addresses published in the entity's federation metadata. Used by federation operators to communicate policy changes, security notices, or revocation events." />
          </label>
          <input
            type="text"
            className="input"
            placeholder="admin@example.com"
            value={form.contacts}
            onChange={e => setForm(f => ({ ...f, contacts: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn-primary" disabled={createEntity.isPending}>
            {createEntity.isPending ? 'Registering...' : 'Register Entity'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/entities')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
