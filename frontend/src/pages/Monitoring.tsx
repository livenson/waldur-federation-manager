import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { monitoringApi, instanceApi } from '../api/client';
import type { FederationTransaction, FederationAlert, WaldurInstance } from '../api/types';

const transactionStatusColors = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rolled_back: 'bg-orange-100 text-orange-800',
};

const alertSeverityColors = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-200 text-red-900 border-red-300',
};

const alertStatusColors = {
  active: 'bg-red-100 text-red-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
};

type Tab = 'transactions' | 'alerts';

export default function Monitoring() {
  const { federationSlug = 'ercf' } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [transactions, setTransactions] = useState<FederationTransaction[]>([]);
  const [alerts, setAlerts] = useState<FederationAlert[]>([]);
  const [instances, setInstances] = useState<WaldurInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [txStatusFilter, setTxStatusFilter] = useState<string>('');
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [txData, alertsData, instancesData] = await Promise.all([
        monitoringApi.listTransactions(federationSlug, txStatusFilter ? { status: txStatusFilter } : undefined),
        monitoringApi.listAlerts(federationSlug, {
          status: alertStatusFilter || undefined,
          severity: alertSeverityFilter || undefined,
        }),
        instanceApi.list(federationSlug),
      ]);
      setTransactions(txData);
      setAlerts(alertsData);
      setInstances(instancesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [federationSlug, txStatusFilter, alertStatusFilter, alertSeverityFilter]);

  const getInstanceName = (instanceId: string | null) => {
    if (!instanceId) return '-';
    const instance = instances.find(i => i.id === instanceId);
    return instance?.name || instanceId;
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await monitoringApi.acknowledgeAlert(federationSlug, alertId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await monitoringApi.resolveAlert(federationSlug, alertId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  if (loading && transactions.length === 0 && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monitoring</h1>
        <p className="text-gray-500">Track transactions and alerts across the federation</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Transactions
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {transactions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'alerts'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alerts
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
              alerts.filter(a => a.status === 'active').length > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {alerts.filter(a => a.status === 'active').length}
            </span>
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={txStatusFilter}
                onChange={(e) => setTxStatusFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Transaction List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {tx.transaction_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getInstanceName(tx.source_instance_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getInstanceName(tx.target_instance_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${transactionStatusColors[tx.status]}`}>
                        {tx.status.replace(/_/g, ' ')}
                      </span>
                      {tx.error_message && (
                        <span className="ml-2 text-xs text-red-600" title={tx.error_message}>
                          (error)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.duration_ms ? `${tx.duration_ms}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No transactions found
              </div>
            )}
          </div>
        </>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={alertSeverityFilter}
                onChange={(e) => setAlertSeverityFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          {/* Alert List */}
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-gray-500">
                No alerts found
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-white rounded-lg shadow border-l-4 ${alertSeverityColors[alert.severity]}`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${alertSeverityColors[alert.severity]}`}>
                            {alert.severity}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${alertStatusColors[alert.status]}`}>
                            {alert.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            {alert.alert_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-medium text-gray-900">{alert.title}</h3>
                        <p className="mt-1 text-gray-600">{alert.description}</p>
                        <div className="mt-2 text-sm text-gray-500">
                          {alert.instance_id && (
                            <span>Instance: {getInstanceName(alert.instance_id)} · </span>
                          )}
                          Created: {new Date(alert.created_at).toLocaleString()}
                          {alert.acknowledged_at && (
                            <span> · Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}</span>
                          )}
                          {alert.resolved_at && (
                            <span> · Resolved: {new Date(alert.resolved_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
