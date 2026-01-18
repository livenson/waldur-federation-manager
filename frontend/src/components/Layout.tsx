import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { Menu, X, Globe, Server, Link2, Activity, Settings, Home } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { federationApi } from '../api/client';
import type { Federation } from '../api/types';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [federations, setFederations] = useState<Federation[]>([]);
  const location = useLocation();
  const { federationSlug } = useParams();

  useEffect(() => {
    federationApi.list().then(setFederations).catch(console.error);
  }, []);

  // Build navigation based on whether we're in a federation context
  const navigation = federationSlug
    ? [
        { name: 'Dashboard', href: `/federations/${federationSlug}`, icon: Home },
        { name: 'Instances', href: `/federations/${federationSlug}/instances`, icon: Server },
        { name: 'Connections', href: `/federations/${federationSlug}/connections`, icon: Link2 },
        { name: 'Monitoring', href: `/federations/${federationSlug}/monitoring`, icon: Activity },
        { name: 'Settings', href: `/federations/${federationSlug}/admin`, icon: Settings },
      ]
    : [
        { name: 'Home', href: '/', icon: Home },
      ];

  const currentFederation = federations.find(f => f.slug === federationSlug);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <Globe className="h-8 w-8 text-indigo-600" />
                <span className="font-semibold text-xl text-gray-900">
                  Waldur Federation
                </span>
              </Link>

              {/* Federation selector */}
              {federations.length > 0 && (
                <div className="hidden sm:flex items-center">
                  <span className="text-gray-300 mx-2">/</span>
                  <select
                    value={federationSlug || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        window.location.href = `/federations/${e.target.value}`;
                      } else {
                        window.location.href = '/';
                      }
                    }}
                    className="border-0 bg-transparent text-gray-700 font-medium focus:ring-0 cursor-pointer"
                  >
                    <option value="">Select federation...</option>
                    {federations.map((fed) => (
                      <option key={fed.id} value={fed.slug}>
                        {fed.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:items-center sm:space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200">
            <div className="space-y-1 px-2 pb-3 pt-2">
              {/* Federation selector for mobile */}
              {federations.length > 0 && (
                <div className="px-3 py-2">
                  <select
                    value={federationSlug || ''}
                    onChange={(e) => {
                      setMobileMenuOpen(false);
                      if (e.target.value) {
                        window.location.href = `/federations/${e.target.value}`;
                      } else {
                        window.location.href = '/';
                      }
                    }}
                    className="w-full border-gray-300 rounded-md"
                  >
                    <option value="">Select federation...</option>
                    {federations.map((fed) => (
                      <option key={fed.id} value={fed.slug}>
                        {fed.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 text-base font-medium rounded-md',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Current federation banner */}
      {currentFederation && (
        <div className="bg-indigo-600 text-white px-4 py-2">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{currentFederation.name}</span>
              <span className="text-indigo-200 text-sm">
                · {currentFederation.instance_count} instances · {currentFederation.active_connections} connections
              </span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              currentFederation.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
            }`}>
              {currentFederation.status}
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              Waldur Federation - Federate and discover Waldur instances
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Instance Discovery</span>
              <span>Connection Management</span>
              <span>Transaction Monitoring</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
