import { Link } from 'react-router-dom';

// 📍 แสดง hashtag ของ source template เป็นลิงก์ pill — ใช้ UI เดียวกับ PostDetail/HomeFeed
// (อ่านจาก templates.hashtags เท่านั้น ไม่ใช่จาก rankings.hashtags ที่คนอื่นเพิ่มทีหลัง)
// รับได้ทั้ง string แบบ CSV ("#A,#B") หรือ array แล้วเรนเดอร์ no-op เมื่อไม่มีแท็ก
export default function HashtagList({ hashtags, className = '' }) {
  const tags = (Array.isArray(hashtags)
    ? hashtags
    : typeof hashtags === 'string'
      ? hashtags.split(',')
      : []
  )
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
  const uniqueTags = [...new Set(tags)];

  if (uniqueTags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {uniqueTags.map((tag) => {
        const cleanTag = tag.replace('#', '');
        return (
          <Link
            key={tag}
            to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
            className="px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider hover:border-line hover:shadow-sm transition-all flex items-center"
          >
            <span className="text-highlight mr-[2px]">#</span>
            {cleanTag}
          </Link>
        );
      })}
    </div>
  );
}