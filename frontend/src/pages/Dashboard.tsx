import { Server, FileText, Shield, Key, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboardStats, useExpiringItems } from '../hooks/useHealth';
import HelpTip from '../components/HelpTip';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: expiring } = useExpiringItems(3);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          OpenID Federation Trust Anchor overview
          <HelpTip className="ml-1" text="This dashboard manages an OIDC Federation trust infrastructure. A Trust Anchor sits at the root, issuing Subordinate Statements to intermediate authorities and leaf entities. Together they form a trust chain that relying parties resolve to verify identity. Trust Marks provide additional quality signals, and Metadata Policies constrain what subordinate entities can publish." />
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Server}
          title="Entities"
          value={stats?.entities.total ?? 0}
          subtitle={`${stats?.entities.by_status?.active ?? 0} active`}
          color="indigo"
          help="Federation participants — OpenID Providers, Relying Parties, intermediate authorities, and other entities in the trust hierarchy."
        />
        <StatCard
          icon={FileText}
          title="Statements"
          value={stats?.statements.current ?? 0}
          subtitle={stats?.statements.expiring_soon ? `${stats.statements.expiring_soon} expiring soon` : 'All healthy'}
          color="blue"
          help="Subordinate Statements are signed JWTs issued by an authority about a subordinate entity. They form the edges of the trust chain and must be periodically renewed."
        />
        <StatCard
          icon={Shield}
          title="Trust Marks"
          value={stats?.trust_marks.active ?? 0}
          subtitle={`${stats?.trust_marks.definitions ?? 0} definitions`}
          color="green"
          help="Signed credentials asserting that an entity meets certain criteria (e.g., 'EuroHPC Member'). Unlike statements, trust marks are optional quality signals, not structural trust."
        />
        <StatCard
          icon={Key}
          title="Active Keys"
          value={stats?.keys.active ?? 0}
          subtitle="Signing keys"
          color="purple"
          help="Cryptographic keys (JWKs) used to sign Entity Configurations, subordinate statements, and trust marks. Each entity has its own key set."
        />
      </div>

      {/* Entity Status Breakdown */}
      {stats?.entities.by_status && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Entity Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(stats.entities.by_status).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className={`text-xs font-medium uppercase ${
                  status === 'active' ? 'text-green-600' :
                  status === 'suspended' ? 'text-yellow-600' :
                  status === 'revoked' ? 'text-red-600' :
                  'text-gray-500'
                }`}>{status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Items Warning */}
      {expiring && (expiring.statements.length > 0 || expiring.trust_marks.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">Expiring Soon</h3>
          </div>
          {expiring.statements.length > 0 && (
            <div className="mb-2">
              <p className="text-sm text-yellow-700 font-medium">
                {expiring.statements.length} statement(s) expiring:
              </p>
              {expiring.statements.map(s => (
                <p key={s.id} className="text-sm text-yellow-600 ml-4">
                  {s.subject} — expires {new Date(s.expires_at).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
          {expiring.trust_marks.length > 0 && (
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                {expiring.trust_marks.length} trust mark(s) expiring
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/entities/register" className="btn-primary">
            Register Entity
          </Link>
          <Link to="/trust-chain" className="btn-secondary">
            View Trust Chain
          </Link>
          <Link to="/policies" className="btn-secondary">
            Manage Policies
          </Link>
          <Link to="/health" className="btn-secondary">
            Health Check
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
  help,
}: {
  icon: React.ElementType;
  title: string;
  value: number | string;
  subtitle?: string;
  color: string;
  help?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.indigo}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">
            {title}
            {help && <HelpTip className="ml-1" text={help} />}
          </p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
