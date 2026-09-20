import { formatHashtags } from '../../lib/hashtags';
import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Trash2, Flag, ExternalLink } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminReports, setReportStatus, deleteAdminComment, deleteAdminRanking, deleteAdminTemplate } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import { parseDbDate, timeAgo } from '../../lib/format';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;
const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATUS_FILTERS = [
  { value: 'pending', labelKey: 'admin.statusPending' },
  { value: 'resolved', labelKey: 'admin.statusResolved' },
];

const STATUS_META = {
  pending: { labelKey: 'admin.statusPending', cls: 'text-status-warning bg-status-warning/10' },
  resolved: { labelKey: 'admin.statusResolved', cls: 'text-status-success bg-status-success/10' },
  dismissed: { labelKey: 'admin.statusDismissed', cls: 'text-muted bg-tag' },
};

export default function Reports() {
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const { refreshPending } = useOutletContext() || {};
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (filter, pageNum) => {
    setLoading(true);
    const res = await fetchAdminReports({ userId: currentUser?.id, status: filter, page: pageNum, limit: PAGE_LIMIT });
    if (res.success) {
      setReports(res.data || []);
      setTotal(res.total || 0);
      setPendingCount(res.pending_count || 0);
    } else {
      toast.error(res.error || t('admin.errLoadReports'));
    }
    setLoading(false);
  }, [currentUser?.id, toast, t]);

  useEffect(() => {
    setPage(1);
    load(status, 1);
  }, [status, load]);

  const handleStatus = async (r, nextStatus) => {
    setBusy(r.id);
    const res = await setReportStatus({ userId: currentUser?.id, targetId: r.id, status: nextStatus });
    setBusy(null);
    if (!res.success) {
      toast.error(res.error || t('admin.statusUpdateFailed', { msg: '' }));
      return;
    }
    toast.success(t('admin.statusUpdated'));

    // Use the status the API actually confirmed, not just the button's intent.
    const confirmedStatus = res.data?.status || nextStatus;

    if (confirmedStatus !== status) {
      // The row no longer belongs to the active tab — drop it immediately. The
      // target tab back-fills via its own fetch on switch, so no page refresh.
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      // Same-tab transition: keep the row, just reflect the new state locally.
      const closedAt = confirmedStatus === 'pending' ? null : new Date().toISOString().slice(0, 19).replace('T', ' ');
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: confirmedStatus, closed_at: closedAt } : x)));
    }
    if (confirmedStatus !== 'pending' && r.status === 'pending') setPendingCount((c) => Math.max(0, c - 1));
    if (confirmedStatus === 'pending' && r.status !== 'pending') setPendingCount((c) => c + 1);
    refreshPending?.();
  };

  const handleDeleteContent = async (r) => {
    if (!window.confirm(t('admin.confirmDeleteReportContent'))) return;
    setBusy(r.id);

    // ลบ target ที่ report อ้างถึง — reuse admin delete APIs เดิมตาม kind
    // (backend enforce admin เองทุก endpoint) Deleting the content also removes
    // the report row itself via FK cascade / explicit report cleanup, so the row
    // is dropped from the list instead of being marked resolved.
    let res;
    if (r.kind === 'comment' || r.kind === 'template_comment') {
      res = await deleteAdminComment(r.kind === 'comment' ? r.comment_id : r.template_comment_id, r.kind === 'template_comment');
    } else if (r.kind === 'post' && r.ranking_id) {
      res = await deleteAdminRanking({ userId: currentUser?.id, targetId: r.ranking_id });
    } else if (r.kind === 'template' && r.template_id) {
      res = await deleteAdminTemplate({ userId: currentUser?.id, targetId: r.template_id });
    }

    setBusy(null);
    if (res?.success) {
      toast.success(t('admin.deleteContentSuccess'));
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setTotal((prev) => Math.max(0, prev - 1));
      if (r.status === 'pending') setPendingCount((c) => Math.max(0, c - 1));
      refreshPending?.();
    } else {
      toast.error(res?.error || t('admin.deleteContentFailed'));
    }
  };

  // Remaining time until a closed report is auto-deleted (0 when the window passed).
  const autoDeleteLabel = (closedAt) => {
    const closed = parseDbDate(closedAt);
    if (!closed) return null;
    const remaining = closed.getTime() + REOPEN_WINDOW_MS - Date.now();
    if (remaining <= 0) return null;
    const totalMinutes = Math.ceil(remaining / 60000);
    return t('admin.autoDeleteIn', { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-black text-ink">{t('admin.manageReports')}</h1>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-status-warning bg-status-warning/10 rounded-full px-2.5 py-1">
            <Flag size={12} /> {t('admin.pendingCount', { count: pendingCount })}
          </span>
        )}
      </div>
      <p className="text-sm text-muted mb-6">{t('admin.reportsHelp')}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              status === value ? 'bg-brand text-canvas shadow-md' : 'text-muted hover:text-ink hover:bg-surface-glass'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">{t('admin.loading')}</p>
      ) : reports.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">{t('admin.noReports')}</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold w-[28%]">{t('admin.content')}</th>
                  <th className="px-4 py-3 font-bold w-[18%]">{t('admin.reason')}</th>
                  <th className="px-4 py-3 font-bold w-[12%]">{t('admin.reporter')}</th>
                  <th className="px-4 py-3 font-bold w-[14%]">{t('admin.time')}</th>
                  <th className="px-4 py-3 font-bold w-[10%]">{t('admin.status')}</th>
                  <th className="px-4 py-3 font-bold text-right w-[18%]">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.pending;
                  
                  let targetUrl = null;
                  let titleText = '—';
                  let contextText = '';
                  let labelText = '';
                  let labelCls = '';

                  if (r.kind === 'comment') {
                    targetUrl = r.ranking_id ? `/post/${r.ranking_id}` : null;
                    titleText = r.comment_content || '—';
                    contextText = r.ranking_title || '—';
                    labelText = 'Comment (Post)';
                    labelCls = 'bg-amber-500/10 text-amber-600';
                  } else if (r.kind === 'template_comment') {
                    targetUrl = r.template_id ? `/template/${r.template_id}` : null;
                    titleText = r.template_comment_content || '—';
                    contextText = r.template_title || '—';
                    labelText = 'Comment (Template)';
                    labelCls = 'bg-amber-500/10 text-amber-600';
                  } else if (r.kind === 'post') {
                    targetUrl = r.ranking_id ? `/post/${r.ranking_id}` : null;
                    titleText = r.ranking_title || '—';
                    contextText = formatHashtags(r.ranking_hashtags) || '';
                    labelText = t('admin.contentPost', 'Post');
                    labelCls = 'bg-brand/10 text-brand-accent';
                  } else {
                    targetUrl = r.template_id ? `/template/${r.template_id}` : null;
                    titleText = r.template_title || '—';
                    contextText = formatHashtags(r.template_hashtags) || '';
                    labelText = t('admin.contentTemplate', 'Template');
                    labelCls = 'bg-surface-glass text-muted';
                  }

                  return (
                    <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className={`inline-flex self-start items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${labelCls}`}>
                            {labelText}
                          </span>
                          <div className="text-ink font-medium min-w-0">
                            {targetUrl ? (
                              <Link
                                to={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-brand hover:underline inline-flex items-center gap-1 group max-w-full"
                                title={titleText}
                              >
                                <span className="truncate block max-w-full">{titleText}</span>
                                <ExternalLink size={12} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity text-brand" />
                              </Link>
                            ) : (
                              <span className="truncate block max-w-full text-muted">{titleText}</span>
                            )}
                          </div>
                          {contextText && (
                            <div className="text-xs text-muted truncate">
                              {contextText}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft align-middle">
                        <span className="block truncate max-w-full" title={r.reason}>{r.reason}</span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft align-middle min-w-0">
                        {r.reporter?.id ? (
                          <Link
                            to={`/profile/${r.reporter.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-ink hover:underline block truncate max-w-full"
                          >
                            {r.reporter.username}
                          </Link>
                        ) : r.reporter ? (
                          <span className="block truncate max-w-full">{r.reporter.username}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft align-middle whitespace-nowrap pr-5">
                        <span className="block truncate max-w-full" title={timeAgo(r.created_at)}>{timeAgo(r.created_at)}</span>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${meta.cls}`}>
                          {t(meta.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-middle">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {r.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleStatus(r, 'resolved')}
                                disabled={busy === r.id}
                                className="text-xs font-bold text-status-success hover:bg-status-success/10 rounded-lg px-2 py-1 disabled:opacity-50 whitespace-nowrap"
                              >
                                {t('admin.keepContent')}
                              </button>
                              <button
                                onClick={() => handleDeleteContent(r)}
                                disabled={busy === r.id}
                                className="text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg px-2 py-1 disabled:opacity-50 whitespace-nowrap"
                              >
                                <Trash2 size={14} className="inline-block mr-1" />
                                {t('admin.deleteContent')}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStatus(r, 'pending')}
                              disabled={busy === r.id}
                              className="text-xs font-bold text-brand-accent hover:bg-surface-glass rounded-lg px-2 py-1 disabled:opacity-50 whitespace-nowrap"
                            >
                              {t('admin.reopen')}
                            </button>
                          )}
                        </div>
                        {r.status !== 'pending' && autoDeleteLabel(r.closed_at) && (
                          <div className="text-[11px] text-muted mt-1 whitespace-nowrap">{autoDeleteLabel(r.closed_at)}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); load(status, p); }} />
    </div>
  );
}
