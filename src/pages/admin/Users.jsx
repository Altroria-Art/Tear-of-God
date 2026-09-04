import { useCallback, useEffect, useState } from 'react';
import { Search, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminUsers, setUserRole, deleteAdminUser } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';

const PAGE_LIMIT = 20;

export default function Users() {
  const { currentUser } = useUser();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (query, pageNum) => {
    setLoading(true);
    const res = await fetchAdminUsers({ userId: currentUser?.id, q: query, page: pageNum, limit: PAGE_LIMIT });
    if (res.success) {
      setUsers(res.data || []);
      setTotal(res.total || 0);
    } else {
      toast.error(res.error || 'โหลดรายชื่อไม่สำเร็จ');
    }
    setLoading(false);
  }, [currentUser?.id, toast]);

  useEffect(() => {
    setPage(1);
    load(debouncedQ, 1);
  }, [debouncedQ, load]);

  const handleRole = async (user, role) => {
    setBusy(user.id);
    const res = await setUserRole({ userId: currentUser?.id, targetId: user.id, role });
    setBusy(null);
    if (res.success) {
      toast.success(`ตั้งบทบาท ${user.username} เป็น${role === 'admin' ? 'แอดมิน' : 'ผู้ใช้'}แล้ว`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    } else {
      toast.error(res.error || 'ตั้งบทบาทไม่สำเร็จ');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`ยืนยันลบผู้ใช้ "${user.username}"? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setBusy(user.id);
    const res = await deleteAdminUser({ userId: currentUser?.id, targetId: user.id });
    setBusy(null);
    if (res.success) {
      toast.success(`ลบผู้ใช้ ${user.username} แล้ว`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((t) => Math.max(0, t - 1));
    } else {
      toast.error(res.error || 'ลบผู้ใช้ไม่สำเร็จ');
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">จัดการผู้ใช้</h1>
      <p className="text-sm text-muted mb-6">ค้นหา, ตั้งบทบาทแอดมิน และลบผู้ใช้</p>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา username หรือ email..."
          className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">กำลังโหลด...</p>
      ) : users.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">ไม่พบผู้ใช้</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold">ผู้ใช้</th>
                  <th className="px-4 py-3 font-bold">อีเมล</th>
                  <th className="px-4 py-3 font-bold">บทบาท</th>
                  <th className="px-4 py-3 font-bold text-right">โพสต์</th>
                  <th className="px-4 py-3 font-bold text-right">ผู้ติดตาม</th>
                  <th className="px-4 py-3 font-bold text-right">จัดการ</th>
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
                          <ShieldCheck size={12} /> แอดมิน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted bg-tag rounded-full px-2.5 py-1">
                          <Shield size={12} /> ผู้ใช้
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
                        {u.role === 'admin' ? 'ลดเป็นผู้ใช้' : 'เป็นแอดมิน'}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={busy === u.id}
                        className="text-xs font-bold text-status-error hover:bg-status-error/10 rounded-lg px-2 py-1 disabled:opacity-50"
                      >
                        <Trash2 size={14} className="inline-block mr-1" />
                        ลบ
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
