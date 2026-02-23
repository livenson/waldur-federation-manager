import clsx from 'clsx';
import TagInput from '../TagInput';
import HelpTip from '../HelpTip';
import { ALGORITHM_OPTIONS, buildPolicyJson } from './types';
import type { WizardState } from './types';

type PolicySlice = Pick<
  WizardState,
  'requiredScopes' | 'allowedAlgorithms' | 'requireContacts' | 'requireOrgName'
>;

interface Props {
  state: PolicySlice;
  /** Full wizard state — only read for the live JSON preview */
  fullState: WizardState;
  onChange: (patch: Partial<PolicySlice>) => void;
}

export default function WizardStepPolicy({ state, fullState, onChange }: Props) {
  const toggleAlg = (id: string) => {
    const next = state.allowedAlgorithms.includes(id)
      ? state.allowedAlgorithms.filter((a) => a !== id)
      : [...state.allowedAlgorithms, id];
    onChange({ allowedAlgorithms: next });
  };

  const policyJson = buildPolicyJson(fullState);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Metadata Policy</h2>
      <p className="text-sm text-gray-500 mb-5">
        Configure the metadata policy that will be enforced for federation
        entities.
      </p>

      <div className="space-y-5">
        {/* Required scopes */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-sm font-medium text-gray-700">Required Scopes</label>
            <HelpTip text="Scopes that all entities must support. Uses the superset_of policy operator." />
          </div>
          <TagInput
            value={state.requiredScopes}
            onChange={(tags) => onChange({ requiredScopes: tags })}
            placeholder="Add a scope and press Enter"
          />
        </div>

        {/* Allowed algorithms */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-700">Allowed Algorithms</label>
            <HelpTip text="Signing algorithms that entities are allowed to use. Uses the subset_of policy operator." />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ALGORITHM_OPTIONS.map((alg) => (
              <div
                key={alg.id}
                onClick={() => toggleAlg(alg.id)}
                className={clsx(
                  'border rounded-lg p-2 text-center cursor-pointer transition-colors',
                  state.allowedAlgorithms.includes(alg.id)
                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="text-sm font-medium text-gray-900">{alg.label}</span>
                <span className="block text-[10px] text-gray-400">{alg.family}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Required fields */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-700">Required Fields</label>
            <HelpTip text="Fields marked essential must be present in entity metadata." />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.requireContacts}
                onChange={(e) => onChange({ requireContacts: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                <code className="bg-gray-100 px-1 rounded text-xs">contacts</code> essential
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.requireOrgName}
                onChange={(e) => onChange({ requireOrgName: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                <code className="bg-gray-100 px-1 rounded text-xs">organization_name</code>{' '}
                essential
              </span>
            </label>
          </div>
        </div>

        {/* Policy JSON preview */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Policy JSON Preview
          </label>
          <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto max-h-56">
            {JSON.stringify(policyJson, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
