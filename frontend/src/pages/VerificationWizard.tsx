import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useCreateTrustMarkDefinition } from '../hooks/useTrustMarks';
import { useCreatePolicy } from '../hooks/usePolicies';
import WizardShell from '../components/wizard/WizardShell';
import WizardStepWelcome from '../components/wizard/WizardStepWelcome';
import WizardStepOrgVerification from '../components/wizard/WizardStepOrgVerification';
import WizardStepIdentityVerification from '../components/wizard/WizardStepIdentityVerification';
import WizardStepTrustFramework from '../components/wizard/WizardStepTrustFramework';
import WizardStepTrustMarks from '../components/wizard/WizardStepTrustMarks';
import WizardStepPolicy from '../components/wizard/WizardStepPolicy';
import WizardStepReview from '../components/wizard/WizardStepReview';
import {
  INITIAL_STATE,
  deriveTrustMarkTiers,
  buildPolicyJson,
} from '../components/wizard/types';
import type { WizardState } from '../components/wizard/types';

const TOTAL_STEPS = 7;

export default function VerificationWizard() {
  const navigate = useNavigate();
  const createTrustMarkDef = useCreateTrustMarkDefinition();
  const createPolicy = useCreatePolicy();

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    (updates: Partial<WizardState>) => setState((s) => ({ ...s, ...updates })),
    [],
  );

  // ---------------------------------------------------------------------------
  // Validation per step
  // ---------------------------------------------------------------------------
  const canNext = (() => {
    switch (step) {
      case 0:
        return true; // welcome
      case 1:
        return state.orgMethods.length > 0;
      case 2:
        return state.identityMethods.length > 0;
      case 3:
        return true; // all optional
      case 4:
        return true; // trust marks — all optional
      case 5:
        return true; // policy — always valid
      case 6:
        return true; // review
      default:
        return false;
    }
  })();

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const goNext = async () => {
    if (step === 4 - 1) {
      // Entering step 5 — derive tiers from current state
      const tiers = deriveTrustMarkTiers(state);
      // Preserve user edits for tiers that still match
      const merged = tiers.map((t) => {
        const existing = state.trustMarkTiers.find((e) => e.id === t.id);
        return existing ? { ...t, name: existing.name, enabled: existing.enabled } : t;
      });
      setState((s) => ({ ...s, trustMarkTiers: merged }));
    }

    // Auto-add eduperson scope if R&S selected when entering policy step
    if (step === 4) {
      if (
        state.researchAndScholarship &&
        !state.requiredScopes.includes('eduperson')
      ) {
        setState((s) => ({
          ...s,
          requiredScopes: [...s.requiredScopes, 'eduperson'],
        }));
      }
    }

    if (step === TOTAL_STEPS - 1) {
      await handleSubmit();
      return;
    }

    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const enabledTiers = state.trustMarkTiers.filter((t) => t.enabled);
      const base = state.baseUrl || 'https://federation.example.org';

      // Create trust mark definitions
      for (const tier of enabledTiers) {
        await createTrustMarkDef.mutateAsync({
          trust_mark_id: `${base}/trust-marks/${tier.trustMarkIdSuffix}`,
          name: tier.name,
          description: `Auto-created by verification wizard`,
        });
      }

      // Create metadata policy
      const policyJson = buildPolicyJson(state);
      await createPolicy.mutateAsync({
        name: 'Federation Verification Policy',
        description: 'Auto-created by the Federation Verification Configuration Wizard',
        entity_type: 'openid_relying_party',
        policy: policyJson,
      });

      navigate('/trust-marks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render step content
  // ---------------------------------------------------------------------------
  const renderStep = () => {
    switch (step) {
      case 0:
        return <WizardStepWelcome />;
      case 1:
        return (
          <WizardStepOrgVerification
            selected={state.orgMethods}
            onChange={(ids) => patch({ orgMethods: ids })}
          />
        );
      case 2:
        return (
          <WizardStepIdentityVerification
            selected={state.identityMethods}
            onChange={(ids) => patch({ identityMethods: ids })}
          />
        );
      case 3:
        return (
          <WizardStepTrustFramework
            state={state}
            onChange={patch}
          />
        );
      case 4:
        return (
          <WizardStepTrustMarks
            baseUrl={state.baseUrl}
            tiers={state.trustMarkTiers}
            onBaseUrlChange={(url) => patch({ baseUrl: url })}
            onTierToggle={(id) =>
              patch({
                trustMarkTiers: state.trustMarkTiers.map((t) =>
                  t.id === id ? { ...t, enabled: !t.enabled } : t,
                ),
              })
            }
            onTierRename={(id, name) =>
              patch({
                trustMarkTiers: state.trustMarkTiers.map((t) =>
                  t.id === id ? { ...t, name } : t,
                ),
              })
            }
          />
        );
      case 5:
        return (
          <WizardStepPolicy
            state={state}
            fullState={state}
            onChange={patch}
          />
        );
      case 6:
        return <WizardStepReview state={state} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verification Setup</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Configure entity verification requirements for your federation
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <WizardShell
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        canNext={canNext}
        onBack={goBack}
        onNext={goNext}
        isSubmitting={isSubmitting}
      >
        {renderStep()}
      </WizardShell>
    </div>
  );
}
