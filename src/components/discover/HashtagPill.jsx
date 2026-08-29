import { Link } from 'react-router-dom';
import { formatCount } from '../../lib/format';

export default function HashtagPill({ tag, count }) {
  const cleanTag = tag.replace('#', '');
  return (
    <Link
      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
      className="px-5 py-2.5 bg-surface-glass border border-line-soft rounded-full text-brand-accent hover:bg-surface hover:text-brand hover:border-line transition-all font-bold text-sm shadow-sm hover:-translate-y-0.5 text-center"
    >
      {tag} <span className="text-muted font-normal ml-1">({formatCount(count)})</span>
    </Link>
  );
}



