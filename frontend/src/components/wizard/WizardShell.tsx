import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const STEP_LABELS = [
  'Welcome',
  'Organization',
  'Identity',
  'Framework',
  'Trust Marks',
  'Policy',
  'Review',
];

interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Replace "Next" on the final step */
  submitLabel?: string;
  isSubmitting?: boolean;
  children: React.ReactNode;
}

export default function WizardShell({
  currentStep,
  totalSteps,
  canNext,
  onBack,
  onNext,
  submitLabel,
  isSubmitting,
  children,
}: WizardShellProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <nav className="mb-8">
        <ol className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <li key={label} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-center">
                  {i > 0 && (
                    <div
                      className={clsx(
                        'flex-1 h-0.5',
                        done ? 'bg-indigo-600' : 'bg-gray-200',
                      )}
                    />
                  )}
                  <span
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors',
                      done
                        ? 'bg-indigo-600 text-white'
                        : active
                          ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600'
                          : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {i + 1}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={clsx(
                        'flex-1 h-0.5',
                        done ? 'bg-indigo-600' : 'bg-gray-200',
                      )}
                    />
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-1.5 text-[11px] font-medium hidden sm:block',
                    active ? 'text-indigo-700' : done ? 'text-gray-600' : 'text-gray-400',
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="bg-white rounded-lg shadow p-6 sm:p-8 min-h-[400px]">
        {children}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          disabled={isFirst}
          className={clsx(
            'btn-secondary flex items-center gap-1',
            isFirst && 'invisible',
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={onNext}
          disabled={!canNext || isSubmitting}
          className="btn-primary flex items-center gap-1"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Applying...
            </>
          ) : isLast ? (
            submitLabel ?? 'Apply Configuration'
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
