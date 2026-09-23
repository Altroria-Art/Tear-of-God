import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, Eye, X } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminRankings, deleteAdminRanking, fetchRanking } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import HashtagCell from '../../components/admin/HashtagCell';
import TierLabel from '../../components/tier/TierLabel';
import Avatar from '../../components/ui/Avatar';
import { buildTierRows } from '../../lib/tiers';
import { timeAgo } from '../../lib/format';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;

export default function Rankings() {
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [rankings, setRankings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  // 📍 in-admin post detail modal
  const [detail, setDetail] = useState(null); // { post, tierRows }
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async (query, pageNum) => {
    setLoading(true);
    const res = await fetchAdminRankings({ userId: currentUser?.id, q: query, page: pageNum, limit: PAGE_LIMIT });
    if (res.success) {
      setRankings(res.data || []);
      setTotal(res.total || 0);
    } else {
      toast.error(res.error || t('admin.errLoadRankings'));
    }
    setLoading(false);
  }, [currentUser?.id, toast, t]);

  useEffect(() => {
    setPage(1);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchAdminRankings({ userId: currentUser?.id, q: debouncedQ, page: 1, limit: PAGE_LIMIT });
      if (cancelled) return;
      if (res.success) {
        setRankings(res.data || []);
        setTotal(res.total || 0);
      } else {
        toast.error(res.error || t('admin.errLoadRankings'));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, currentUser?.id, toast, t]);

  const handleDelete = async (r) => {
    if (!window.confirm(t('admin.confirmDeletePost', { title: r.title }))) return;
    setBusy(r.id);
    const res = await deleteAdminRanking({ userId: currentUser?.id, targetId: r.id });
    setBusy(null);
    if (res.success) {
      toast.success(t('admin.deletePostSuccess'));
      setRankings((prev) => prev.filter((x) => x.id !== r.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error || t('admin.deletePostFailed', { msg: '' }));
    }
  };

  // 📍 เปิด modal ดูรายละเอียดและรูปภาพของโพสต์
  const handleView = async (ranking) => {
    setDetailLoading(true);
    const res = await fetchRanking(ranking.id, currentUser?.id);
    setDetailLoading(false);
    if (!res.data) {
      toast.error(t('admin.errLoadRankings'));
      return;
    }
    const data = res.data;
    const tierRows = buildTierRows(data.ranking_items, data.tiers).map((row) => ({
      tier: row.tier,
      color: row.color,
      index: row.index,
      items: (row.items || []).map((ri) => ({
        id: ri.item_id,
        name: ri.item?.name || ri.item_name || ri.item_id,
        image_url: ri.item?.image_url || ri.item_image,
      })),
    }));
    setDetail({ post: data, tierRows });
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">{t('admin.managePosts')}</h1>
      <p className="text-sm text-muted mb-6">{t('admin.managePostsHelp')}</p>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.searchPostPh')}
          className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">{t('admin.loading')}</p>
      ) : rankings.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">{t('admin.noPosts')}</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold w-[24%]">{t('admin.postTitle')}</th>
                  <th className="px-4 py-3 font-bold w-[13%]">{t('admin.author')}</th>
                  <th className="px-4 py-3 font-bold w-[20%]">{t('admin.hashtags')}</th>
                  <th className="px-4 py-3 font-bold text-right w-[8%]">{t('admin.likes')}</th>
                  <th className="px-4 py-3 font-bold text-right w-[8%]">{t('admin.dislikes')}</th>
                  <th className="px-4 py-3 font-bold text-right w-[8%]">{t('admin.comments')}</th>
                  <th className="px-4 py-3 font-bold text-right w-[19%]">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                    <td className="px-4 py-3 text-ink font-medium">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleView(r)}
                          className="hover:text-brand hover:underline font-medium text-left truncate min-w-0 cursor-pointer"
                          title={r.title}
                        >
                          {r.title}
                        </button>
                        <Link
                          to={`/post/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted hover:text-brand transition-colors p-0.5"
                          title={t('admin.viewOriginalPost')}
                        >
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {r.author?.id ? (
                        <Link
                          to={`/profile/${r.author.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-ink hover:underline"
                        >
                          {r.author.username}
                        </Link>
                      ) : (
                        r.author?.username || '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft"><HashtagCell hashtags={r.hashtags} /></td>
                    <td className="px-4 py-3 text-right text-ink-soft whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><ThumbsUp size={13} className="text-vote-up" /> {r.stats?.likes}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><ThumbsDown size={13} className="text-vote-down" /> {r.stats?.dislikes}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> {r.stats?.comments}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleView(r)}
                        disabled={detailLoading}
                        className="text-xs font-bold text-highlight hover:bg-status-info/10 rounded-lg px-2 py-1 disabled:opacity-50 mr-1"
                        title={t('admin.view')}
                      >
                        <Eye size={14} className="inline-block mr-1" />
                        {t('admin.view')}
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={busy === r.id}
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

      {/* 📍 in-admin post detail modal with images */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="glass w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-ink">{detail.post.title}</h3>
                  <Link
                    to={`/post/${detail.post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-muted hover:text-brand transition-colors rounded-lg hover:bg-surface-glass inline-flex items-center"
                    title={t('admin.viewOriginalPost')}
                  >
                    <ExternalLink size={18} />
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted mt-1.5 flex-wrap">
                  {detail.post.user_id ? (
                    <Link
                      to={`/profile/${detail.post.user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:underline"
                    >
                      <Avatar name={detail.post.profile?.username} src={detail.post.profile?.avatar_url} size="sm" />
                      <span className="font-medium text-ink">{detail.post.profile?.username || t('common.unknownUser')}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={detail.post.profile?.username} src={detail.post.profile?.avatar_url} size="sm" />
                      <span className="font-medium text-ink">{detail.post.profile?.username || t('common.unknownUser')}</span>
                    </div>
                  )}
                  <span>·</span>
                  <span>{timeAgo(detail.post.created_at)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-full p-1 text-muted transition-colors hover:bg-surface-glass hover:text-ink"
                aria-label={t('admin.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detail.post.description && (
              <p className="text-sm text-ink-soft mb-4">{detail.post.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">{t('admin.hashtags')}:</span>
              <HashtagCell hashtags={detail.post.hashtags} />
            </div>

            {/* ตาราง Visual Tier List พร้อมรูปภาพ */}
            <div className="space-y-2 rounded-2xl border border-line-soft p-3 bg-surface shadow-inner">
              {detail.tierRows.length === 0 ? (
                <p className="text-center text-sm text-muted py-6">{t('admin.noItems')}</p>
              ) : (
                detail.tierRows.map((row) => (
                  <div key={row.tier} className="flex items-stretch gap-2 rounded-xl">
                    <TierLabel
                      label={row.tier}
                      color={row.color}
                      className="w-24 shrink-0 flex items-center justify-center rounded-lg font-bold"
                    />
                    <div className="flex-1 p-2 min-h-[64px] flex flex-wrap gap-2 items-center bg-canvas/40 rounded-lg">
                      {(!row.items || row.items.length === 0) ? (
                        <span className="text-xs text-muted italic px-2">{t('admin.noItems')}</span>
                      ) : (
                        row.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="aspect-square h-16 w-16 sm:h-20 sm:w-20 rounded-xl border border-line-soft bg-surface flex flex-col items-center justify-center p-1 text-center overflow-hidden shadow-xs relative group select-none"
                            title={item.name}
                          >
                            {item.image_url ? (
                              <>
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] py-0.5 px-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.name}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-ink break-words line-clamp-2 px-1">
                                {item.name}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><ThumbsUp size={13} className="text-vote-up" /> {detail.post.stats?.likes || 0}</span>
                <span className="inline-flex items-center gap-1"><ThumbsDown size={13} className="text-vote-down" /> {detail.post.stats?.dislikes || 0}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> {detail.post.stats?.comments || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-glass rounded-xl cursor-pointer"
                >
                  {t('admin.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
