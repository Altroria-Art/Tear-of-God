import { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Users,
  ListOrdered,
  LayoutTemplate,
  ThumbsUp,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Flag,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  Layers,
  X,
  Bell,
  Check,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { fetchAdminStats, fetchAdminReports, setReportStatus } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Avatar from '../../components/ui/Avatar';
import { timeAgo } from '../../lib/format';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();
  const { refreshPending } = useOutletContext() || {};

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Reports Modal State
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [modalReports, setModalReports] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [busyReportId, setBusyReportId] = useState(null);

  const loadStats = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    const res = await fetchAdminStats(currentUser.id);
    if (!res.success || !res.data) {
      setError(res.error || t('admin.errLoadStats'));
    } else {
      setStats(res.data);
    }
    setLoading(false);
  }, [currentUser?.id, t]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const openQuickReports = async () => {
    setIsQuickModalOpen(true);
    setModalLoading(true);
    const res = await fetchAdminReports({ userId: currentUser?.id, status: 'pending', page: 1, limit: 20 });
    if (res.success) {
      setModalReports(res.data || []);
    } else {
      toast.error(res.error || t('admin.errLoadReports'));
    }
    setModalLoading(false);
  };

  const handleQuickStatus = async (reportId, nextStatus) => {
    setBusyReportId(reportId);
    const res = await setReportStatus({ userId: currentUser?.id, targetId: reportId, status: nextStatus });
    setBusyReportId(null);
    if (res.success) {
      toast.success(t('admin.statusUpdated'));
      setModalReports((prev) => prev.filter((r) => r.id !== reportId));
      setStats((prev) => (prev ? { ...prev, pending_reports: Math.max(0, (prev.pending_reports || 1) - 1) } : prev));
      if (refreshPending) {
        refreshPending();
      }
    } else {
      toast.error(res.error || t('admin.statusUpdateFailed', { msg: '' }));
    }
  };

  const cards = [
    { labelKey: 'admin.totalUsers', value: stats?.users, icon: Users, to: '/admin/users' },
    { labelKey: 'admin.totalPosts', value: stats?.rankings, icon: ListOrdered, to: '/admin/rankings' },
    { labelKey: 'admin.totalTemplates', value: stats?.templates, icon: LayoutTemplate, to: '/admin/templates' },
    { labelKey: 'admin.totalVotes', value: stats?.votes, icon: ThumbsUp },
    { labelKey: 'admin.totalComments', value: stats?.comments, icon: MessageSquare },
    { labelKey: 'admin.totalFollows', value: stats?.follows, icon: UserPlus },
  ];

  const pendingCount = stats?.pending_reports || 0;
  const recentPosts = stats?.recent_posts || [];
  const recentReports = stats?.recent_reports || [];
  const topCategories = stats?.top_categories || [];
  const topTemplates = stats?.top_templates || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-ink mb-1">{t('admin.dashboardTitle')}</h1>
        <p className="text-sm text-muted">{t('admin.dashboardSubtitle')}</p>
      </div>

      {loading && <p className="text-sm text-muted animate-pulse">{t('admin.loadingStats')}</p>}
      {error && (
        <div className="glass rounded-2xl p-6 text-center text-sm text-status-error">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Action Required Banner */}
          {pendingCount > 0 ? (
            <div
              onClick={openQuickReports}
              className="rounded-2xl border border-status-warning/40 bg-status-warning/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-status-warning/15 hover:border-status-warning/60 transition-all shadow-sm group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openQuickReports();
                }
              }}
            >
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <span className="w-11 h-11 rounded-xl bg-status-warning/20 text-status-warning flex items-center justify-center group-hover:scale-105 transition-transform">
                    <AlertTriangle size={22} />
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-warning opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-warning border-2 border-surface"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">{t('admin.actionRequired')}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-status-warning text-canvas shadow-xs">
                      {pendingCount}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {t('admin.pendingReportsAlert', { count: pendingCount })} · <span className="text-brand font-medium group-hover:underline">{t('admin.clickToViewQuick')}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickReports();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface border border-status-warning/40 text-ink hover:bg-surface-glass transition-colors shadow-xs"
                >
                  <Bell size={13} className="text-status-warning" />
                  <span>{t('admin.quickReportsTitle')}</span>
                </button>
                <Link
                  to="/admin/reports"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-status-warning text-canvas hover:opacity-90 transition-opacity shadow-sm shrink-0"
                >
                  <span>{t('admin.manageReportsNow')}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-status-success/30 bg-status-success/5 p-4 flex items-center justify-between gap-4 text-xs font-medium text-status-success">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{t('admin.allClear')}</span>
              </div>
              <Link to="/admin/reports" className="text-muted hover:text-ink transition-colors flex items-center gap-1">
                <span>{t('admin.reports')}</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(({ labelKey, value, icon: Icon, to }) => {
              const cardContent = (
                <>
                  <span className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-brand shrink-0 group-hover:scale-105 transition-transform">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <div>
                    <div className="text-3xl font-black text-ink leading-none">
                      {value ?? '—'}
                    </div>
                    <div className="text-sm text-muted mt-1">{t(labelKey)}</div>
                  </div>
                </>
              );

              return to ? (
                <Link
                  key={labelKey}
                  to={to}
                  className="glass rounded-2xl p-6 flex items-center gap-4 transition-all hover:scale-[1.02] hover:border-brand/40 group cursor-pointer"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={labelKey} className="glass rounded-2xl p-6 flex items-center gap-4 group">
                  {cardContent}
                </div>
              );
            })}
          </div>

          {/* Activity Section: Recent Posts & Recent Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* โพสต์ล่าสุดในระบบ */}
            <div className="glass rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <ListOrdered size={16} className="text-brand" />
                  {t('admin.recentPosts')}
                </h3>
                <Link
                  to="/admin/rankings"
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  <span>{t('admin.viewAll')}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {recentPosts.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">{t('admin.noRecentPosts')}</p>
              ) : (
                <div className="space-y-2.5 flex-1">
                  {recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="p-3 rounded-xl border border-line-soft bg-surface/50 hover:bg-surface transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={post.author?.username} src={post.author?.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/post/${post.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-ink hover:text-brand hover:underline truncate block"
                            title={post.title}
                          >
                            {post.title}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span>{post.author?.username || t('common.unknownUser')}</span>
                            <span>·</span>
                            <span className="capitalize">{post.category}</span>
                            <span>·</span>
                            <span>{timeAgo(post.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/post/${post.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-muted hover:text-brand rounded-lg hover:bg-surface-glass transition-colors shrink-0"
                        title={t('admin.viewOriginalPost')}
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* รายงานที่รอตรวจสอบล่าสุด */}
            <div className="glass rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <Flag size={16} className="text-status-warning" />
                  {t('admin.recentReports')}
                </h3>
                <Link
                  to="/admin/reports"
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  <span>{t('admin.viewAll')}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {recentReports.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 size={32} className="text-status-success/60 mb-2" />
                  <p className="text-xs font-medium text-muted">{t('admin.noPendingReports')}</p>
                </div>
              ) : (
                <div className="space-y-2.5 flex-1">
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 rounded-xl border border-line-soft bg-surface/50 hover:bg-surface transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            report.kind === 'post' ? 'bg-brand/10 text-brand-accent' : 'bg-surface-glass text-muted'
                          }`}>
                            {report.kind === 'post' ? t('admin.contentPost') : t('admin.contentTemplate')}
                          </span>
                          <span className="text-xs font-bold text-ink truncate">
                            {report.title || '—'}
                          </span>
                        </div>
                        <p className="text-xs text-ink-soft truncate">{report.reason}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted mt-1">
                          <span>{t('admin.reporter')}: {report.reporter?.username || '—'}</span>
                          <span>·</span>
                          <span>{timeAgo(report.created_at)}</span>
                        </div>
                      </div>
                      <Link
                        to="/admin/reports"
                        className="px-2.5 py-1 text-xs font-semibold text-status-warning bg-status-warning/10 hover:bg-status-warning/20 rounded-lg shrink-0 transition-colors"
                      >
                        {t('admin.actions')}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Secondary Insights: Top Categories & Top Templates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* หมวดหมู่ทั้งหมด */}
            <div className="glass rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-brand" />
                  {t('admin.topCategories')}
                </h3>
                {topCategories.length > 0 && (
                  <span className="text-[11px] font-bold text-muted bg-surface-glass px-2.5 py-0.5 rounded-full border border-line-soft">
                    {topCategories.length} {t('common.categories') || 'หมวดหมู่'}
                  </span>
                )}
              </div>

              {topCategories.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">—</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                  {topCategories.map((c) => {
                    const totalRankings = stats?.rankings || 1;
                    const percentOfTotal = Math.min(100, Math.round((c.count / totalRankings) * 100));
                    const maxCategoryCount = topCategories[0]?.count || 1;
                    const barWidth = Math.min(100, Math.round((c.count / maxCategoryCount) * 100));
                    return (
                      <div key={c.category} className="group">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-ink capitalize group-hover:text-brand transition-colors">
                            {c.category}
                          </span>
                          <span className="text-muted">
                            {c.count} {t('admin.posts')} ({percentOfTotal}%)
                          </span>
                        </div>
                        <div className="w-full bg-surface-glass rounded-full h-2 overflow-hidden border border-line-soft">
                          <div
                            className="bg-brand h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, barWidth)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* เทมเพลตยอดฮิต */}
            <div className="glass rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-brand" />
                  {t('admin.topTemplates')}
                </h3>
                <Link
                  to="/admin/templates"
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  <span>{t('admin.viewAll')}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {topTemplates.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">—</p>
              ) : (
                <div className="space-y-2.5">
                  {topTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-xl border border-line-soft bg-surface/50 hover:bg-surface transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/template/${tpl.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-ink hover:text-brand hover:underline truncate block"
                          title={tpl.title}
                        >
                          {tpl.title}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                          <span className="capitalize">{tpl.category}</span>
                          <span>·</span>
                          <span>{t('admin.createdBy', { name: tpl.author || t('common.unknownUser') })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-brand">{tpl.uses.toLocaleString()} {t('admin.uses')}</div>
                        <div className="text-[11px] text-muted">{tpl.views.toLocaleString()} {t('admin.views')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quick Notification Modal */}
      {isQuickModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsQuickModalOpen(false)}
        >
          <div
            className="bg-surface border border-line-soft rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-line-soft flex items-center justify-between gap-3 bg-surface">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-status-warning/20 text-status-warning flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-ink">{t('admin.quickReportsTitle')}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-status-warning text-canvas">
                      {modalReports.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{t('admin.quickReportsDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface-glass transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {modalLoading ? (
                <div className="py-12 text-center text-sm text-muted animate-pulse">
                  {t('admin.loading')}
                </div>
              ) : modalReports.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 size={40} className="text-status-success mb-2" />
                  <p className="text-sm font-semibold text-ink">{t('admin.noPendingToReview')}</p>
                </div>
              ) : (
                modalReports.map((report) => {
                  const targetUrl = report.kind === 'post'
                    ? (report.ranking_id ? `/post/${report.ranking_id}` : null)
                    : (report.template_id ? `/template/${report.template_id}` : null);
                  const titleText = (report.kind === 'post' ? report.ranking_title : report.template_title) || '—';

                  return (
                    <div
                      key={report.id}
                      className="p-3.5 rounded-xl border border-line-soft bg-surface-glass hover:border-line transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              report.kind === 'post' ? 'bg-brand/10 text-brand-accent' : 'bg-surface text-muted'
                            }`}>
                              {report.kind === 'post' ? t('admin.contentPost') : t('admin.contentTemplate')}
                            </span>
                            <span className="text-xs text-muted capitalize">
                              {report.kind === 'post' ? report.ranking_category : report.template_category}
                            </span>
                            <span className="text-xs text-muted">·</span>
                            <span className="text-xs text-muted">{timeAgo(report.created_at)}</span>
                          </div>
                          {targetUrl ? (
                            <Link
                              to={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-ink hover:text-brand hover:underline inline-flex items-center gap-1.5 group"
                              title={titleText}
                            >
                              <span className="truncate">{titleText}</span>
                              <ExternalLink size={13} className="shrink-0 text-muted group-hover:text-brand transition-colors" />
                            </Link>
                          ) : (
                            <div className="text-sm font-bold text-ink truncate">{titleText}</div>
                          )}
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="p-2.5 rounded-lg bg-surface border border-line-soft text-xs text-ink-soft">
                        <span className="font-semibold text-muted mr-1">{t('admin.reason')}:</span>
                        {report.reason}
                      </div>

                      {/* Footer of item: reporter & quick buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-muted truncate">
                          {t('admin.reporter')}: <span className="text-ink font-medium">{report.reporter?.username || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(report.id, 'resolved')}
                            disabled={busyReportId === report.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-status-success bg-status-success/10 hover:bg-status-success/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <Check size={13} />
                            <span>{t('admin.markResolved')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(report.id, 'dismissed')}
                            disabled={busyReportId === report.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <X size={13} />
                            <span>{t('admin.dismiss')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line-soft flex items-center justify-between gap-3 bg-surface/80">
              <Link
                to="/admin/reports"
                onClick={() => setIsQuickModalOpen(false)}
                className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
              >
                <span>{t('admin.openFullReports')}</span>
                <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-ink hover:bg-surface-glass border border-line-soft transition-colors cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
