import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2, Eye, Layers } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminTemplates, deleteAdminTemplate } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';

const PAGE_LIMIT = 20;

export default function Templates() {
  const { currentUser } = useUser();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
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
    const res = await fetchAdminTemplates({ userId: currentUser?.id, q: query, page: pageNum, limit: PAGE_LIMIT });
    if (res.success) {
      setTemplates(res.data || []);
      setTotal(res.total || 0);
    } else {
      toast.error(res.error || 'โหลดรายการไม่สำเร็จ');
    }
    setLoading(false);
  }, [currentUser?.id, toast]);

  useEffect(() => {
    setPage(1);
    load(debouncedQ, 1);
  }, [debouncedQ, load]);

  const handleDelete = async (t) => {
    if (!window.confirm(`ยืนยันลบเทมเพลต "${t.title}"?`)) return;
    setBusy(t.id);
    const res = await deleteAdminTemplate({ userId: currentUser?.id, targetId: t.id });
    setBusy(null);
    if (res.success) {
      toast.success('ลบเทมเพลตแล้ว');
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setTotal((total) => Math.max(0, total - 1));
    } else {
      toast.error(res.error || 'ลบเทมเพลตไม่สำเร็จ');
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">จัดการเทมเพลต</h1>
      <p className="text-sm text-muted mb-6">ค้นหาและลบเทมเพลต</p>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อเทมเพลต..."
          className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">กำลังโหลด...</p>
      ) : templates.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">ไม่พบเทมเพลต</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold">ชื่อ</th>
                  <th className="px-4 py-3 font-bold">เจ้าของ</th>
                  <th className="px-4 py-3 font-bold">หมวดหมู่</th>
                  <th className="px-4 py-3 font-bold text-right">Tiers</th>
                  <th className="px-4 py-3 font-bold text-right">ผู้ใช้</th>
                  <th className="px-4 py-3 font-bold text-right">ยอดชม</th>
                  <th className="px-4 py-3 font-bold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                    <td className="px-4 py-3 text-ink font-medium max-w-[240px] truncate">{t.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.creator?.username}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.category}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      <span className="inline-flex items-center gap-1"><Layers size={13} /> {t.tier_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">{t.use_count}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      <span className="inline-flex items-center gap-1"><Eye size={13} /> {t.view_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={busy === t.id}
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
