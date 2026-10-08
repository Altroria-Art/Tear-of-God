import { Link } from 'react-router-dom';
import { parseHashtags } from '../../lib/hashtags';

// 📍 แสดง hashtag ของ source template เป็นลิงก์ pill — ใช้ UI เดียวกับ PostDetail/HomeFeed
// (อ่านจาก templates.hashtags เท่านั้น ไม่ใช่จาก rankings.hashtags ที่คนอื่นเพิ่มทีหลัง)
// รับได้ทั้ง string แบบ CSV ("#A,#B") หรือ array แล้วเรนเดอร์ no-op เมื่อไม่มีแท็ก
export default function HashtagList({ hashtags, className = '', singleLine = false, maxTags, overflowHref }) {
  const uniqueTags = parseHashtags(hashtags);
  const shownTags = maxTags == null ? uniqueTags : uniqueTags.slice(0, maxTags);
  const remaining = uniqueTags.length - shownTags.length;

  if (uniqueTags.length === 0) return null;

  return (
    <div className={`flex gap-2 ${singleLine ? 'hashtag-single-line flex-nowrap overflow-x-auto py-0.5' : 'flex-wrap'} ${className}`}>
      {shownTags.map((tag) => {
        const cleanTag = tag.replace('#', '');
        return (
          <Link
            key={tag}
            to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
            className={`px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider hover:border-line hover:shadow-sm transition-all flex items-center ${singleLine ? 'shrink-0 whitespace-nowrap' : ''}`}
          >
            <span className="text-highlight mr-[2px]">#</span>
            <span className="truncate">{cleanTag}</span>
          </Link>
        );
      })}
      {remaining > 0 && overflowHref && <Link to={overflowHref} title={uniqueTags.slice(maxTags).join(' ')} className="inline-flex items-center shrink-0 px-2 text-xs font-semibold text-muted">+{remaining}</Link>}
    </div>
  );
}
