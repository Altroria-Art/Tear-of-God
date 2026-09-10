import Avatar from './Avatar';
import TierLabel from '../tier/TierLabel';

export default function ExportCard({ title, authorName, authorAvatar, postedAt, category, tiers = [] }) {
  const totalItems = tiers.reduce((acc, row) => acc + (row.items?.length || 0), 0);

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm text-gray-900" style={{ background: '#ffffff' }}>
      {/* Header: Author + Title */}
      <div className="mb-4 flex flex-col gap-2 border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={authorName} src={authorAvatar} size="md" />
            <div>
              <p className="text-[15px] font-bold text-gray-900">{authorName || 'Unknown User'}</p>
              {postedAt && <p className="text-xs font-medium text-gray-500">{postedAt}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
              ★ TEAR OF GOD
            </span>
            {category && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/60">
                {category}
              </span>
            )}
          </div>
        </div>

        {title && <h2 className="mt-1 text-xl sm:text-2xl font-black text-gray-900 leading-tight">{title}</h2>}
        <p className="text-xs font-medium text-gray-500">{totalItems} items ranked</p>
      </div>

      {/* Tier list table: Unified clean grid ("กล่อง 4 เหลี่ยมสวย") */}
      <div className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-200 bg-gray-50 shadow-2xs">
        {tiers.map(({ tier, color, items }, index) => {
          const isLong = (tier || '').length > 2;
          const list = items || [];
          const isEmpty = list.length === 0;

          return (
            <div key={tier || index} className={`flex items-stretch ${isEmpty ? 'min-h-[44px]' : 'min-h-[56px]'} bg-gray-50`}>
              <TierLabel
                label={tier}
                color={color}
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
                  list.map((item, idx) => {
                    const itemName = typeof item === 'object' ? (item.name || item.title) : item;
                    const itemImg = typeof item === 'object' ? (item.image_url || item.image) : null;

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
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: Watermark */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-100 text-[11px] text-gray-400 font-medium">
        <span>Tear of God Ranking</span>
        <span className="font-semibold text-gray-500">tearofgod.pages.dev</span>
      </div>
    </div>
  );
}
