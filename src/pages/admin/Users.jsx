import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Shield, ShieldCheck, Trash2, Crown } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminUsers, setUserRole, deleteAdminUser } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import Avatar from '../../components/ui/Avatar';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;

export default function Users() {
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

  // Load admins specifically
  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    const res = await fetchAdminUsers({ userId: currentUser?.id, role: 'admin', limit: 100 });
    if (res.success) {
      setAdmins(res.data || []);
    }
    setLoadingAdmins(false);
  }, [currentUser?.id]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const load = useCallback(async (query, pageNum) => {
    setLoading(true);
    const res = await fetchAdminUsers({ userId: currentUser?.id, q: query, page: pageNum, limit: PAGE_LIMIT });
    if (res.success) {
      setUsers(res.data || []);
      setTotal(res.total || 0);
    } else {
      toast.error(res.error || t('admin.errLoadUsers'));
    }
    setLoading(false);
  }, [currentUser?.id, toast, t]);

  useEffect(() => {
    setPage(1);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchAdminUsers({ userId: currentUser?.id, q: debouncedQ, page: 1, limit: PAGE_LIMIT });
      if (cancelled) return;
      if (res.success) {
        setUsers(res.data || []);
        setTotal(res.total || 0);
      } else {
        toast.error(res.error || t('admin.errLoadUsers'));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, currentUser?.id, toast, t]);

  const handleRole = async (user, role) => {
    setBusy(user.id);
    const res = await setUserRole({ userId: currentUser?.id, targetId: user.id, role });
    setBusy(null);
    if (res.success) {
      toast.success(t('admin.roleSet', { name: user.username, role: role === 'admin' ? t('admin.adminRole') : t('admin.userRole') }));
      // Update both lists
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      
      // Reload admins to reflect new status immediately
      loadAdmins();
    } else {
      toast.error(res.error || t('admin.setRoleFailed', { msg: '' }));
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(t('admin.confirmDeleteUser', { username: user.username }))) return;
    setBusy(user.id);
    const res = await deleteAdminUser({ userId: currentUser?.id, targetId: user.id });
    setBusy(null);
    if (res.success) {
      toast.success(t('admin.userDeleted', { username: user.username }));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setAdmins((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error || t('admin.deleteUserFailed', { msg: '' }));
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const UserTable = ({ data, isLoading }) => {
    if (isLoading) return <p className="text-sm text-muted animate-pulse p-4">{t('admin.loading')}</p>;
    if (!data || data.length === 0) return <div className="glass rounded-2xl py-8 text-center text-sm text-muted">{t('admin.noUsers')}</div>;
    
    return (
      <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft bg-surface-glass">
                <th className="px-4 py-3 font-bold">{t('admin.user')}</th>
                <th className="px-4 py-3 font-bold">{t('admin.email')}</th>
                <th className="px-4 py-3 font-bold">{t('admin.role')}</th>
                <th className="px-4 py-3 font-bold text-right">{t('admin.posts')}</th>
                <th className="px-4 py-3 font-bold text-right">{t('admin.followers')}</th>
                <th className="px-4 py-3 font-bold text-right">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <Avatar name={u.username} src={u.avatar_url} size="sm" />
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          to={`/profile/${u.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink font-medium hover:text-brand hover:underline truncate"
                        >
                          {u.username}
                        </Link>
                        {isSelf && (
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand/10 text-brand-accent">
                            {t('admin.you')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-status-success bg-status-success/10 rounded-full px-2.5 py-1">
                          <ShieldCheck size={12} /> {t('admin.adminRole')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted bg-tag rounded-full px-2.5 py-1">
                          <Shield size={12} /> {t('admin.userRole')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">{u.posts_count}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">{u.followers_count}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isSelf ? (
                        <span className="text-xs text-muted italic px-2 py-1">—</span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRole(u, u.role === 'admin' ? 'user' : 'admin')}
                            disabled={busy === u.id}
                            className="text-xs font-bold text-brand-accent hover:text-highlight px-2 py-1 disabled:opacity-50"
                          >
                            {u.role === 'admin' ? t('admin.demote') : t('admin.promote')}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={busy === u.id}
                            className="text-xs font-bold text-status-error hover:bg-status-error/10 rounded-lg px-2 py-1 disabled:opacity-50"
                          >
                            <Trash2 size={14} className="inline-block mr-1" />
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">{t('admin.manageUsers')}</h1>
      <p className="text-sm text-muted mb-6">{t('admin.manageUsersHelp')}</p>

      {/* Admin Users Section */}
      <div className="mb-2 flex items-center gap-2">
        <Crown size={20} className="text-amber-500" />
        <h2 className="text-lg font-bold text-ink">Administrators</h2>
      </div>
      <UserTable data={admins} isLoading={loadingAdmins} />

      {/* All Users Section */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink">All Users</h2>
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.searchUsersPh')}
            className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
          />
        </div>
      </div>
      
      <UserTable data={users} isLoading={loading} />

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); load(debouncedQ, p); }} />
      )}
    </div>
  );
}
