import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Download } from 'lucide-react';
import { useCreatePolicy, usePolicy, useUpdatePolicy } from '../hooks/usePolicies';
import JsonEditor from '../components/JsonEditor';
import PolicyBuilder from '../components/PolicyBuilder';
import HelpTip from '../components/HelpTip';

type PolicyValue = Record<string, Record<string, unknown>>;
type EditMode = 'visual' | 'json';

export default function PolicyEditor() {
  const { policyId } = useParams<{ policyId: string }>();
  const isNew = !policyId || policyId === 'new';
  const navigate = useNavigate();
  const { data: existingPolicy } = usePolicy(isNew ? '' : policyId!);
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState('openid_relying_party');
  const [policyObj, setPolicyObj] = useState<PolicyValue>({});
  const [policyJson, setPolicyJson] = useState('{}');
  const [mode, setMode] = useState<EditMode>('visual');
  const [switchError, setSwitchError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingPolicy) {
      setName(existingPolicy.name);
      setDescription(existingPolicy.description || '');
      setEntityType(existingPolicy.entity_type);
      const pol = (existingPolicy.policy ?? {}) as PolicyValue;
      setPolicyObj(pol);
      setPolicyJson(JSON.stringify(pol, null, 2));
    }
  }, [existingPolicy]);

  const switchMode = useCallback((target: EditMode) => {
    setSwitchError('');
    if (target === 'json') {
      // Visual -> JSON: serialize current object
      setPolicyJson(JSON.stringify(policyObj, null, 2));
    } else {
      // JSON -> Visual: parse JSON into object
      try {
        const parsed = JSON.parse(policyJson);
        setPolicyObj(parsed as PolicyValue);
      } catch {
        setSwitchError('Cannot switch to Visual mode: invalid JSON');
        return;
      }
    }
    setMode(target);
  }, [policyObj, policyJson]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text) as PolicyValue;
        setPolicyObj(parsed);
        setPolicyJson(JSON.stringify(parsed, null, 2));
        setSwitchError('');
      } catch {
        setSwitchError('Imported file contains invalid JSON');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  }, []);

  const handleExport = useCallback(() => {
    let json: string;
    if (mode === 'visual') {
      json = JSON.stringify(policyObj, null, 2);
    } else {
      json = policyJson;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policy-${name || 'untitled'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mode, policyObj, policyJson, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let policyData: PolicyValue;
    if (mode === 'visual') {
      policyData = policyObj;
    } else {
      try {
        policyData = JSON.parse(policyJson);
      } catch {
        setError('Policy contains invalid JSON');
        return;
      }
    }

    try {
      if (isNew) {
        await createPolicy.mutateAsync({
          name,
          description: description || undefined,
          entity_type: entityType,
          policy: policyData,
        });
      } else {
        await updatePolicy.mutateAsync({
          id: policyId!,
          data: {
            name,
            description: description || undefined,
            entity_type: entityType,
            policy: policyData,
          },
        });
      }
      navigate('/policies');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/policies')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Policies
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'Create Policy' : 'Edit Policy'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            type="text"
            required
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <input
            type="text"
            className="input"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label">
            Entity Type *
            <HelpTip text="This policy will only be applied to entities that have this type. During trust chain resolution, each entity's metadata is validated against policies matching its type." />
          </label>
          <select
            className="input"
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
          >
            <option value="openid_relying_party">OpenID Relying Party</option>
            <option value="openid_provider">OpenID Provider</option>
            <option value="oauth_authorization_server">OAuth Authorization Server</option>
            <option value="oauth_client">OAuth Client</option>
            <option value="oauth_resource">OAuth Resource</option>
            <option value="federation_entity">Federation Entity</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            OP = issues tokens &middot; RP = consumes tokens &middot; Federation Entity = intermediate authority
          </p>
        </div>

        {/* Mode toggle + import/export */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Policy</label>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-gray-200 text-sm">
                <button
                  type="button"
                  onClick={() => switchMode('visual')}
                  className={`px-3 py-1 rounded-l-md transition-colors ${
                    mode === 'visual'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('json')}
                  className={`px-3 py-1 rounded-r-md transition-colors ${
                    mode === 'json'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  JSON
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Import JSON"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {switchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 text-xs text-red-700">
              {switchError}
            </div>
          )}

          {mode === 'visual' ? (
            <PolicyBuilder value={policyObj} onChange={setPolicyObj} />
          ) : (
            <JsonEditor value={policyJson} onChange={setPolicyJson} />
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn-primary" disabled={createPolicy.isPending || updatePolicy.isPending}>
            {isNew ? 'Create Policy' : 'Update Policy'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/policies')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
