import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, ListOrdered, LayoutTemplate, Flag } from 'lucide-react';
import { useUser } from '../../context/UserContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'แดชบอร์ด', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'ผู้ใช้', icon: Users },
  { to: '/admin/rankings', label: 'โพสต์', icon: ListOrdered },
  { to: '/admin/templates', label: 'เทมเพลต', icon: LayoutTemplate },
  { to: '/admin/reports', label: 'รายงาน', icon: Flag },
];

export default function AdminLayout() {
  const { currentUser } = useUser();

  // กันไม่ให้คนที่ไม่ใช่ admin เข้าใช้หน้า /admin (UI-level; backend ยังตรวจ requireAdmin เสมอ)
  if (currentUser?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex gap-6">
      {/* Sidebar */}
      <aside className="hidden md:block w-56 shrink-0">
        <div className="glass rounded-2xl p-4 sticky top-24">
          <div className="px-2 pb-3 text-xs font-bold uppercase tracking-wider text-muted">
            เมนูแอดมิน
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand text-canvas shadow-md'
                      : 'text-ink-soft hover:bg-surface-glass hover:text-ink'
                  }`
                }
              >
                <Icon size={17} strokeWidth={2.2} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
