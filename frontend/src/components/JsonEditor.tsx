import { useState, useCallback } from 'react';
import clsx from 'clsx';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function JsonEditor({ value, onChange, error: externalError }: JsonEditorProps) {
  const [internalError, setInternalError] = useState<string | null>(null);

  const displayError = externalError || internalError;

  const handleBlur = useCallback(() => {
    if (!value.trim()) {
      setInternalError(null);
      return;
    }

    try {
      JSON.parse(value);
      setInternalError(null);
    } catch (e) {
      setInternalError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [value]);

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        rows={12}
        spellCheck={false}
        className={clsx(
          'w-full rounded-md border px-3 py-2 text-sm font-mono',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'resize-y',
          displayError
            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
            : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-200'
        )}
        placeholder='{ "key": "value" }'
      />
      {displayError && (
        <p className="mt-1.5 text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
}
