import { useCallback, useEffect, useState } from 'react';
import { Trash2, Flag } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminReports, setReportStatus, deleteAdminReport } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import { timeAgo } from '../../lib/format';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;
const STATUS_FILTERS = [
  { value: 'pending', labelKey: 'admin.statusPending' },
  { value: 'resolved', labelKey: 'admin.statusResolved' },
  { value: 'dismissed', labelKey: 'admin.statusDismissed' },
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
    if (res.success) {
      toast.success(t('admin.statusUpdated'));
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: nextStatus } : x)));
      if (nextStatus !== 'pending' && r.status === 'pending') setPendingCount((c) => Math.max(0, c - 1));
      if (nextStatus === 'pending' && r.status !== 'pending') setPendingCount((c) => c + 1);
    } else {
      toast.error(res.error || t('admin.statusUpdateFailed', { msg: '' }));
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(t('admin.confirmDeleteReport'))) return;
    setBusy(r.id);
    const res = await deleteAdminReport({ userId: currentUser?.id, targetId: r.id });
    setBusy(null);
    if (res.success) {
      toast.success(t('admin.reportDeleted'));
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(res.error || t('admin.deleteReportFailed', { msg: '' }));
    }
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
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold">{t('admin.content')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.reason')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.reporter')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.time')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.status')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          r.kind === 'post' ? 'bg-brand/10 text-brand-accent' : 'bg-surface-glass text-muted'
                        }`}>
                          {r.kind === 'post' ? t('admin.contentPost') : t('admin.contentTemplate')}
                        </span>
                        <div className="mt-1 text-ink font-medium max-w-[220px] truncate">
                          {r.kind === 'post' ? r.ranking_title : r.template_title}
                        </div>
                        <div className="text-xs text-muted">
                          {r.kind === 'post' ? r.ranking_category : r.template_category}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-soft max-w-[220px]">{r.reason}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {r.reporter ? r.reporter.username : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{timeAgo(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
                          {t(meta.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleStatus(r, 'resolved')}
                            disabled={busy === r.id}
                            className="text-xs font-bold text-status-success hover:bg-status-success/10 rounded-lg px-2 py-1 disabled:opacity-50"
                          >
                            {t('admin.markResolved')}
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleStatus(r, 'dismissed')}
                            disabled={busy === r.id}
                            className="text-xs font-bold text-muted hover:bg-tag rounded-lg px-2 py-1 disabled:opacity-50"
                          >
                            {t('admin.dismiss')}
                          </button>
                        )}
                        {r.status !== 'pending' && (
                          <button
                            onClick={() => handleStatus(r, 'pending')}
                            disabled={busy === r.id}
                            className="text-xs font-bold text-brand-accent hover:bg-surface-glass rounded-lg px-2 py-1 disabled:opacity-50"
                          >
                            {t('admin.reopen')}
                          </button>
                        )}
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
