import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Settings,
  Server,
  Link2,
  Globe,
  FileText,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { federationApi, instanceApi, connectionApi } from '../api/client';
import type { Federation, WaldurInstance, FederationConnection } from '../api/types';

type Tab = 'overview' | 'instances' | 'tos' | 'settings';

const tabs: { id: Tab; name: string; icon: typeof Settings }[] = [
  { id: 'overview', name: 'Overview', icon: Globe },
  { id: 'instances', name: 'Instances', icon: Server },
  { id: 'tos', name: 'Terms of Service', icon: FileText },
  { id: 'settings', name: 'Settings', icon: Settings },
];

export default function FederationAdmin() {
  const { federationSlug = 'ercf' } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [federation, setFederation] = useState<Federation | null>(null);
  const [instances, setInstances] = useState<WaldurInstance[]>([]);
  const [connections, setConnections] = useState<FederationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [editedFederation, setEditedFederation] = useState<Partial<Federation>>({});
  const [tosText, setTosText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [federationSlug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fed, inst, conn] = await Promise.all([
        federationApi.get(federationSlug),
        instanceApi.list(federationSlug),
        connectionApi.list(federationSlug),
      ]);
      setFederation(fed);
      setInstances(inst);
      setConnections(conn);
      setEditedFederation(fed);
      setTosText(fed.terms_of_service || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!federation) return;
    try {
      setSaving(true);
      // Convert Partial<Federation> to FederationUpdate (filter out null values)
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editedFederation)) {
        if (value !== undefined && value !== null) {
          updates[key] = value;
        }
      }
      await federationApi.update(federationSlug, updates);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToS = async () => {
    if (!federation) return;
    try {
      setSaving(true);
      await federationApi.update(federationSlug, { terms_of_service: tosText });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save ToS');
    } finally {
      setSaving(false);
    }
  };

  const pendingInstances = instances.filter(i => i.status === 'pending');
  const activeInstances = instances.filter(i => i.status === 'active');
  const activeConnections = connections.filter(c => c.state === 'active');

  if (loading && !federation) {
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
        <h1 className="text-2xl font-bold text-gray-900">Federation Settings</h1>
        <p className="text-gray-500">Manage federation configuration and policies</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && federation && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Server className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Instances</p>
                  <p className="text-2xl font-semibold text-gray-900">{instances.length}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {activeInstances.length} active, {pendingInstances.length} pending
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Link2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Connections</p>
                  <p className="text-2xl font-semibold text-gray-900">{connections.length}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {activeConnections.length} active
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Globe className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-2xl font-semibold text-gray-900 capitalize">{federation.status}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {federation.allow_auto_join ? 'Auto-join enabled' : 'Manual approval'}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-semibold text-gray-900">{pendingInstances.length}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                awaiting approval
              </p>
            </div>
          </div>

          {/* Pending Approvals */}
          {pendingInstances.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  Pending Instance Approvals ({pendingInstances.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {pendingInstances.map((instance) => (
                  <div key={instance.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{instance.name}</h3>
                      <p className="text-sm text-gray-500">{instance.api_url}</p>
                      <p className="text-sm text-gray-500">
                        {instance.organization_name} · {instance.country}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!instance.tos_accepted && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                          ToS not accepted
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            await instanceApi.approve(federationSlug, instance.id);
                            loadData();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed');
                          }
                        }}
                        className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Reject this instance?')) return;
                          try {
                            await instanceApi.reject(federationSlug, instance.id);
                            loadData();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed');
                          }
                        }}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instances Tab */}
      {activeTab === 'instances' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">All Instances ({instances.length})</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connection</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ToS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {instances.map((instance) => (
                <tr key={instance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{instance.name}</div>
                    <div className="text-sm text-gray-500">{instance.api_url}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {instance.organization_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      instance.status === 'active' ? 'bg-green-100 text-green-800' :
                      instance.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {instance.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      instance.connection_status === 'online' ? 'bg-green-100 text-green-800' :
                      instance.connection_status === 'offline' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {instance.connection_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {instance.tos_accepted ? (
                      <span className="text-green-600 text-sm">Accepted</span>
                    ) : (
                      <span className="text-yellow-600 text-sm">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {instance.joined_at ? new Date(instance.joined_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {instances.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No instances registered yet
            </div>
          )}
        </div>
      )}

      {/* Terms of Service Tab */}
      {activeTab === 'tos' && federation && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Terms of Service</h2>
            <p className="text-sm text-gray-500 mt-1">
              Define the terms that instances must accept to join this federation.
              Supports Markdown formatting.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Terms of Service Content
            </label>
            <textarea
              value={tosText}
              onChange={(e) => setTosText(e.target.value)}
              rows={15}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm"
              placeholder="# Federation Terms of Service&#10;&#10;By joining this federation, you agree to...&#10;&#10;## Data Sharing&#10;&#10;..."
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="require-tos"
                checked={federation.require_tos_acceptance}
                onChange={(e) => {
                  federationApi.update(federationSlug, { require_tos_acceptance: e.target.checked });
                  loadData();
                }}
                className="h-4 w-4 text-indigo-600 rounded border-gray-300"
              />
              <label htmlFor="require-tos" className="text-sm text-gray-700">
                Require ToS acceptance before joining
              </label>
            </div>
            <button
              onClick={handleSaveToS}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Terms'}
            </button>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && federation && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Federation Configuration</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Federation Name</label>
              <input
                type="text"
                value={editedFederation.name || ''}
                onChange={(e) => setEditedFederation({ ...editedFederation, name: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={federation.slug}
                readOnly
                className="w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                value={editedFederation.admin_email || ''}
                onChange={(e) => setEditedFederation({ ...editedFederation, admin_email: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={editedFederation.website_url || ''}
                onChange={(e) => setEditedFederation({ ...editedFederation, website_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editedFederation.description || ''}
              onChange={(e) => setEditedFederation({ ...editedFederation, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Membership Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editedFederation.allow_auto_join || false}
                  onChange={(e) => setEditedFederation({ ...editedFederation, allow_auto_join: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                />
                <span className="text-gray-700">
                  Allow auto-join - New instances can join without approval
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editedFederation.require_tos_acceptance || false}
                  onChange={(e) => setEditedFederation({ ...editedFederation, require_tos_acceptance: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                />
                <span className="text-gray-700">
                  Require ToS acceptance before joining
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
