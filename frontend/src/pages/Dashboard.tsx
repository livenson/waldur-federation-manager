import { useMemo } from 'react';
import {
  Server, FileText, Shield, Key, AlertTriangle, Network, Clock, User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboardStats, useExpiringItems } from '../hooks/useHealth';
import { useTopologySummary } from '../hooks/useFederation';
import { useEntities, useEntity } from '../hooks/useEntities';
import { useStatements } from '../hooks/useStatements';
import { useTrustMarks } from '../hooks/useTrustMarks';
import { useRole } from '../contexts/RoleContext';
import HelpTip from '../components/HelpTip';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: expiring } = useExpiringItems(3);
  const { data: topologySummary } = useTopologySummary();
  const { data: entitiesData } = useEntities();
  const { data: statementsData } = useStatements();
  const { data: trustMarksData } = useTrustMarks();
  const { isManager, isMember, memberEntityId } = useRole();
  const { data: myEntity } = useEntity(memberEntityId ?? '');

  const entities = entitiesData?.entities ?? [];
  const statements = statementsData?.statements ?? [];
  const trustMarks = trustMarksData?.trust_marks ?? [];

  // Entity name lookup for activity labels
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entities) {
      map.set(e.id, e.name);
      map.set(e.entity_id, e.name);
    }
    return map;
  }, [entities]);

  // Recent Activity
  const recentActivity = useMemo(() => {
    const events: { type: string; label: string; timestamp: string; color: string }[] = [];
    for (const e of entities) {
      events.push({ type: 'create', label: `Entity "${e.name}" created`, timestamp: e.created_at, color: 'green' });
      if (e.updated_at !== e.created_at) {
        events.push({ type: 'update', label: `Entity "${e.name}" updated`, timestamp: e.updated_at, color: 'blue' });
      }
    }
    for (const s of statements) {
      const name = entityNameMap.get(s.subject_entity_id) ?? s.subject_entity_id;
      events.push({ type: 'issue', label: `Statement for "${name}" issued`, timestamp: s.issued_at, color: 'indigo' });
    }
    for (const m of trustMarks) {
      const name = entityNameMap.get(m.subject_entity_id) ?? m.subject_entity_id;
      events.push({ type: 'issue', label: `Trust mark issued to "${name}"`, timestamp: m.issued_at, color: 'indigo' });
      if (m.status === 'revoked' && m.revoked_at) {
        events.push({ type: 'revoke', label: `Trust mark revoked from "${name}"`, timestamp: m.revoked_at, color: 'red' });
      }
    }
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);
  }, [entities, statements, trustMarks, entityNameMap]);

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

      {/* My Entity card — member mode */}
      {isMember && myEntity && (
        <div className="bg-white rounded-lg shadow p-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{myEntity.name}</h3>
              <p className="text-xs text-gray-500">
                {myEntity.entity_id}
                {' '}&middot;{' '}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  myEntity.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>{myEntity.status}</span>
              </p>
            </div>
          </div>
          <Link
            to={`/entities/${myEntity.id}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 whitespace-nowrap"
          >
            View Details &rarr;
          </Link>
        </div>
      )}

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

      {/* Federation Overview */}
      {topologySummary && topologySummary.total_instances > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Federation Instances</h3>
              <p className="text-xs text-gray-500">
                {topologySummary.healthy_instances}/{topologySummary.total_instances} connected
                {' '}&middot;{' '}
                {topologySummary.total_federations} federation{topologySummary.total_federations !== 1 ? 's' : ''}
                {' '}&middot;{' '}
                {topologySummary.total_users} users
              </p>
            </div>
          </div>
          <Link
            to="/federation"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 whitespace-nowrap"
          >
            View Federation &rarr;
          </Link>
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
                {expiring.trust_marks.length} trust mark(s) expiring:
              </p>
              {expiring.trust_marks.map(tm => (
                <p key={tm.id} className="text-sm text-yellow-600 ml-4">
                  {tm.subject} ({tm.trust_mark_id.split('/').pop()}) — expires {tm.expires_at ? new Date(tm.expires_at).toLocaleDateString() : 'unknown'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Timeline */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  event.color === 'green' ? 'bg-green-500' :
                  event.color === 'blue' ? 'bg-blue-500' :
                  event.color === 'indigo' ? 'bg-indigo-500' :
                  'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{event.label}</p>
                  <p className="text-xs text-gray-400">{timeAgo(event.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No recent activity</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {isManager && (
            <>
              <Link to="/federation/join" className="btn-primary">
                Join Federation
              </Link>
              <Link to="/entities/register" className="btn-secondary">
                Register Entity
              </Link>
            </>
          )}
          <Link to="/trust-chain" className="btn-secondary">
            View Trust Chain
          </Link>
          {isManager && (
            <Link to="/policies" className="btn-secondary">
              Manage Policies
            </Link>
          )}
          {isMember && memberEntityId && (
            <Link to={`/entities/${memberEntityId}`} className="btn-secondary">
              My Entity
            </Link>
          )}
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
