import { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  text: string;
  className?: string;
}

export default function HelpTip({ text, className = '' }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const ref = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // If there's less than 100px above the button, show tooltip below
    setPosition(rect.top < 100 ? 'below' : 'above');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  return (
    <span className={`relative inline-flex ${className}`} ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (open) setOpen(false); else handleOpen(); }}
        onMouseEnter={handleOpen}
        onMouseLeave={() => setOpen(false)}
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
        aria-label="Help"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        position === 'above' ? (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg leading-relaxed">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-white border-b border-r border-gray-200 rotate-45" />
          </div>
        ) : (
          <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg leading-relaxed">
            {text}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px w-2 h-2 bg-white border-t border-l border-gray-200 rotate-45" />
          </div>
        )
      )}
    </span>
  );
}

interface HelpBannerProps {
  children: React.ReactNode;
  className?: string;
}

export function HelpBanner({ children, className = '' }: HelpBannerProps) {
  return (
    <div className={`bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 leading-relaxed ${className}`}>
      {children}
    </div>
  );
}
