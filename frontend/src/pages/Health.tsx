import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useDashboardStats, useExpiringItems } from '../hooks/useHealth';

export default function Health() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: expiring } = useExpiringItems(7);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const hasIssues = (stats?.statements.expired ?? 0) > 0 ||
    (stats?.statements.expiring_soon ?? 0) > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Health</h1>
        <p className="text-gray-500 text-sm mt-1">Federation health status and expiry monitoring</p>
      </div>

      {/* Overall Status */}
      <div className={`rounded-lg p-6 mb-6 ${hasIssues ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-center gap-3">
          {hasIssues ? (
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          ) : (
            <CheckCircle className="w-8 h-8 text-green-600" />
          )}
          <div>
            <h2 className={`text-lg font-semibold ${hasIssues ? 'text-yellow-800' : 'text-green-800'}`}>
              {hasIssues ? 'Attention Required' : 'All Systems Healthy'}
            </h2>
            <p className={`text-sm ${hasIssues ? 'text-yellow-600' : 'text-green-600'}`}>
              {stats?.statements.expired ? `${stats.statements.expired} expired statement(s). ` : ''}
              {stats?.statements.expiring_soon ? `${stats.statements.expiring_soon} expiring soon.` : ''}
              {!hasIssues && 'No issues detected.'}
            </p>
          </div>
        </div>
      </div>

      {/* Statement Health */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statement Health</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{stats?.statements.current ?? 0}</div>
            <div className="text-sm text-green-600">Current</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">{stats?.statements.expiring_soon ?? 0}</div>
            <div className="text-sm text-yellow-600">Expiring Soon</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{stats?.statements.expired ?? 0}</div>
            <div className="text-sm text-red-600">Expired</div>
          </div>
        </div>
      </div>

      {/* Expiring Items */}
      {expiring && (expiring.statements.length > 0 || expiring.trust_marks.length > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Expiring Within 7 Days</h2>

          {expiring.statements.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Statements</h3>
              <div className="space-y-2">
                {expiring.statements.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{s.subject}</p>
                      <p className="text-xs text-gray-500">Expires: {new Date(s.expires_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiring.trust_marks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Trust Marks</h3>
              <div className="space-y-2">
                {expiring.trust_marks.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{m.subject}</p>
                      <p className="text-xs text-gray-500">{m.trust_mark_id} · Expires: {m.expires_at ? new Date(m.expires_at).toLocaleString() : 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
