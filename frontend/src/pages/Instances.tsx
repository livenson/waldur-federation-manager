import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { instanceApi } from '../api/client';
import type { WaldurInstance, InstanceStatus, ConnectionStatus } from '../api/types';

const statusColors: Record<InstanceStatus, string> = {
  pending: 'bg-orange-100 text-orange-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};

const connectionStatusColors: Record<ConnectionStatus, string> = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-red-100 text-red-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unknown: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-blue-100 text-blue-800',
};

export default function Instances() {
  const { federationSlug = 'ercf' } = useParams();
  const [instances, setInstances] = useState<WaldurInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WaldurInstance | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [connectionFilter, setConnectionFilter] = useState<string>('');

  const loadInstances = async () => {
    try {
      setLoading(true);
      const filters: { status?: string; connection_status?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      if (connectionFilter) filters.connection_status = connectionFilter;
      const data = await instanceApi.list(federationSlug, filters);
      setInstances(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, [federationSlug, statusFilter, connectionFilter]);

  const handleApprove = async (instanceId: string) => {
    try {
      await instanceApi.approve(federationSlug, instanceId);
      loadInstances();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve instance');
    }
  };

  const handleReject = async (instanceId: string) => {
    if (!confirm('Are you sure you want to reject this instance?')) return;
    try {
      await instanceApi.reject(federationSlug, instanceId);
      loadInstances();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject instance');
    }
  };

  const handleSuspend = async (instanceId: string) => {
    if (!confirm('Are you sure you want to suspend this instance?')) return;
    try {
      await instanceApi.suspend(federationSlug, instanceId);
      loadInstances();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend instance');
    }
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waldur Instances</h1>
          <p className="text-gray-500">Manage registered Waldur instances in the federation</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Register Instance
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Connection</label>
          <select
            value={connectionFilter}
            onChange={(e) => setConnectionFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All connections</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="degraded">Degraded</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Instance List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Instance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Connection
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stats
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {instances.map((instance) => (
              <tr key={instance.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-gray-900">{instance.name}</div>
                    <div className="text-sm text-gray-500">{instance.api_url}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{instance.organization_name}</div>
                  <div className="text-sm text-gray-500">{instance.country}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[instance.status]}`}>
                    {instance.status}
                  </span>
                  {!instance.tos_accepted && instance.status === 'pending' && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      ToS not accepted
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${connectionStatusColors[instance.connection_status]}`}>
                    {instance.connection_status}
                  </span>
                  {instance.version && (
                    <span className="ml-2 text-xs text-gray-500">v{instance.version}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{instance.offering_count} offerings</div>
                  <div>{instance.customer_count} customers</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedInstance(instance)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Details
                    </button>
                    {instance.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(instance.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(instance.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {instance.status === 'active' && (
                      <button
                        onClick={() => handleSuspend(instance.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {instances.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No instances found
          </div>
        )}
      </div>

      {/* Instance Detail Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{selectedInstance.name}</h2>
              <button
                onClick={() => setSelectedInstance(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Organization</label>
                  <p className="mt-1 text-gray-900">{selectedInstance.organization_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Country</label>
                  <p className="mt-1 text-gray-900">{selectedInstance.country}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">API URL</label>
                  <p className="mt-1 text-gray-900 break-all">{selectedInstance.api_url}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Admin Email</label>
                  <p className="mt-1 text-gray-900">{selectedInstance.admin_email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Version</label>
                  <p className="mt-1 text-gray-900">{selectedInstance.version || 'Unknown'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Seen</label>
                  <p className="mt-1 text-gray-900">
                    {selectedInstance.last_seen
                      ? new Date(selectedInstance.last_seen).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Description</label>
                <p className="mt-1 text-gray-900">{selectedInstance.description || 'No description'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Capabilities</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedInstance.capabilities.length > 0 ? (
                    selectedInstance.capabilities.map((cap) => (
                      <span key={cap} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">No capabilities listed</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Tags</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedInstance.tags.length > 0 ? (
                    selectedInstance.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">No tags</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedInstance.offering_count}</p>
                  <p className="text-sm text-gray-500">Offerings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedInstance.customer_count}</p>
                  <p className="text-sm text-gray-500">Customers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedInstance.project_count}</p>
                  <p className="text-sm text-gray-500">Projects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
