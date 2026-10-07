import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import RipMark from './RipMark';

/** A compact editorial header; accents carry personality without competing with content. */
export default function PlayHeader({ eyebrow, title, description, action, to, reveal = false, visual, variant, secondaryAction, secondaryTo, children }) {
  return (
    <header className={`play-header ${variant ? `play-header--${variant}` : ''} ${reveal ? 'tear-reveal' : ''}`}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-xs font-semibold text-muted">{eyebrow}</p>}
        <h1 className="play-title">{title}</h1>
        <RipMark className="play-rip-mark" />
        {description && <p className="play-description">{description}</p>}
        {children}
        {visual && action && to && (
          <div className="home-actions">
            <Link to={to} className="play-button play-header-action">{action}<ArrowUpRight size={19} aria-hidden="true" /></Link>
            {secondaryAction && secondaryTo && <a href={secondaryTo} className="home-secondary-action">{secondaryAction}</a>}
          </div>
        )}
      </div>
      {visual}
      {!visual && action && to && <Link to={to} className="play-button shrink-0">{action}<ArrowUpRight size={19} aria-hidden="true" /></Link>}
    </header>
  );
}
