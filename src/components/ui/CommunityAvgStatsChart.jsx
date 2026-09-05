import { useTranslation } from 'react-i18next'

// ชาร์ตสรุปสถิติ Community Average — การ์ดขาวที่ capture เป็น PNG สำหรับแชร์/โหลด
// แท่งความยาว ∝ คะแนนเฉลี่ยของ item (เทียบ maxScore = จำนวน tier ของเทมเพลต)
// ต่อแถว: อันดับ + ชื่อ + แท่ง + ★ ค่าเฉลี่ย + จำนวนโหวต — จัดเรียง avg มากไปน้อย
export default function CommunityAvgStatsChart({ title, subtitle, items = [], maxScore, topN = 10 }) {
  const { t } = useTranslation()
  const sorted = [...items]
    .filter((it) => it.avg != null)
    .sort((a, b) => b.avg - a.avg || (b.votes || 0) - (a.votes || 0))
    .slice(0, topN)

  const best = sorted[0]
  const divisor = Math.max(1, maxScore || 1)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ background: '#ffffff', minWidth: 360 }}>
      {title && <p className="text-sm font-bold text-gray-900">{title}</p>}
      {subtitle && <p className="mt-0.5 text-xs font-medium text-gray-500">{subtitle}</p>}

      {best && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t('stats.best', { name: best.name, avg: best.avg, votes: best.votes ?? 0 })}
        </p>
      )}

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
          <span className="w-5 shrink-0 text-right">#</span>
          <span className="w-32 shrink-0">{t('stats.item')}</span>
          <span className="flex-1" />
          <span className="w-12 shrink-0 text-right">{t('stats.avg')}</span>
          <span className="w-10 shrink-0 text-right">{t('stats.votes')}</span>
        </div>

        {sorted.map((it, idx) => (
          <div key={it.name} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[11px] font-bold text-gray-400">{idx + 1}</span>
            <span className="w-32 shrink-0 truncate text-[12px] font-semibold text-gray-800">{it.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                style={{ width: `${Math.min(100, Math.max(4, (it.avg / divisor) * 100))}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[11px] font-bold text-gray-700">★ {it.avg}</span>
            <span className="w-10 shrink-0 text-right text-[10px] font-medium text-gray-400">{it.votes ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}