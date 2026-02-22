import { useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import TagInput from './TagInput';

type PolicyValue = Record<string, Record<string, unknown>>;

interface PolicyBuilderProps {
  value: PolicyValue;
  onChange: (policy: PolicyValue) => void;
}

const OPERATORS = [
  { key: 'value', label: 'value', type: 'tags' as const, desc: 'Replace unconditionally' },
  { key: 'add', label: 'add', type: 'tags' as const, desc: 'Append values to list' },
  { key: 'default', label: 'default', type: 'tags' as const, desc: 'Set if missing' },
  { key: 'one_of', label: 'one_of', type: 'tags' as const, desc: 'Must be one of these' },
  { key: 'subset_of', label: 'subset_of', type: 'tags' as const, desc: 'Must be subset of these' },
  { key: 'superset_of', label: 'superset_of', type: 'tags' as const, desc: 'Must be superset of these' },
  { key: 'essential', label: 'essential', type: 'boolean' as const, desc: 'Must be present' },
] as const;

function normalizeToArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

export default function PolicyBuilder({ value, onChange }: PolicyBuilderProps) {
  const claims = Object.entries(value);

  const updateClaim = useCallback((oldName: string, newName: string, operators: Record<string, unknown>) => {
    const next: PolicyValue = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldName) {
        next[newName] = operators;
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  }, [value, onChange]);

  const removeClaim = useCallback((name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  }, [value, onChange]);

  const addClaim = useCallback(() => {
    let name = 'new_claim';
    let i = 1;
    while (value[name]) {
      name = `new_claim_${i++}`;
    }
    onChange({ ...value, [name]: {} });
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      {claims.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6">No claims defined. Add a claim to get started.</p>
      )}

      {claims.map(([claimName, operators]) => (
        <ClaimCard
          key={claimName}
          name={claimName}
          operators={operators}
          onNameChange={(newName) => updateClaim(claimName, newName, operators)}
          onOperatorsChange={(ops) => updateClaim(claimName, claimName, ops)}
          onRemove={() => removeClaim(claimName)}
        />
      ))}

      <button
        type="button"
        onClick={addClaim}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Add claim
      </button>
    </div>
  );
}

interface ClaimCardProps {
  name: string;
  operators: Record<string, unknown>;
  onNameChange: (name: string) => void;
  onOperatorsChange: (operators: Record<string, unknown>) => void;
  onRemove: () => void;
}

function ClaimCard({ name, operators, onNameChange, onOperatorsChange, onRemove }: ClaimCardProps) {
  const usedOperators = Object.keys(operators);
  const availableOperators = OPERATORS.filter(op => !usedOperators.includes(op.key));

  const setOperator = (key: string, val: unknown) => {
    onOperatorsChange({ ...operators, [key]: val });
  };

  const removeOperator = (key: string) => {
    const next = { ...operators };
    delete next[key];
    onOperatorsChange(next);
  };

  const addOperator = (key: string) => {
    const op = OPERATORS.find(o => o.key === key);
    if (!op) return;
    const defaultVal = op.type === 'boolean' ? true : [];
    setOperator(key, defaultVal);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          placeholder="claim_name"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
          title="Remove claim"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {usedOperators.map(key => {
          const opDef = OPERATORS.find(o => o.key === key);
          if (!opDef) return null;

          return (
            <div key={key} className="flex items-start gap-2 pl-2 border-l-2 border-indigo-100">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {opDef.label}
                  </span>
                  <span className="text-xs text-gray-400">{opDef.desc}</span>
                </div>
                {opDef.type === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={operators[key] === true}
                      onChange={e => setOperator(key, e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Required
                  </label>
                ) : (
                  <TagInput
                    value={normalizeToArray(operators[key])}
                    onChange={tags => setOperator(key, tags)}
                    placeholder={`Add ${opDef.label} values...`}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeOperator(key)}
                className="p-1 text-gray-400 hover:text-red-500 mt-0.5"
                title="Remove operator"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {availableOperators.length > 0 && (
        <div className="mt-3">
          <select
            value=""
            onChange={e => {
              if (e.target.value) addOperator(e.target.value);
            }}
            className="text-sm rounded-md border border-gray-200 px-2 py-1 text-gray-500 focus:outline-none focus:border-indigo-400"
          >
            <option value="">+ Add operator...</option>
            {availableOperators.map(op => (
              <option key={op.key} value={op.key}>
                {op.label} — {op.desc}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
