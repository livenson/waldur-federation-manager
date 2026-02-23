import { ShieldCheck, Building2, UserCheck, Scale, Award } from 'lucide-react';

export default function WizardStepWelcome() {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Federation Verification Setup
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        This wizard configures how entities joining your federation prove their
        identity and organizational legitimacy. It will create the corresponding
        trust mark definitions and metadata policies automatically.
      </p>

      {/* 4-layer diagram */}
      <div className="space-y-3 mb-6">
        {[
          {
            icon: Building2,
            label: 'Organizational Verification',
            desc: 'Prove the entity is a real, registered organization.',
            color: 'bg-blue-50 text-blue-700 border-blue-200',
            iconColor: 'text-blue-500',
          },
          {
            icon: UserCheck,
            label: 'Identity Verification',
            desc: 'Prove representatives are who they claim to be.',
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            iconColor: 'text-emerald-500',
          },
          {
            icon: Scale,
            label: 'Trust Framework Compliance',
            desc: 'Declare adherence to REFEDS, RAF, or custom frameworks.',
            color: 'bg-amber-50 text-amber-700 border-amber-200',
            iconColor: 'text-amber-500',
          },
          {
            icon: Award,
            label: 'Trust Marks & Policy',
            desc: 'Automatically issue trust marks and enforce metadata policies.',
            color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            iconColor: 'text-indigo-500',
          },
        ].map((layer, i) => (
          <div
            key={layer.label}
            className={`flex items-start gap-3 rounded-lg border p-4 ${layer.color}`}
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold opacity-50">{i + 1}</span>
              <layer.icon className={`w-5 h-5 ${layer.iconColor}`} />
            </div>
            <div>
              <div className="font-semibold text-sm">{layer.label}</div>
              <div className="text-xs opacity-80 mt-0.5">{layer.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <ShieldCheck className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p>
          Each layer builds on the previous one. You can enable as many or as
          few verification methods as your federation requires. Click{' '}
          <strong>Next</strong> to begin.
        </p>
      </div>
    </div>
  );
}
