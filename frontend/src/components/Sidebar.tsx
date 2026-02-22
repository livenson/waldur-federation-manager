import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  GitBranch,
  FileText,
  Shield,
  Key,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Entities', href: '/entities', icon: Server },
  { name: 'Trust Chain', href: '/trust-chain', icon: GitBranch },
  { name: 'Policies', href: '/policies', icon: FileText },
  { name: 'Trust Marks', href: '/trust-marks', icon: Shield },
  { name: 'Keys', href: '/keys', icon: Key },
  { name: 'Health', href: '/health', icon: Activity },
];

export default function Sidebar() {
  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-gray-200',
        'w-16 lg:w-64 transition-[width] duration-200'
      )}
    >
      {/* App title */}
      <div className="flex items-center h-16 shrink-0 border-b border-gray-200 px-3 lg:px-5">
        <LayoutDashboard className="h-7 w-7 text-indigo-600 shrink-0" />
        <span className="ml-3 text-lg font-semibold text-gray-900 hidden lg:block truncate">
          Waldur Federation
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 lg:px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-lg transition-colors',
                'px-3 py-2.5 lg:px-3 lg:py-2',
                'group',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                <span className="ml-3 text-sm font-medium hidden lg:block truncate">
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
