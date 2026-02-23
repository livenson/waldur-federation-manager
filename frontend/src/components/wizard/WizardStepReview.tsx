import { Award, FileText, CheckCircle2 } from 'lucide-react';
import {
  ORG_METHODS,
  IDENTITY_METHODS,
  buildPolicyJson,
} from './types';
import type { WizardState } from './types';

interface Props {
  state: WizardState;
}

function nameOf(id: string, list: { id: string; name: string }[]) {
  return list.find((m) => m.id === id)?.name ?? id;
}

export default function WizardStepReview({ state }: Props) {
  const enabledTiers = state.trustMarkTiers.filter((t) => t.enabled);
  const policyJson = buildPolicyJson(state);
  const totalCreations = enabledTiers.length + 1; // trust marks + 1 policy

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review & Apply</h2>
      <p className="text-sm text-gray-500 mb-5">
        Review your configuration before applying. This will create{' '}
        <strong>{enabledTiers.length}</strong> trust mark definition
        {enabledTiers.length !== 1 ? 's' : ''} and{' '}
        <strong>1</strong> metadata policy.
      </p>

      <div className="space-y-4">
        {/* Org methods */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Organizational Verification
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {state.orgMethods.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
              >
                <CheckCircle2 className="w-3 h-3" />
                {nameOf(id, ORG_METHODS)}
              </span>
            ))}
          </div>
        </div>

        {/* Identity methods */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Identity Verification
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {state.identityMethods.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
              >
                <CheckCircle2 className="w-3 h-3" />
                {nameOf(id, IDENTITY_METHODS)}
              </span>
            ))}
          </div>
        </div>

        {/* Framework */}
        {(state.sirtfi || state.researchAndScholarship || state.rafLevel !== 'none' || state.customRequirements.length > 0) && (
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Trust Framework
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {state.sirtfi && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Sirtfi
                </span>
              )}
              {state.researchAndScholarship && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  R&S
                </span>
              )}
              {state.rafLevel !== 'none' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  RAF {state.rafLevel}
                </span>
              )}
              {state.customRequirements.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trust marks to create */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Trust Mark Definitions ({enabledTiers.length})
            </h3>
          </div>
          {enabledTiers.length > 0 ? (
            <ul className="space-y-1">
              {enabledTiers.map((tier) => (
                <li key={tier.id} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="font-medium">{tier.name}</span>
                  <span className="text-gray-400 font-mono">
                    {state.baseUrl || 'https://...'}/trust-marks/{tier.trustMarkIdSuffix}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No trust mark definitions will be created.</p>
          )}
        </div>

        {/* Policy */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900">Metadata Policy</h3>
          </div>
          <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto max-h-40">
            {JSON.stringify(policyJson, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800">
        Clicking <strong>Apply Configuration</strong> will create{' '}
        <strong>{totalCreations}</strong> object{totalCreations !== 1 ? 's' : ''} via the
        management API.
      </div>
    </div>
  );
}
