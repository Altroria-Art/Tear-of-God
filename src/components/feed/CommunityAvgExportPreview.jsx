import TierLabel from '../tier/TierLabel'

// Export preview สำหรับ Community Average — ใช้ capture เป็น PNG (ภาพตารางสะอาด)
// แสดงชื่อ item ต่อ tier ตามที่เห็นบนหน้า ไม่มีป้ายคะแนน/โหวตยิบย่อยปนในภาพ
// สำหรับจุด export ของ Community Average ใน TemplateDetailPage และ CommunityAveragePage
export default function CommunityAvgExportPreview({ title, updatedText, tiers = [] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ background: '#ffffff' }}>
      {title && <p className="mb-3 text-sm font-bold text-gray-900">{title}</p>}
      {updatedText && <p className="-mt-2 mb-3 text-xs font-medium text-gray-500">{updatedText}</p>}

      <div className="space-y-2">
        {tiers.map((row) => {
          const isLong = row.label.length > 2
          return (
            <div key={row.label} className="flex items-stretch gap-3">
              <TierLabel
                label={row.label}
                color={row.color}
                className={`w-12 min-h-12 rounded-sm font-bold px-1 ${isLong ? 'text-[10px]' : 'text-base'}`}
                fallbackClassName="rounded-sm bg-gray-200 text-gray-700"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {(row.items || []).map((item, idx) => (
                  <span
                    key={idx}
                    className="max-w-[12rem] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-800 shadow-sm"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}