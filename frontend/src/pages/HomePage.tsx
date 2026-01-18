import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { federationApi } from '../api/client';
import type { Federation } from '../api/types';
import {
  Globe,
  Server,
  Link2,
  Activity,
  Bell,
  ArrowRight,
  Shield,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Server,
    title: 'Instance Discovery',
    description:
      'Register and discover Waldur deployments. Maintain a directory of available instances across organizations.',
  },
  {
    icon: Link2,
    title: 'Dynamic Connections',
    description:
      'Establish live connections between Waldur instances with Terms of Service acceptance workflow.',
  },
  {
    icon: Activity,
    title: 'Transaction Monitoring',
    description:
      'Track cross-instance transactions in real-time. Monitor data sync, resource sharing, and API calls.',
  },
  {
    icon: Bell,
    title: 'Alerting & Health',
    description:
      'Detect connectivity issues, sync failures, and performance degradation with automated alerts.',
  },
];

const capabilities = [
  { icon: Shield, name: 'ToS Workflow', description: 'Built-in terms acceptance' },
  { icon: Zap, name: 'Health Checks', description: 'Automated instance monitoring' },
  { icon: Globe, name: 'Multi-Tenant', description: 'Manage multiple federations' },
];

export default function HomePage() {
  const [federations, setFederations] = useState<Federation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    federationApi.list()
      .then(setFederations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Waldur Federation
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
          Coordinate multiple Waldur instances through federated connections.
          Enable discovery, establish connections, and monitor cross-instance operations.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          {federations.length > 0 ? (
            <Link
              to={`/federations/${federations[0].slug}`}
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Open Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex items-center px-6 py-3 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed"
            >
              No Federations Available
            </button>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => (
          <div key={feature.title} className="bg-white rounded-lg shadow p-6">
            <feature.icon className="h-8 w-8 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
            <p className="mt-2 text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Capabilities Section */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Platform Capabilities
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {capabilities.map((cap) => (
            <div key={cap.name} className="flex items-start gap-3">
              <cap.icon className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">{cap.name}</h3>
                <p className="text-sm text-gray-600">{cap.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Federations */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Your Federations
        </h2>
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : federations.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {federations.map((federation) => (
              <Link
                key={federation.id}
                to={`/federations/${federation.slug}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {federation.name}
                    </h3>
                    {federation.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {federation.description}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    federation.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {federation.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Server className="h-4 w-4" />
                    {federation.instance_count} instances
                  </span>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-4 w-4" />
                    {federation.active_connections} connections
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No federations yet
            </h3>
            <p className="mt-2 text-gray-600">
              Create a federation to start coordinating Waldur instances.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
