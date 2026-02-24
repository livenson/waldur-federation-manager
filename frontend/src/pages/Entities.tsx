import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useEntities } from '../hooks/useEntities';
import { useRole } from '../contexts/RoleContext';
import type { EntityStatus } from '../api/types';
import HelpTip from '../components/HelpTip';

export default function Entities() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useEntities(statusFilter ? { status: statusFilter } : undefined);
  const navigate = useNavigate();
  const { isManager } = useRole();

  const entities = data?.entities ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entities</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage federation entities
            <HelpTip className="ml-1" text="An entity is any participant in the OIDC Federation — it could be a Trust Anchor, an Intermediate Authority, an OpenID Provider, a Relying Party, or an OAuth resource. Each entity is identified by a unique URL (Entity ID) and can have one or more entity types defining its roles." />
          </p>
        </div>
        {isManager && (
          <Link to="/entities/register" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Register Entity
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'active', 'draft', 'suspended', 'revoked'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              statusFilter === s
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No entities found</p>
          {isManager && (
            <Link to="/entities/register" className="text-indigo-600 text-sm hover:underline mt-1 inline-block">
              Register your first entity
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Types</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map(entity => (
                <tr
                  key={entity.id}
                  onClick={() => navigate(`/entities/${entity.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{entity.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{entity.entity_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{entity.organization || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{entity.country || '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={entity.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {entity.entity_types.map(t => t.replace(/_/g, ' ')).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EntityStatus }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    revoked: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}
