import { useState, useMemo } from 'react';
import {
  Server, FileText, Shield, Key, AlertTriangle,
  Globe, Clock, GitFork, CheckCircle2, XCircle, RefreshCw, Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboardStats, useExpiringItems } from '../hooks/useHealth';
import { useEntities } from '../hooks/useEntities';
import { useStatements } from '../hooks/useStatements';
import { usePolicies, useEvaluatePolicy } from '../hooks/usePolicies';
import { useTrustMarks, useTrustMarkDefinitions } from '../hooks/useTrustMarks';
import type { PolicyEvaluationResponse } from '../api/types';
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
  const { data: entitiesData } = useEntities();
  const { data: statementsData } = useStatements();
  const { data: policiesData } = usePolicies();
  const { data: trustMarksData } = useTrustMarks();
  const { data: trustMarkDefs } = useTrustMarkDefinitions();
  const evaluatePolicy = useEvaluatePolicy();

  const [complianceResults, setComplianceResults] = useState<PolicyEvaluationResponse[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const entities = entitiesData?.entities ?? [];
  const statements = statementsData?.statements ?? [];
  const policies = policiesData?.policies ?? [];
  const trustMarks = trustMarksData?.trust_marks ?? [];
  const definitions = trustMarkDefs?.definitions ?? [];

  // Entity name lookup for activity labels
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entities) {
      map.set(e.id, e.name);
      map.set(e.entity_id, e.name);
    }
    return map;
  }, [entities]);

  // Statement Health
  const statementHealth = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    let current = 0, expiringSoon = 0, expired = 0;
    for (const s of statements) {
      const exp = new Date(s.expires_at).getTime();
      if (exp < now) expired++;
      else if (exp - now < sevenDays) expiringSoon++;
      else current++;
    }
    return { current, expiringSoon, expired, total: statements.length };
  }, [statements]);

  // Geographic Distribution
  const geoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) {
      const country = e.country || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entities]);

  // Entity Type Distribution
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) {
      for (const t of e.entity_types) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entities]);

  // Trust Mark Coverage
  const trustMarkCoverage = useMemo(() => {
    const activeMarks = trustMarks.filter(m => m.status === 'active');
    const coveredEntities = new Set(activeMarks.map(m => m.subject_entity_id));
    const perDefinition = definitions.map(d => ({
      name: d.name,
      count: activeMarks.filter(m => m.trust_mark_id === d.trust_mark_id).length,
    }));
    return {
      coveredCount: coveredEntities.size,
      totalEntities: entitiesData?.total ?? 0,
      perDefinition,
    };
  }, [trustMarks, definitions, entitiesData]);

  // Federation Tree
  const treeSummary = useMemo(() => {
    const active = entities.filter(e => e.status === 'active');
    const pointedTo = new Set<string>();
    for (const e of active) {
      for (const hint of e.authority_hints) {
        pointedTo.add(hint);
      }
    }
    let anchors = 0, intermediaries = 0, leaves = 0;
    for (const e of active) {
      const hasHints = e.authority_hints.length > 0;
      const isPointedTo = pointedTo.has(e.entity_id);
      if (!hasHints) anchors++;
      else if (isPointedTo) intermediaries++;
      else leaves++;
    }
    return { anchors, intermediaries, leaves };
  }, [entities]);

  // Key Algorithms
  const algCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) {
      for (const key of e.jwks?.keys ?? []) {
        const alg = key.alg || 'unknown';
        counts[alg] = (counts[alg] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
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

  // Policy Compliance handler
  const handleCheckCompliance = async () => {
    if (policies.length === 0) return;
    setComplianceLoading(true);
    setComplianceResults([]);
    const results: PolicyEvaluationResponse[] = [];
    for (const p of policies) {
      try {
        const result = await evaluatePolicy.mutateAsync(p.id);
        results.push(result);
      } catch {
        // skip failed evaluations
      }
    }
    setComplianceResults(results);
    setComplianceLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const maxTypeCount = typeCounts.length > 0 ? typeCounts[0][1] : 1;

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

      {/* Statement Health + Expired Statements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Statement Health</h2>
          </div>
          {statementHealth.total > 0 ? (
            <>
              <div className="h-4 flex rounded-full overflow-hidden mb-3">
                {statementHealth.current > 0 && (
                  <div
                    className="bg-green-500"
                    style={{ width: `${(statementHealth.current / statementHealth.total) * 100}%` }}
                  />
                )}
                {statementHealth.expiringSoon > 0 && (
                  <div
                    className="bg-yellow-500"
                    style={{ width: `${(statementHealth.expiringSoon / statementHealth.total) * 100}%` }}
                  />
                )}
                {statementHealth.expired > 0 && (
                  <div
                    className="bg-red-500"
                    style={{ width: `${(statementHealth.expired / statementHealth.total) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  Current ({statementHealth.current})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                  Expiring ({statementHealth.expiringSoon})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  Expired ({statementHealth.expired})
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No statements yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Expired Statements</h2>
          </div>
          <div className={`text-4xl font-bold ${
            (stats?.statements.expired ?? 0) === 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stats?.statements.expired ?? 0}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {(stats?.statements.expired ?? 0) === 0
              ? 'All statements are up to date'
              : 'Statements need renewal'}
          </p>
        </div>
      </div>

      {/* Policy Compliance Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Policy Compliance</h2>
          </div>
          <button
            onClick={handleCheckCompliance}
            disabled={complianceLoading || policies.length === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {complianceLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Check Compliance
          </button>
        </div>
        {policies.length === 0 ? (
          <p className="text-sm text-gray-400">No policies defined</p>
        ) : complianceResults.length === 0 && !complianceLoading ? (
          <p className="text-sm text-gray-400">Click "Check Compliance" to evaluate all policies</p>
        ) : complianceLoading ? (
          <p className="text-sm text-gray-500">Evaluating policies...</p>
        ) : (
          <>
            {(() => {
              const withViolations = complianceResults.filter(r => r.non_compliant > 0).length;
              return (
                <p className={`text-sm font-medium mb-4 ${withViolations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {withViolations > 0
                    ? `${withViolations} of ${complianceResults.length} policies have violations`
                    : 'All policies are fully compliant'}
                </p>
              );
            })()}
            <div className="space-y-3">
              {complianceResults.map(r => (
                <div key={r.policy_id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{r.policy_name}</span>
                    <span className="text-gray-500">
                      {r.compliant}/{r.total_entities} compliant
                    </span>
                  </div>
                  <div className="h-2 flex rounded-full overflow-hidden bg-gray-100">
                    {r.total_entities > 0 && (
                      <div
                        className={r.non_compliant > 0 ? 'bg-green-500' : 'bg-green-500'}
                        style={{ width: `${(r.compliant / r.total_entities) * 100}%` }}
                      />
                    )}
                    {r.non_compliant > 0 && (
                      <div
                        className="bg-red-400"
                        style={{ width: `${(r.non_compliant / r.total_entities) * 100}%` }}
                      />
                    )}
                  </div>
                  {r.non_compliant > 0 && (
                    <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {r.non_compliant} non-compliant entit{r.non_compliant === 1 ? 'y' : 'ies'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Trust Mark Coverage */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Trust Mark Coverage</h2>
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold text-gray-900">{trustMarkCoverage.coveredCount}</span>
          <span className="text-lg text-gray-500">/ {trustMarkCoverage.totalEntities}</span>
          <span className="text-sm text-gray-400 ml-1">entities have active trust marks</span>
        </div>
        {trustMarkCoverage.perDefinition.length > 0 ? (
          <div className="space-y-2">
            {trustMarkCoverage.perDefinition.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{d.name}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {d.count} issued
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No trust mark definitions yet</p>
        )}
      </div>

      {/* Geographic Distribution + Entity Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Geographic Distribution</h2>
          </div>
          {geoCounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {geoCounts.map(([country, count]) => (
                <span
                  key={country}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700"
                >
                  {country}
                  <span className="ml-1.5 text-blue-500">({count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No entity data available</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Entity Type Distribution</h2>
          </div>
          {typeCounts.length > 0 ? (
            <div className="space-y-3">
              {typeCounts.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-mono text-xs">{type}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No entity data available</p>
          )}
        </div>
      </div>

      {/* Federation Tree + Key Algorithms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitFork className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Federation Tree</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-700">{treeSummary.anchors}</div>
              <div className="text-xs text-gray-500 uppercase font-medium">Trust Anchors</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{treeSummary.intermediaries}</div>
              <div className="text-xs text-gray-500 uppercase font-medium">Intermediaries</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{treeSummary.leaves}</div>
              <div className="text-xs text-gray-500 uppercase font-medium">Leaves</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Key Algorithms</h2>
          </div>
          {algCounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {algCounts.map(([alg, count]) => (
                <span
                  key={alg}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-50 text-purple-700"
                >
                  {alg}
                  <span className="ml-1.5 text-purple-500">({count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No key data available</p>
          )}
        </div>
      </div>

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
