import { useState, useCallback, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ value, onChange, placeholder = 'Type and press Enter' }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  }, [input, value, onChange]);

  const removeTag = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:ring-offset-0 bg-white min-h-[38px]">
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(); }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] border-0 p-0 text-sm focus:outline-none focus:ring-0"
      />
    </div>
  );
}
