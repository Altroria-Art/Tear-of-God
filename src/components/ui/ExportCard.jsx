import Avatar from './Avatar';
import TierLabel from '../tier/TierLabel';

export default function ExportCard({ title, authorName, authorAvatar, postedAt, category, tiers = [] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ background: '#ffffff' }}>
      {/* Header: ผู้โพสต์ + เวลา */}
      <div className="flex items-center gap-3">
        <Avatar name={authorName} src={authorAvatar} size="md" />
        <div>
          <p className="text-[15px] font-bold text-gray-900">{authorName || 'Unknown User'}</p>
          {postedAt && <p className="text-[13px] font-medium text-gray-500">{postedAt}</p>}
        </div>
      </div>

      {/* หมวด/list type */}
      {category && (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">
            {category}
          </span>
        </div>
      )}

      {/* ชื่อ */}
      {title && <h2 className="mt-3 text-xl font-extrabold text-gray-900 leading-tight">{title}</h2>}

      {/* ตาราง tier */}
      <div className="mt-4 space-y-2">
        {tiers.map(({ tier, color, items }, index) => (
          <div key={tier} className="flex items-stretch rounded-xl overflow-hidden min-h-[50px] border border-gray-200 bg-gray-50">
            <TierLabel
              label={tier}
              color={color}
              index={index}
              className="w-14 font-black text-lg"
              fallbackClassName="bg-gray-200 text-gray-700"
            />
            <div className="p-2.5 flex flex-wrap gap-2 items-center flex-grow bg-gray-50 min-w-0">
              {(items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-center text-[10px] font-medium text-gray-800 shadow-sm break-words"
                >
                  <span className="line-clamp-2 leading-normal">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
