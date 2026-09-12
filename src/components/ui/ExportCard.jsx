import Avatar from './Avatar';
import TierLabel from '../tier/TierLabel';

export default function ExportCard({ title, authorName, authorAvatar, postedAt, category, tiers = [], theme = 'light' }) {
  const totalItems = tiers.reduce((acc, row) => acc + (row.items?.length || 0), 0);
  const isDark = theme === 'dark';

  // Explicit styles to ensure html-to-image captures them correctly
  const containerBg = isDark ? '#141517' : '#ffffff'; // Match typical dark mode bg
  
  const clsContainer = isDark 
    ? 'w-full rounded-2xl border border-gray-800 bg-[#141517] p-5 sm:p-6 shadow-sm text-gray-100' 
    : 'w-full rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm text-gray-900';
    
  const clsHeaderBorder = isDark ? 'border-gray-800' : 'border-gray-100';
  const clsTextName = isDark ? 'text-gray-100' : 'text-gray-900';
  const clsTextDate = isDark ? 'text-gray-400' : 'text-gray-500';
  const clsTitle = isDark ? 'text-gray-100' : 'text-gray-900';
  
  const clsTableBorder = isDark ? 'border-gray-800 divide-gray-800 bg-[#1a1b1e]' : 'border-gray-200 divide-gray-200 bg-gray-50';
  const clsRowBg = isDark ? 'bg-[#1a1b1e]' : 'bg-gray-50';
  const clsItemAreaBg = isDark ? 'bg-[#222428]' : 'bg-white';
  const clsItemBorder = isDark ? 'border-gray-700 bg-[#2a2c31] text-gray-200' : 'border-gray-200 bg-white text-gray-800';
  const clsEmptyText = isDark ? 'text-gray-500' : 'text-gray-400';
  const clsFooterBorder = isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400';
  const clsFooterBrand = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={clsContainer} style={{ background: containerBg }}>
      {/* Header: Author + Title */}
      <div className={`mb-4 flex flex-col gap-2 border-b pb-4 ${clsHeaderBorder}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={authorName} src={authorAvatar} size="md" />
            <div>
              <p className={`text-[15px] font-bold ${clsTextName}`}>{authorName || 'Unknown User'}</p>
              {postedAt && <p className={`text-xs font-medium ${clsTextDate}`}>{postedAt}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
              ★ TEAR OF GOD
            </span>
            {category && (
              <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-500 border border-amber-500/30">
                {category}
              </span>
            )}
          </div>
        </div>

        {title && <h2 className={`mt-1 text-xl sm:text-2xl font-black leading-tight ${clsTitle}`}>{title}</h2>}
        <p className={`text-xs font-medium ${clsTextDate}`}>{totalItems} items ranked</p>
      </div>

      {/* Tier list table: Unified clean grid ("กล่อง 4 เหลี่ยมสวย") */}
      <div className={`overflow-hidden rounded-xl border divide-y shadow-2xs ${clsTableBorder}`}>
        {tiers.map(({ tier, color, items }, index) => {
          const isLong = (tier || '').length > 2;
          const list = items || [];
          const isEmpty = list.length === 0;

          return (
            <div key={tier || index} className={`flex items-stretch ${isEmpty ? 'min-h-[44px]' : 'min-h-[56px]'} ${clsRowBg}`}>
              <TierLabel
                label={tier}
                color={color}
                index={index}
                className={`w-16 sm:w-20 font-black shrink-0 ${isLong ? 'text-xs' : 'text-xl'} flex items-center justify-center`}
                fallbackClassName="bg-gray-200 text-gray-700"
              />
              <div className={`flex flex-wrap items-center gap-2 p-2.5 flex-grow min-w-0 ${clsItemAreaBg}`}>
                {isEmpty ? (
                  <span className={`px-2 text-xs italic font-medium select-none ${clsEmptyText}`}>
                    ไม่มีรายการในระดับนี้
                  </span>
                ) : (
                  list.map((item, idx) => {
                    const itemName = typeof item === 'object' ? (item.name || item.title) : item;
                    const itemImg = typeof item === 'object' ? (item.image_url || item.image) : null;

                    return (
                      <div
                        key={idx}
                        className={`flex h-16 w-16 sm:h-18 sm:w-18 aspect-square shrink-0 items-center justify-center rounded-xl border p-1.5 text-center shadow-2xs overflow-hidden ${clsItemBorder}`}
                        title={itemName}
                      >
                        {itemImg ? (
                          <img src={itemImg} alt={itemName} className="h-full w-full rounded-lg object-cover pointer-events-none" />
                        ) : (
                          <span className="w-full line-clamp-3 text-[11px] font-semibold leading-tight break-words select-none px-0.5">
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
      <div className={`mt-4 pt-3 flex items-center justify-between border-t text-[11px] font-medium ${clsFooterBorder}`}>
        <span>Tear of God Ranking</span>
        <span className={`font-semibold ${clsFooterBrand}`}>tearofgod.pages.dev</span>
      </div>
    </div>
  );
}
