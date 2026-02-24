import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Server,
  GitBranch,
  FileText,
  Shield,
  Key,
  Play,
  Crown,
  User,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useRole, type Role } from '../contexts/RoleContext';
import { useEntities } from '../hooks/useEntities';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const standalone: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

const debugGroup: NavGroup | null = import.meta.env.DEV
  ? { label: 'Debug', items: [{ name: 'Scenarios', href: '/scenarios', icon: Play }] }
  : null;

const navGroups: NavGroup[] = [
  {
    label: 'Federation',
    items: [
      { name: 'Topology', href: '/federation', icon: Network },
      { name: 'Entities', href: '/entities', icon: Server },
      { name: 'Trust Chain', href: '/trust-chain', icon: GitBranch },
    ],
  },
  {
    label: 'Governance',
    items: [
      { name: 'Policies', href: '/policies', icon: FileText },
      { name: 'Trust Marks', href: '/trust-marks', icon: Shield },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Keys', href: '/keys', icon: Key },
    ],
  },
];

function NavLinkItem({ item }: { item: NavItem }) {
  return (
    <NavLink
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
  );
}

function RoleSwitcher() {
  const { role, setRole, memberEntityId, setMemberEntityId } = useRole();
  const { data: entitiesData } = useEntities({ status: 'active' });
  const entities = entitiesData?.entities ?? [];

  const selectedEntity = memberEntityId
    ? entities.find(e => e.id === memberEntityId)
    : null;

  return (
    <div className="border-t border-gray-200 px-2 lg:px-3 py-3">
      {/* Segmented control — collapsed: icon only */}
      <div className="flex lg:hidden justify-center mb-2">
        <button
          onClick={() => setRole(role === 'manager' ? 'member' : 'manager')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title={role === 'manager' ? 'Manager mode' : 'Member mode'}
        >
          {role === 'manager' ? <Crown className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </button>
      </div>

      {/* Segmented control — expanded */}
      <div className="hidden lg:flex bg-gray-100 rounded-lg p-0.5 mb-2">
        {(['manager', 'member'] as Role[]).map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
              role === r
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {r === 'manager' ? <Crown className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span className="capitalize">{r}</span>
          </button>
        ))}
      </div>

      {/* Entity picker (member mode, expanded sidebar) */}
      {role === 'member' && (
        <div className="hidden lg:block">
          {!selectedEntity ? (
            <select
              value=""
              onChange={e => setMemberEntityId(e.target.value || null)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select your entity...</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 bg-indigo-50 rounded-md px-2 py-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-medium text-indigo-700 truncate flex-1">
                {selectedEntity.name}
              </span>
              <button
                onClick={() => setMemberEntityId(null)}
                className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { isMember, memberEntityId } = useRole();

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
      <nav className="flex-1 overflow-y-auto py-4 px-2 lg:px-3">
        {/* Dashboard (standalone) */}
        <div className="space-y-1">
          {standalone.map((item) => (
            <NavLinkItem key={item.name} item={item} />
          ))}
        </div>

        {/* My Entity — member mode, when entity selected */}
        {isMember && memberEntityId && (
          <div className="mt-2 space-y-1">
            <NavLinkItem item={{ name: 'My Entity', href: `/entities/${memberEntityId}`, icon: User }} />
          </div>
        )}

        {/* Grouped sections */}
        {navGroups.map((group) => (
          <div key={group.label} className="mt-6">
            <h3 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:block">
              {group.label}
            </h3>
            <div className="hidden lg:hidden h-px bg-gray-200 mx-3 my-2 block max-lg:block" />
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLinkItem key={item.name} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Debug group — dev mode only, manager only */}
        {debugGroup && !isMember && (
          <div className="mt-6">
            <h3 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-500 hidden lg:block">
              {debugGroup.label}
            </h3>
            <div className="hidden lg:hidden h-px bg-gray-200 mx-3 my-2 block max-lg:block" />
            <div className="space-y-1">
              {debugGroup.items.map((item) => (
                <NavLinkItem key={item.name} item={item} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Role Switcher */}
      <RoleSwitcher />
    </aside>
  );
}
