import { Link } from 'react-router-dom';
import { formatCount } from '../../lib/format';

export default function HashtagPill({ tag, count }) {
  const cleanTag = tag.replace('#', '');
  return (
    <Link
      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
      className="px-4 py-2 bg-[#f2ede6] border border-[#cec6b4] rounded-full text-[#4b4639] hover:bg-[#ece7e1] transition-colors font-bold text-sm shadow-xs text-center"
    >
      {tag} <span className="text-[#9a927e] font-normal">({formatCount(count)})</span>
    </Link>
  );
}

