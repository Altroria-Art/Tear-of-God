import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2, Eye, Layers, X } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../components/ui/Toast';
import { fetchAdminTemplates, deleteAdminTemplate, fetchTemplate } from '../../lib/api';
import Pagination from '../../components/ui/Pagination';
import TierLabel from '../../components/tier/TierLabel';
import { useTranslation } from 'react-i18next';

const PAGE_LIMIT = 20;

export default function Templates() {
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  // 📍 in-admin detail modal
  const [detail, setDetail] = useState(null); // { template, rows }
  const [detailLoading, setDetailLoading] = useState(false);

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
      toast.error(res.error || t('admin.errLoadList'));
    }
    setLoading(false);
  }, [currentUser?.id, toast, t]);

  useEffect(() => {
    setPage(1);
    load(debouncedQ, 1);
  }, [debouncedQ, load]);

  const handleDelete = async (template) => {
    if (!window.confirm(t('admin.confirmDeleteTemplate', { title: template.title }))) return;
    setBusy(template.id);
    const res = await deleteAdminTemplate({ userId: currentUser?.id, targetId: template.id });
    setBusy(null);
    if (res.success) {
      toast.success(t('admin.deleteTemplateSuccess'));
      setTemplates((prev) => prev.filter((x) => x.id !== template.id));
      setTotal((total) => Math.max(0, total - 1));
    } else {
      toast.error(res.error || t('admin.deleteTemplateFailed', { msg: '' }));
    }
  };

  // 📍 เปิด modal ดูรายละเอียดเทมเพลต — fetch แบบเต็ม แล้วจัดกลุ่ม item ตาม tier
  const handleView = async (template) => {
    setDetailLoading(true);
    const { data } = await fetchTemplate(template.id, { light: false, period: null });
    setDetailLoading(false);
    if (!data) {
      toast.error(t('admin.errLoadList'));
      return;
    }
    const rows = (Array.isArray(data.tiers) ? data.tiers : []).map((tier) => ({
      label: tier.label,
      color: tier.color,
      items: (data.template_items || [])
        .filter((ti) => ti.tier === tier.label || ti.tier === tier.id)
        .map((ti) => ti.item?.name || ti.item_id)
        .filter(Boolean)
    }));
    setDetail({ template: data, rows });
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-1">{t('admin.manageTemplates')}</h1>
      <p className="text-sm text-muted mb-6">{t('admin.manageTemplatesHelp')}</p>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.searchTemplatePh')}
          className="w-full bg-surface border border-line-soft text-ink rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted animate-pulse">{t('admin.loading')}</p>
      ) : templates.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-sm text-muted">{t('admin.noTemplates')}</div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line-soft">
                  <th className="px-4 py-3 font-bold">{t('admin.title')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.owner')}</th>
                  <th className="px-4 py-3 font-bold">{t('admin.category')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.tiers')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.uses')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.views')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-line-soft last:border-0 hover:bg-surface-glass">
                    <td className="px-4 py-3 text-ink font-medium max-w-[240px] truncate">{template.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{template.creator?.username}</td>
                    <td className="px-4 py-3 text-ink-soft">{template.category}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      <span className="inline-flex items-center gap-1"><Layers size={13} /> {template.tier_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">{template.use_count}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      <span className="inline-flex items-center gap-1"><Eye size={13} /> {template.view_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleView(template)}
                        disabled={detailLoading}
                        className="text-xs font-bold text-highlight hover:bg-status-info/10 rounded-lg px-2 py-1 disabled:opacity-50"
                      >
                        <Eye size={14} className="inline-block mr-1" />
                        {t('admin.view')}
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        disabled={busy === template.id}
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

      {/* 📍 in-admin template detail modal */}
      {detail && !detailLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="glass w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-2xl font-black text-ink">{detail.template.title}</h3>
                <p className="text-sm text-muted mt-1">
                  {t('admin.createdBy', { name: detail.template?.profile?.username || detail.template?.creator?.username || t('common.unknownUser') })}
                  {' · '}{t('admin.category')}: {detail.template.category || '—'}
                </p>
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

            {detail.template.description && (
              <p className="text-sm text-ink-soft mb-4">{detail.template.description}</p>
            )}

            <div className="flex flex-wrap gap-2 mb-4 text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">{t('admin.hashtags')}:</span>
              {(detail.template.hashtags || '').split(',').filter(Boolean).map((h) => (
                <span key={h} className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand">{h.trim()}</span>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-line-soft p-2 bg-surface">
              {detail.rows.length === 0 ? (
                <p className="text-center text-sm text-muted py-6">{t('admin.noItems')}</p>
              ) : (
                detail.rows.map((row) => (
                  <div key={row.label} className="flex items-stretch gap-2 rounded-lg">
                    <TierLabel
                      label={row.label}
                      color={row.color}
                      className="w-24 shrink-0 flex items-center justify-center rounded-md"
                    />
                    <div className="flex-1 p-2 min-h-[48px] flex flex-wrap gap-2 items-center">
                      {row.items.length === 0 ? (
                        <span className="text-xs text-muted italic">{t('admin.noItems')}</span>
                      ) : (
                        row.items.map((name, idx) => (
                          <span key={idx} className="rounded-md border border-line-soft glass px-2.5 py-1 text-xs font-medium text-ink-soft whitespace-nowrap">
                            {name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-glass rounded-xl"
              >
                {t('admin.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
