import clsx from 'clsx';
import HelpTip from '../HelpTip';
import TagInput from '../TagInput';
import type { WizardState } from './types';

type FrameworkSlice = Pick<
  WizardState,
  'sirtfi' | 'researchAndScholarship' | 'rafLevel' | 'customRequirements'
>;

interface Props {
  state: FrameworkSlice;
  onChange: (patch: Partial<FrameworkSlice>) => void;
}

const RAF_OPTIONS: { value: WizardState['rafLevel']; label: string; desc: string }[] = [
  { value: 'none', label: 'None', desc: 'No RAF requirement' },
  { value: 'low', label: 'Low', desc: 'Basic identity proofing' },
  { value: 'medium', label: 'Medium', desc: 'Government-issued ID verified' },
  { value: 'high', label: 'High', desc: 'In-person or equivalent verification' },
];

export default function WizardStepTrustFramework({ state, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Trust Framework Compliance
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Optionally require adherence to established trust frameworks. All
        selections here are optional.
      </p>

      {/* REFEDS Sirtfi */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={state.sirtfi}
                onChange={(e) => onChange({ sirtfi: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-gray-900">REFEDS Sirtfi</span>
                <HelpTip text="Security Incident Response Trust Framework for Federated Identity. Entities commit to a set of security incident response expectations." />
              </div>
              <p className="text-xs text-gray-500">Security incident response framework</p>
            </div>
          </div>
        </div>

        {/* REFEDS R&S */}
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={state.researchAndScholarship}
                onChange={(e) => onChange({ researchAndScholarship: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-gray-900">REFEDS R&S</span>
                <HelpTip text="Research & Scholarship entity category. Entities release a minimum set of attributes to service providers for research collaboration." />
              </div>
              <p className="text-xs text-gray-500">Research & Scholarship entity category</p>
            </div>
          </div>
        </div>

        {/* RAF Level */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="font-semibold text-sm text-gray-900">REFEDS RAF Level</span>
            <HelpTip text="REFEDS Assurance Framework defines identity assurance profiles. Higher levels require stronger verification of entity representatives." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RAF_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={clsx(
                  'flex flex-col items-center rounded-lg border p-3 cursor-pointer text-center transition-colors',
                  state.rafLevel === opt.value
                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <input
                  type="radio"
                  name="rafLevel"
                  value={opt.value}
                  checked={state.rafLevel === opt.value}
                  onChange={() => onChange({ rafLevel: opt.value })}
                  className="sr-only"
                />
                <span className="font-medium text-sm text-gray-900">{opt.label}</span>
                <span className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom requirements */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="font-semibold text-sm text-gray-900">Custom Requirements</span>
            <HelpTip text="Add free-text requirements specific to your federation that aren't covered by the standard frameworks above." />
          </div>
          <TagInput
            value={state.customRequirements}
            onChange={(tags) => onChange({ customRequirements: tags })}
            placeholder="Type a requirement and press Enter"
          />
        </div>
      </div>
    </div>
  );
}
