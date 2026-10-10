import { useTranslation } from 'react-i18next';

// สร้างรายการหน้าแบบมี "…" คั่น เพื่อไม่ให้ปุ่มพ่นเยอะเกินไปเมื่อจำนวนหน้ามาก
// เช่น totalPages=10, page=1 -> [1,2,3,'...',10]
function buildPageList(page, totalPages) {
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result = [];
  let prev = null;
  sorted.forEach((p) => {
    if (prev !== null && p - prev > 1) result.push('...');
    result.push(p);
    prev = p;
  });
  return result;
}

export default function Pagination({ page, totalPages, onChange }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="navigation" aria-label={t('common.page', 'Page')}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="min-h-11 min-w-11 rounded-lg border border-line-soft bg-surface px-3 py-2 text-sm hover:bg-surface-glass disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('common.prev')}
      </button>
      {pageList.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={`min-h-11 min-w-11 rounded-lg px-3 py-2 text-sm ${p === page ? 'bg-brand text-canvas' : 'border border-line-soft bg-surface hover:bg-surface-glass'}`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="min-h-11 min-w-11 rounded-lg border border-line-soft bg-surface px-3 py-2 text-sm hover:bg-surface-glass disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('common.next')}
      </button>
    </div>
  );
}




