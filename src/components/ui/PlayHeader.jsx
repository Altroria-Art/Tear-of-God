import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

/** A compact editorial header; accents carry personality without competing with content. */
export default function PlayHeader({ eyebrow, title, description, action, to, reveal = false, visual, variant, children }) {
  return (
    <header className={`play-header ${variant ? `play-header--${variant}` : ''} ${reveal ? 'tear-reveal' : ''}`}>
      <div className="min-w-0 flex-1">
        {eyebrow && <span className="sticker"><Sparkles size={13} aria-hidden="true" />{eyebrow}</span>}
        <h1 className="play-title">{title}</h1>
        {description && <p className="play-description">{description}</p>}
        {children}
        {visual && action && to && <Link to={to} className="play-button play-header-action">{action}<ArrowUpRight size={19} aria-hidden="true" /></Link>}
      </div>
      {visual}
      {!visual && action && to && <Link to={to} className="play-button shrink-0">{action}<ArrowUpRight size={19} aria-hidden="true" /></Link>}
    </header>
  );
}
