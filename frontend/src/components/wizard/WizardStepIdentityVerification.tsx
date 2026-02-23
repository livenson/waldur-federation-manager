import clsx from 'clsx';
import HelpTip from '../HelpTip';
import type { IdentityMethodOption } from './types';
import { IDENTITY_METHODS } from './types';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

const assuranceBadge: Record<string, string> = {
  High: 'bg-green-100 text-green-700',
  Substantial: 'bg-blue-100 text-blue-700',
  Federated: 'bg-purple-100 text-purple-700',
  Interoperable: 'bg-cyan-100 text-cyan-700',
  Variable: 'bg-gray-100 text-gray-600',
};

function MethodCard({
  method,
  isSelected,
  onToggle,
}: {
  method: IdentityMethodOption;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={clsx(
        'border rounded-lg p-4 cursor-pointer transition-colors',
        isSelected
          ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-semibold text-sm text-gray-900">{method.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={clsx(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              assuranceBadge[method.assurance] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {method.assurance}
          </span>
          <HelpTip text={method.helpDetail} />
        </div>
      </div>
      <p className="text-xs text-gray-500 ml-6">{method.description}</p>
    </div>
  );
}

export default function WizardStepIdentityVerification({ selected, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Identity Verification
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Select at least one method for entity representatives to prove their
        personal identity.
      </p>

      <div className="space-y-3">
        {IDENTITY_METHODS.map((m) => (
          <MethodCard
            key={m.id}
            method={m}
            isSelected={selected.includes(m.id)}
            onToggle={() => toggle(m.id)}
          />
        ))}
      </div>

      {selected.length === 0 && (
        <p className="mt-4 text-xs text-amber-600">
          Please select at least one verification method to continue.
        </p>
      )}
    </div>
  );
}
