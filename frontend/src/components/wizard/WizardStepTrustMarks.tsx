import clsx from 'clsx';
import { Award } from 'lucide-react';
import type { TrustMarkTier } from './types';

interface Props {
  baseUrl: string;
  tiers: TrustMarkTier[];
  onBaseUrlChange: (url: string) => void;
  onTierToggle: (tierId: string) => void;
  onTierRename: (tierId: string, name: string) => void;
}

export default function WizardStepTrustMarks({
  baseUrl,
  tiers,
  onBaseUrlChange,
  onTierToggle,
  onTierRename,
}: Props) {
  const enabledCount = tiers.filter((t) => t.enabled).length;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Trust Mark Mapping</h2>
      <p className="text-sm text-gray-500 mb-5">
        Based on your selections, the following trust mark definitions will be
        created. You can toggle tiers on/off and edit display names.
      </p>

      {/* Base URL input */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Federation Base URL
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://federation.example.org"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Used to construct trust mark ID URLs, e.g.{' '}
          <code className="bg-gray-100 px-1 rounded">
            {baseUrl || 'https://federation.example.org'}/trust-marks/org-verified
          </code>
        </p>
      </div>

      {/* Tier list */}
      {tiers.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No trust marks to create. Go back and select verification methods or
          framework options.
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier) => {
            const idUrl = `${baseUrl || 'https://federation.example.org'}/trust-marks/${tier.trustMarkIdSuffix}`;
            return (
              <div
                key={tier.id}
                className={clsx(
                  'border rounded-lg p-4 transition-colors',
                  tier.enabled
                    ? 'border-indigo-200 bg-indigo-50/50'
                    : 'border-gray-200 bg-gray-50 opacity-60',
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={tier.enabled}
                    onChange={() => onTierToggle(tier.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Award
                    className={clsx(
                      'w-4 h-4 shrink-0',
                      tier.enabled ? 'text-indigo-500' : 'text-gray-400',
                    )}
                  />
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => onTierRename(tier.id, e.target.value)}
                    disabled={!tier.enabled}
                    className="flex-1 bg-transparent border-0 border-b border-dashed border-gray-300 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-400 disabled:text-gray-400 px-0 py-0.5"
                  />
                </div>
                <p className="text-xs text-gray-500 ml-10 font-mono break-all">{idUrl}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        {enabledCount} trust mark definition{enabledCount !== 1 ? 's' : ''} will
        be created.
      </p>
    </div>
  );
}
