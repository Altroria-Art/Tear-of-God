import { useEffect, useState } from 'react';
import { Users, ListOrdered, LayoutTemplate, ThumbsUp, MessageSquare, UserPlus } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { fetchAdminStats } from '../../lib/api';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }
      const res = await fetchAdminStats(currentUser.id);
      if (!active) return;
      if (!res.success || !res.data) {
        setError(res.error || t('admin.errLoadStats'));
      } else {
        setStats(res.data);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentUser?.id, t]);

  const cards = [
    { labelKey: 'admin.totalUsers', value: stats?.users, icon: Users },
    { labelKey: 'admin.totalPosts', value: stats?.rankings, icon: ListOrdered },
    { labelKey: 'admin.totalTemplates', value: stats?.templates, icon: LayoutTemplate },
    { labelKey: 'admin.totalVotes', value: stats?.votes, icon: ThumbsUp },
    { labelKey: 'admin.totalComments', value: stats?.comments, icon: MessageSquare },
    { labelKey: 'admin.totalFollows', value: stats?.follows, icon: UserPlus },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">{t('admin.dashboardTitle')}</h1>
      <p className="text-sm text-muted mb-6">{t('admin.dashboardSubtitle')}</p>

      {loading && <p className="text-sm text-muted animate-pulse">{t('admin.loadingStats')}</p>}
      {error && (
        <div className="glass rounded-2xl p-6 text-center text-sm text-status-error">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ labelKey, value, icon: Icon }) => (
            <div key={labelKey} className="glass rounded-2xl p-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-brand shrink-0">
                <Icon size={22} strokeWidth={2} />
              </span>
              <div>
                <div className="text-3xl font-black text-ink leading-none">
                  {value ?? '—'}
                </div>
                <div className="text-sm text-muted mt-1">{t(labelKey)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
