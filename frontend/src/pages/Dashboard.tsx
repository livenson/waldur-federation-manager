import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { monitoringApi, instanceApi } from '../api/client';
import type { DashboardStats, FederationAlert, WaldurInstance } from '../api/types';

const statusColors = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-red-100 text-red-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unknown: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-blue-100 text-blue-800',
};

const alertSeverityColors = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-200 text-red-900 border-red-300',
};

export default function Dashboard() {
  const { federationSlug = 'ercf' } = useParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<FederationAlert[]>([]);
  const [instances, setInstances] = useState<WaldurInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [dashboardData, alertsData, instancesData] = await Promise.all([
          monitoringApi.getDashboard(federationSlug),
          monitoringApi.getActiveAlerts(federationSlug),
          instanceApi.list(federationSlug),
        ]);
        setStats(dashboardData);
        setAlerts(alertsData);
        setInstances(instancesData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [federationSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const totalAlerts = Object.values(stats.active_alerts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{stats.federation.name}</h1>
        <p className="text-gray-500">Federation monitoring dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Instances */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Instances</h3>
            <span className="text-2xl font-bold text-gray-900">{stats.instances.total}</span>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {stats.instances.online} online
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {stats.instances.offline} offline
            </span>
            {stats.instances.degraded > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                {stats.instances.degraded} degraded
              </span>
            )}
          </div>
        </div>

        {/* Connections */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Connections</h3>
            <span className="text-2xl font-bold text-gray-900">{stats.connections.total}</span>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {stats.connections.active} active
            </span>
            {stats.connections.pending > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                {stats.connections.pending} pending
              </span>
            )}
            {stats.connections.failed > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                {stats.connections.failed} failed
              </span>
            )}
          </div>
        </div>

        {/* Transactions (24h) */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Transactions (24h)</h3>
            <span className="text-2xl font-bold text-gray-900">{stats.transactions_24h.total}</span>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-green-600">{stats.transactions_24h.completed} completed</span>
            {stats.transactions_24h.failed > 0 && (
              <span className="text-red-600">{stats.transactions_24h.failed} failed</span>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className={`bg-white rounded-lg shadow p-6 ${totalAlerts > 0 ? 'ring-2 ring-red-200' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Active Alerts</h3>
            <span className={`text-2xl font-bold ${totalAlerts > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {totalAlerts}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            {stats.active_alerts.critical > 0 && (
              <span className="text-red-700">{stats.active_alerts.critical} critical</span>
            )}
            {stats.active_alerts.error > 0 && (
              <span className="text-red-600">{stats.active_alerts.error} error</span>
            )}
            {stats.active_alerts.warning > 0 && (
              <span className="text-yellow-600">{stats.active_alerts.warning} warning</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Active Alerts</h2>
            <Link
              to={`/federations/${federationSlug}/monitoring`}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {alerts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No active alerts
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`px-6 py-4 ${alertSeverityColors[alert.severity]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm mt-1 opacity-75">{alert.description}</p>
                    </div>
                    <span className="text-xs uppercase font-medium px-2 py-1 rounded">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instance Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Instance Status</h2>
            <Link
              to={`/federations/${federationSlug}/instances`}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {instances.slice(0, 5).map((instance) => (
              <div key={instance.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{instance.name}</p>
                  <p className="text-sm text-gray-500">{instance.organization_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[instance.connection_status]}`}>
                    {instance.connection_status}
                  </span>
                  {instance.status === 'pending' && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                      pending approval
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
