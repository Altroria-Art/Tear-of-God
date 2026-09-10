import TierLabel from '../tier/TierLabel'

// Export preview สำหรับ Community Average — ใช้ capture เป็น PNG (ภาพตารางสะอาด)
// แสดงชื่อ item ต่อ tier ตามที่เห็นบนหน้า ไม่มีป้ายคะแนน/โหวตยิบย่อยปนในภาพ
// สำหรับจุด export ของ Community Average ใน TemplateDetailPage และ CommunityAveragePage
export default function CommunityAvgExportPreview({ title, category, updatedText, tiers = [] }) {
  const totalItems = tiers.reduce((acc, row) => acc + (row.items?.length || 0), 0)

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm text-gray-900" style={{ background: '#ffffff' }}>
      {/* Header: Infographic style */}
      <div className="mb-4 flex flex-col gap-1.5 border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            ★ TEAR OF GOD
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
            Community Average
          </span>
          {category && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/60">
              {category}
            </span>
          )}
        </div>
        {title && <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">{title}</h2>}
        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
          {updatedText && <span>{updatedText}</span>}
          <span>·</span>
          <span>{totalItems} items</span>
        </div>
      </div>

      {/* Tier list table: Unified clean grid ("กล่อง 4 เหลี่ยมสวย") */}
      <div className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-200 bg-gray-50 shadow-2xs">
        {tiers.map((row, index) => {
          const isLong = (row.label || '').length > 2
          const items = row.items || []
          const isEmpty = items.length === 0

          return (
            <div key={row.label || index} className={`flex items-stretch ${isEmpty ? 'min-h-[44px]' : 'min-h-[56px]'} bg-gray-50`}>
              <TierLabel
                label={row.label}
                color={row.color}
                index={index}
                className={`w-16 sm:w-20 font-black shrink-0 ${isLong ? 'text-xs' : 'text-xl'} flex items-center justify-center`}
                fallbackClassName="bg-gray-200 text-gray-700"
              />
              <div className="flex flex-wrap items-center gap-2 p-2.5 flex-grow min-w-0 bg-white">
                {isEmpty ? (
                  <span className="px-2 text-xs italic text-gray-400 font-medium select-none">
                    ไม่มีรายการในระดับนี้
                  </span>
                ) : (
                  items.map((item, idx) => {
                    const itemName = typeof item === 'object' ? (item.name || item.title) : item
                    const itemImg = typeof item === 'object' ? (item.image_url || item.image) : null

                    return (
                      <div
                        key={idx}
                        className="flex h-16 w-16 sm:h-18 sm:w-18 aspect-square shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-1.5 text-center shadow-2xs overflow-hidden"
                        title={itemName}
                      >
                        {itemImg ? (
                          <img src={itemImg} alt={itemName} className="h-full w-full rounded-lg object-cover pointer-events-none" />
                        ) : (
                          <span className="w-full line-clamp-3 text-[11px] font-semibold leading-tight text-gray-800 break-words select-none px-0.5">
                            {itemName}
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer: Watermark */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-100 text-[11px] text-gray-400 font-medium">
        <span>Tear of God Community Ranking</span>
        <span className="font-semibold text-gray-500">tearofgod.pages.dev</span>
      </div>
    </div>
  )
}