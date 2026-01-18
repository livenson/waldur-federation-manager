import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { connectionApi, instanceApi } from '../api/client';
import type { FederationConnection, WaldurInstance, ConnectionState, ConnectionType } from '../api/types';

const stateColors: Record<ConnectionState, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
  terminated: 'bg-gray-200 text-gray-600',
};

const typeLabels: Record<ConnectionType, string> = {
  remote_customer: 'Remote Customer',
  shared_offering: 'Shared Offering',
  usage_sync: 'Usage Sync',
};

export default function Connections() {
  const { federationSlug = 'ercf' } = useParams();
  const [connections, setConnections] = useState<FederationConnection[]>([]);
  const [instances, setInstances] = useState<WaldurInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const filters: { state?: string; connection_type?: string } = {};
      if (stateFilter) filters.state = stateFilter;
      if (typeFilter) filters.connection_type = typeFilter;

      const [connectionsData, instancesData] = await Promise.all([
        connectionApi.list(federationSlug, filters),
        instanceApi.list(federationSlug, { status: 'active' }),
      ]);
      setConnections(connectionsData);
      setInstances(instancesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [federationSlug, stateFilter, typeFilter]);

  const getInstanceName = (instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    return instance?.name || instanceId;
  };

  const handleActivate = async (connectionId: string) => {
    try {
      await connectionApi.activate(federationSlug, connectionId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate connection');
    }
  };

  const handlePause = async (connectionId: string) => {
    try {
      await connectionApi.pause(federationSlug, connectionId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pause connection');
    }
  };

  const handleTerminate = async (connectionId: string) => {
    if (!confirm('Are you sure you want to terminate this connection?')) return;
    try {
      await connectionApi.terminate(federationSlug, connectionId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to terminate connection');
    }
  };

  if (loading && connections.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Federation Connections</h1>
          <p className="text-gray-500">Manage connections between Waldur instances</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Create Connection
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All states</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All types</option>
            <option value="remote_customer">Remote Customer</option>
            <option value="shared_offering">Shared Offering</option>
            <option value="usage_sync">Usage Sync</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Connection List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                State
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {connections.map((conn) => (
              <tr key={conn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{getInstanceName(conn.source_instance_id)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="font-medium text-gray-900">{getInstanceName(conn.target_instance_id)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{typeLabels[conn.connection_type]}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${stateColors[conn.state]}`}>
                    {conn.state}
                  </span>
                  {conn.error_count > 0 && (
                    <span className="ml-2 text-xs text-red-600">
                      {conn.error_count} errors
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {conn.last_activity ? (
                    <div>
                      <div>Last: {new Date(conn.last_activity).toLocaleString()}</div>
                      {conn.established_at && (
                        <div className="text-xs">
                          Est: {new Date(conn.established_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span>Never</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    {conn.state === 'pending' && (
                      <button
                        onClick={() => handleActivate(conn.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Activate
                      </button>
                    )}
                    {conn.state === 'active' && (
                      <button
                        onClick={() => handlePause(conn.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Pause
                      </button>
                    )}
                    {conn.state === 'paused' && (
                      <button
                        onClick={() => handleActivate(conn.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Resume
                      </button>
                    )}
                    {conn.state !== 'terminated' && (
                      <button
                        onClick={() => handleTerminate(conn.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Terminate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {connections.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No connections found
          </div>
        )}
      </div>

      {/* Create Connection Modal */}
      {showCreateModal && (
        <CreateConnectionModal
          federationSlug={federationSlug}
          instances={instances}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}

function CreateConnectionModal({
  federationSlug,
  instances,
  onClose,
  onCreated,
}: {
  federationSlug: string;
  instances: WaldurInstance[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [connectionType, setConnectionType] = useState<ConnectionType>('remote_customer');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!sourceId || !targetId) {
      setError('Please select both source and target instances');
      return;
    }
    if (sourceId === targetId) {
      setError('Source and target instances must be different');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await connectionApi.create(federationSlug, {
        source_instance_id: sourceId,
        target_instance_id: targetId,
        connection_type: connectionType,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Create Connection</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Instance</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select source instance</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Instance</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select target instance</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection Type</label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="remote_customer">Remote Customer</option>
              <option value="shared_offering">Shared Offering</option>
              <option value="usage_sync">Usage Sync</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
