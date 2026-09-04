import { useCallback, useEffect, useState } from 'react';
import { Search, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminUsers, setUserRole, deleteAdminUser } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;

export default function Users() {
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

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
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
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
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error || t('admin.deleteUserFailed', { msg: '' }));
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">{t('admin.manageUsers')}</h1>
      <p className="text-sm text-muted mb-6">{t('admin.manageUsersHelp')}</p>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.searchUsersPh')}
          className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">{t('admin.loading')}</p>
      ) : users.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">{t('admin.noUsers')}</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold">{t('admin.user')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.email')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.role')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.posts')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.followers')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <img
                        src={u.avatar_url || ''}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover bg-avatar"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <span className="text-ink font-medium">{u.username}</span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); load(debouncedQ, p); }} />
    </div>
  );
}
