import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const navItems = [
  { to: '/agent', label: 'Agent', icon: '🤖' },
  { to: '/management', label: 'Management', icon: '⚙️' },
  { to: '/trading', label: 'Trading', icon: '📈' },
  { to: '/data', label: 'Data Explorer', icon: '📊' },
  { to: '/settings', label: 'Keys & Settings', icon: '🔑' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-dark-elevated border-r border-dark-border transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Brand */}
          <div className="p-4 border-b border-dark-border">
            <h1 className="font-semibold text-lg text-accent-cyan tracking-tight">
              MCP Crypto
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Trading Intelligence</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-sharp text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-dark-surface text-accent-cyan border-l-2 border-accent-cyan -ml-[2px] pl-[14px]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-dark-surface'
                  }`
                }
              >
                <span className="text-base">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-dark-border">
            <p className="text-xs text-gray-600">v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}
