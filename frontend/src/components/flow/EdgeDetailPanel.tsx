import { useState } from 'react';
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { SubordinateStatement } from '../../api/types';

interface EdgeDetailPanelProps {
  statement: SubordinateStatement | null;
  issuerName?: string;
  subjectName?: string;
  onClose: () => void;
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const now = new Date();
  const exp = new Date(expiresAt);
  const daysLeft = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">expired</span>;
  }
  if (daysLeft <= 7) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{Math.round(daysLeft)}d left</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{Math.round(daysLeft)}d left</span>;
}

function CollapsibleJson({ label, data }: { label: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const isEmpty = Object.keys(data).length === 0;

  if (isEmpty) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700 w-full"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-48 text-gray-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function EdgeDetailPanel({ statement, issuerName, subjectName, onClose }: EdgeDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!statement) return null;

  const jwtPreview = statement.jwt.length > 80
    ? statement.jwt.slice(0, 80) + '...'
    : statement.jwt;

  const handleCopyJwt = () => {
    navigator.clipboard.writeText(statement.jwt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-10 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Statement Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Issuer</label>
          <p className="text-sm font-medium text-gray-900">{issuerName || 'Unknown'}</p>
          <p className="text-xs text-gray-500 break-all">{statement.issuer_entity_id}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Subject</label>
          <p className="text-sm font-medium text-gray-900">{subjectName || 'Unknown'}</p>
          <p className="text-xs text-gray-500 break-all">{statement.subject_entity_id}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Issued at</label>
            <p className="text-sm text-gray-700">{new Date(statement.issued_at).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Expires at</label>
            <p className="text-sm text-gray-700">{new Date(statement.expires_at).toLocaleString()}</p>
            <ExpiryBadge expiresAt={statement.expires_at} />
          </div>
        </div>

        <CollapsibleJson label="Metadata Override" data={statement.metadata_override} />
        <CollapsibleJson label="Metadata Policy" data={statement.metadata_policy} />
        <CollapsibleJson label="Constraints" data={statement.constraints} />

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">JWT</label>
          <div className="mt-1 bg-gray-50 rounded p-2">
            <p className="text-xs font-mono text-gray-600 break-all">{jwtPreview}</p>
            <button
              type="button"
              onClick={handleCopyJwt}
              className="mt-1.5 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy full JWT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
