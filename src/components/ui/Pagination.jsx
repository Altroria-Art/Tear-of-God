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
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prev
      </button>
      {pageList.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded-md px-3 py-1.5 text-sm ${p === page ? 'bg-brand text-canvas' : 'border border-line-soft hover:bg-surface'}`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}




