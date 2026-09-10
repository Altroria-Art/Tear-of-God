import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, ListOrdered, LayoutTemplate, Flag } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../ui/Toast';
import { fetchAdminReports } from '../../lib/api';

const NAV_ITEMS = [
  { to: '/admin', labelKey: 'admin.dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', labelKey: 'admin.users', icon: Users },
  { to: '/admin/rankings', labelKey: 'admin.rankings', icon: ListOrdered },
  { to: '/admin/templates', labelKey: 'admin.templates', icon: LayoutTemplate },
  { to: '/admin/reports', labelKey: 'admin.reports', icon: Flag },
];

export default function AdminLayout() {
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const prevPendingRef = useRef(null);

  const fetchPending = useCallback(async (isPolling = false) => {
    if (!currentUser?.id || currentUser.role !== 'admin') return;
    try {
      const res = await fetchAdminReports({ userId: currentUser.id, status: 'pending', page: 1, limit: 1 });
      if (res.success) {
        const newCount = res.pending_count ?? 0;
        if (isPolling && prevPendingRef.current !== null && newCount > prevPendingRef.current) {
          const diff = newCount - prevPendingRef.current;
          toast.warning(t('admin.newReportToast', { count: diff }));
        }
        prevPendingRef.current = newCount;
        setPendingCount(newCount);
      }
    } catch {
      // silent catch for polling
    }
  }, [currentUser?.id, currentUser?.role, toast, t]);

  useEffect(() => {
    fetchPending(false);
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchPending(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // กันไม่ให้คนที่ไม่ใช่ admin เข้าใช้หน้า /admin (UI-level; backend ยังตรวจ requireAdmin เสมอ)
  if (currentUser?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row gap-6">
      {/* Mobile Nav */}
      <nav className="flex md:hidden overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-none border-b border-line-soft">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-brand text-canvas shadow-md'
                  : 'glass text-ink-soft hover:text-ink'
              }`
            }
          >
            <Icon size={15} strokeWidth={2.2} />
            <span>{t(labelKey)}</span>
            {to === '/admin/reports' && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-status-warning text-canvas animate-pulse shadow-sm">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:block w-56 shrink-0">
        <div className="glass rounded-2xl p-4 sticky top-24">
          <div className="px-2 pb-3 text-xs font-bold uppercase tracking-wider text-muted">
            {t('admin.menu')}
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
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
                <Icon size={17} strokeWidth={2.2} className="shrink-0" />
                <span className="flex-1 text-left">{t(labelKey)}</span>
                {to === '/admin/reports' && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-status-warning text-canvas animate-pulse shadow-sm">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <Outlet context={{ pendingCount, refreshPending: () => fetchPending(false) }} />
      </main>
    </div>
  );
}
