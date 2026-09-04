import { useEffect, useState } from 'react';
import { Users, ListOrdered, LayoutTemplate, ThumbsUp, MessageSquare, UserPlus } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { fetchAdminStats } from '../../lib/api';

export default function Dashboard() {
  const { currentUser } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetchAdminStats(currentUser?.id);
      if (!active) return;
      if (!res.success || !res.data) {
        setError(res.error || 'ไม่สามารถโหลดสถิติได้');
      } else {
        setStats(res.data);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentUser?.id]);

  const cards = [
    { label: 'ผู้ใช้ทั้งหมด', value: stats?.users, icon: Users },
    { label: 'โพสต์/แงนคิง', value: stats?.rankings, icon: ListOrdered },
    { label: 'เทมเพลต', value: stats?.templates, icon: LayoutTemplate },
    { label: 'โหวตทั้งหมด', value: stats?.votes, icon: ThumbsUp },
    { label: 'คอมเมนต์', value: stats?.comments, icon: MessageSquare },
    { label: 'การติดตาม', value: stats?.follows, icon: UserPlus },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">แดชบอร์ด</h1>
      <p className="text-sm text-muted mb-6">สถิติภาพรวมของระบบ</p>

      {loading && <p className="text-sm text-muted animate-pulse">กำลังโหลดสถิติ...</p>}
      {error && (
        <div className="glass rounded-2xl p-6 text-center text-sm text-status-error">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass rounded-2xl p-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-brand shrink-0">
                <Icon size={22} strokeWidth={2} />
              </span>
              <div>
                <div className="text-3xl font-black text-ink leading-none">
                  {value ?? '—'}
                </div>
                <div className="text-sm text-muted mt-1">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
