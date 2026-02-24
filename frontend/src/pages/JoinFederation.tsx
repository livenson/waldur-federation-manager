import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield, Globe, Users, Bell, FileCheck, CheckCircle2, ArrowLeft, ArrowRight,
  Server, Fingerprint, Network, ExternalLink,
} from 'lucide-react';
import { useCreateInstance } from '../hooks/useFederation';
import { useCreateEntity, useActivateEntity } from '../hooks/useEntities';
import type { Entity } from '../api/types';

const STEPS = ['Benefits', 'Instance', 'Entity', 'Activate', 'Complete'] as const;

// ---------------------------------------------------------------------------
// Step 1 — Welcome: What Joining Gives You
// ---------------------------------------------------------------------------

function StepWelcome({ onNext }: { onNext: () => void }) {
  const benefits = [
    {
      icon: Shield,
      title: 'Identity & Trust',
      desc: 'Cryptographic proof of membership via a signed subordinate statement from the Trust Anchor.',
    },
    {
      icon: Globe,
      title: 'Discovery',
      desc: 'Automatically found by all other members via the /federation/list endpoint.',
    },
    {
      icon: Users,
      title: 'User Mobility',
      desc: 'Users from other instances are recognized across the federation via the identity bridge.',
    },
    {
      icon: FileCheck,
      title: 'Governance',
      desc: 'Metadata policies ensure interoperability; trust marks signal quality and compliance.',
    },
    {
      icon: Bell,
      title: 'Lifecycle Awareness',
      desc: 'Push notifications when members join, get suspended, or are revoked.',
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">What does joining the federation give you?</h2>
      <p className="text-sm text-gray-500 mb-6">
        A Waldur instance that joins the federation gains cryptographic trust, automatic discovery,
        and coordinated governance with every other member.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {benefits.map((b) => (
          <div key={b.title} className="bg-white rounded-lg border border-gray-200 p-4 flex gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 h-fit">
              <b.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{b.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Get Started <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Register Instance
// ---------------------------------------------------------------------------

function StepInstance({
  onNext,
  onBack,
  onCreated,
}: {
  onNext: () => void;
  onBack: () => void;
  onCreated: (instance: { id: string; name: string; base_url: string }) => void;
}) {
  const createInstance = useCreateInstance();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await createInstance.mutateAsync({ name: name.trim(), base_url: baseUrl.trim() });
      onCreated({ id: result.id, name: result.name, base_url: result.base_url });
      onNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register instance');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Register Waldur Instance</h2>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 leading-relaxed mb-6">
        This registers the Waldur deployment in the federation topology.
        All existing members will be notified of the new instance.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            type="text"
            required
            className="input"
            placeholder="e.g. Waldur CSC"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Display name for this Waldur deployment</p>
        </div>
        <div>
          <label className="label">Base URL *</label>
          <input
            type="url"
            required
            className="input"
            placeholder="e.g. https://waldur.csc.fi"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Where this Waldur instance is reachable</p>
        </div>

        <div className="flex justify-between pt-4">
          <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !baseUrl.trim() || createInstance.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createInstance.isPending ? 'Registering...' : 'Register Instance'}
            {!createInstance.isPending && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Create Federation Entity
// ---------------------------------------------------------------------------

function StepEntity({
  instanceName,
  instanceUrl,
  onNext,
  onBack,
  onCreated,
}: {
  instanceName: string;
  instanceUrl: string;
  onNext: () => void;
  onBack: () => void;
  onCreated: (entity: Entity) => void;
}) {
  const createEntity = useCreateEntity();
  const defaultEntityId = instanceUrl ? `${instanceUrl.replace(/\/$/, '')}/.well-known/openid-federation` : '';

  const [form, setForm] = useState({
    entity_id: defaultEntityId,
    name: instanceName,
    organization: '',
    country: '',
    entity_types: ['federation_entity'] as string[],
    contacts: '',
  });
  const [error, setError] = useState('');

  const entityTypeOptions = [
    { value: 'federation_entity', label: 'Federation Entity', desc: 'Intermediate authority that can issue subordinate statements to other entities in the trust chain.' },
    { value: 'openid_provider', label: 'OpenID Provider', desc: 'Issues ID tokens to authenticate users (e.g. a Waldur instance login service).' },
    { value: 'openid_relying_party', label: 'OpenID Relying Party', desc: 'Consumes ID tokens to verify user identity (e.g. an application accepting federated login).' },
    { value: 'oauth_authorization_server', label: 'OAuth Authorization Server', desc: 'Issues OAuth 2.0 access tokens for API authorization.' },
    { value: 'oauth_client', label: 'OAuth Client', desc: 'Requests access tokens from an authorization server to call protected APIs.' },
    { value: 'oauth_resource', label: 'OAuth Resource', desc: 'Protected API that validates access tokens to serve resources.' },
  ];

  const toggleEntityType = (t: string) => {
    setForm((f) => ({
      ...f,
      entity_types: f.entity_types.includes(t)
        ? f.entity_types.filter((x) => x !== t)
        : [...f.entity_types, t],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await createEntity.mutateAsync({
        entity_id: form.entity_id,
        name: form.name,
        organization: form.organization || undefined,
        country: form.country || undefined,
        entity_types: form.entity_types,
        contacts: form.contacts ? form.contacts.split(',').map((s) => s.trim()) : [],
      });
      onCreated(result);
      onNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Create Federation Entity</h2>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 leading-relaxed mb-6">
        This creates a cryptographic identity for the instance. The Trust Anchor generates
        a signing key pair and builds a JWK Set. The entity starts in <strong>draft</strong> status.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Entity ID (URL) *</label>
          <input
            type="url"
            required
            className="input"
            placeholder="https://example.com/.well-known/openid-federation"
            value={form.entity_id}
            onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">URL where the entity configuration will be published</p>
        </div>
        <div>
          <label className="label">Name *</label>
          <input
            type="text"
            required
            className="input"
            placeholder="Entity name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>
        <div>
          <label className="label">Entity Types</label>
          <div className="space-y-2 mt-1">
            {entityTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleEntityType(opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  form.entity_types.includes(opt.value)
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`text-sm font-medium ${
                  form.entity_types.includes(opt.value) ? 'text-indigo-700' : 'text-gray-700'
                }`}>
                  {opt.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Contacts (comma-separated emails)</label>
          <input
            type="text"
            className="input"
            placeholder="admin@example.com"
            value={form.contacts}
            onChange={(e) => setForm((f) => ({ ...f, contacts: e.target.value }))}
          />
        </div>

        <div className="flex justify-between pt-4">
          <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            type="submit"
            disabled={!form.entity_id.trim() || !form.name.trim() || createEntity.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createEntity.isPending ? 'Creating...' : 'Create Entity'}
            {!createEntity.isPending && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review & Activate
// ---------------------------------------------------------------------------

function StepActivate({
  instance,
  entity,
  onNext,
  onBack,
}: {
  instance: { name: string; base_url: string };
  entity: Entity;
  onNext: () => void;
  onBack: () => void;
}) {
  const activateEntity = useActivateEntity();
  const [error, setError] = useState('');

  const handleActivate = async () => {
    setError('');
    try {
      await activateEntity.mutateAsync(entity.id);
      onNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to activate entity');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Review & Activate</h2>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 leading-relaxed mb-6">
        The Trust Anchor will sign a <strong>subordinate statement</strong> — a JWT asserting
        this entity is a trusted member. Other members can resolve this statement to verify the instance.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 mb-6">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Instance</h3>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900">{instance.name}</dd>
            <dt className="text-gray-500">Base URL</dt>
            <dd className="text-gray-900 truncate">{instance.base_url}</dd>
          </dl>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Entity</h3>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Entity ID</dt>
            <dd className="text-gray-900 truncate">{entity.entity_id}</dd>
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900">{entity.name}</dd>
            <dt className="text-gray-500">Entity Types</dt>
            <dd className="text-gray-900">{entity.entity_types.join(', ').replace(/_/g, ' ')}</dd>
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                {entity.status}
              </span>
            </dd>
            <dt className="text-gray-500">Signing Keys</dt>
            <dd className="text-gray-900">{entity.jwks.keys.length} key(s)</dd>
          </dl>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleActivate}
          disabled={activateEntity.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {activateEntity.isPending ? 'Activating...' : 'Activate Entity'}
          {!activateEntity.isPending && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Complete
// ---------------------------------------------------------------------------

function StepComplete({ entityId }: { entityId: string }) {
  const completedItems = [
    'Instance registered and visible in topology',
    'Entity active with signing keys',
    'Subordinate statement issued',
    'All existing members notified',
  ];

  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to the Federation</h2>
      <p className="text-sm text-gray-500 mb-6">
        The instance has been successfully onboarded. Here's what was set up:
      </p>

      <ul className="text-left max-w-sm mx-auto space-y-2 mb-8">
        {completedItems.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/federation" className="btn-primary flex items-center gap-2">
          <Network className="w-4 h-4" /> View in Topology
        </Link>
        <Link to={`/entities/${entityId}`} className="btn-secondary flex items-center gap-2">
          <Fingerprint className="w-4 h-4" /> View Entity Detail
        </Link>
        <Link to="/trust-chain" className="btn-secondary flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> Explore Trust Chain
        </Link>
        <Link to="/trust-marks" className="btn-secondary flex items-center gap-2">
          <Shield className="w-4 h-4" /> Assign Trust Marks
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < current
                  ? 'bg-indigo-600 text-white'
                  : i === current
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[11px] mt-1 ${
                i === current ? 'text-indigo-600 font-semibold' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-10 h-0.5 mx-1 mb-5 ${
                i < current ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function JoinFederation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [instanceData, setInstanceData] = useState<{ id: string; name: string; base_url: string } | null>(null);
  const [entityData, setEntityData] = useState<Entity | null>(null);

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/federation')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Federation
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Join Federation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Onboard a new Waldur instance into the federation in a few steps.
      </p>

      <StepIndicator current={step} />

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        {step === 0 && <StepWelcome onNext={() => setStep(1)} />}

        {step === 1 && (
          <StepInstance
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            onCreated={setInstanceData}
          />
        )}

        {step === 2 && (
          <StepEntity
            instanceName={instanceData?.name ?? ''}
            instanceUrl={instanceData?.base_url ?? ''}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            onCreated={setEntityData}
          />
        )}

        {step === 3 && instanceData && entityData && (
          <StepActivate
            instance={instanceData}
            entity={entityData}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && entityData && <StepComplete entityId={entityData.id} />}
      </div>
    </div>
  );
}
