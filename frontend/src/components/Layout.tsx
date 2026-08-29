import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, GanttChartSquare, LineChart, FileText, LogOut, Sparkles, Users as UsersIcon, Zap } from 'lucide-react';
import { useAuth } from '../store/auth';
import clsx from 'clsx';
import NotificationBell from './NotificationBell';
import ChatWidget from './ChatWidget';
import { disconnectSocket } from '../api/socket';

const nav = [
  { to: '/board', label: 'Board', icon: LayoutGrid },
  { to: '/workflows', label: 'Workflows', icon: GanttChartSquare },
  { to: '/dashboard', label: 'Dashboard', icon: LineChart },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/automation', label: 'Automation', icon: Zap },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = user?.role === 'ADMIN' ? [...nav, { to: '/users', label: 'Team Accounts', icon: UsersIcon }] : nav;

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">D</div>
          <div>
            <div className="text-sm font-semibold leading-tight">DigitalSofts</div>
            <div className="text-[11px] text-slate-400 leading-tight">Ops Platform</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                )
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-50">
            <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-400">{user?.role}</div>
            </div>
            <button
              className="text-slate-400 hover:text-red-500"
              title="Log out"
              onClick={() => {
                disconnectSocket();
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="text-center text-[10px] text-slate-300 mt-2">Built by M. Ahmad</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Sparkles size={15} className="text-brand-500" />
            AI-powered operations, live
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
