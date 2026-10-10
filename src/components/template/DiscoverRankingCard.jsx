import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Copy, MessageCircle, Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import TierLabel from '../tier/TierLabel';
import ShareExportModal from '../ui/ShareExportModal';
import Modal from '../ui/Modal';
import BookmarkButton from './BookmarkButton';
import HashtagList from './HashtagList';
import { buildDiscoverCommunityBoard } from '../../lib/discoverCommunityBoard';
import { formatDbDate, parseDbDate } from '../../lib/format';
import { normalizeImageUrl } from '../../lib/images';
import { shareUrl } from '../../lib/share';

function BoardItem({ entry, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  const pointer = useRef(null);
  const swiped = useRef(false);
  const name = entry.name || entry.id;
  const image = normalizeImageUrl(entry.image_url);
  return <button type="button" className="discover-board-item" data-board-item={entry.id} data-squeeze-swipe title={name} aria-label={name}
    onPointerDown={event => {
      pointer.current = { x: event.clientX, y: event.clientY };
      swiped.current = false;
    }}
    onPointerUp={event => {
      const start = pointer.current;
      if (start) swiped.current = Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10;
      pointer.current = null;
    }}
    onPointerCancel={() => { pointer.current = null; swiped.current = true; }}
    onClick={event => { if (!event.detail || !swiped.current) onSelect(name); }}>
    {image && !imageFailed ? <img src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <span>{name}</span>}
  </button>;
}

export default function DiscoverRankingCard({ template, onUse, inSavedView = false }) {
  const { t, i18n } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const readingId = useId();
  const article = useRef(null);
  const content = useRef(null);
  const viewTools = useRef(null);
  const footer = useRef(null);
  const { community_average: average, participant_count: participants, stats } = template.board;
  const communityHref = `/template/${encodeURIComponent(template.id)}/community`;
  const { rows, unranked, itemCount } = buildDiscoverCommunityBoard(template.board);
  const hasPosts = Number(template.use_count) > 0;
  const date = formatDbDate(average.updated_at, i18n.language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  useLayoutEffect(() => {
    const measure = () => {
      const height = Number.parseFloat(getComputedStyle(article.current).getPropertyValue('--discover-board-height')) || 600;
      const available = height - viewTools.current.offsetHeight - footer.current.offsetHeight;
      // Compare with the collapsed budget even while expanded, so Collapse stays available.
      setNeedsExpansion(content.current.scrollHeight > available + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [article.current, content.current, viewTools.current, footer.current].forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [template.id]);

  const toggleExpanded = () => {
    setExpanded(value => !value);
    if (expanded) requestAnimationFrame(() => article.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };
  const revealFocusedItem = event => {
    if (!needsExpansion || expanded || !event.target.matches('[data-board-item]:focus-visible')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const item = event.target;
    const box = item.getBoundingClientRect();
    if (box.top < bounds.top || box.bottom > bounds.bottom) {
      setExpanded(true);
      requestAnimationFrame(() => item.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
  };

  return <article ref={article} className={`discover-ranking-card${expanded ? ' is-expanded' : ''}`} data-topic-id={template.id} data-board-kind="community">
    <div id={readingId} className={`discover-board-reading${needsExpansion && !expanded ? ' has-overflow' : ''}`} onFocusCapture={revealFocusedItem}>
      <div ref={content} className="discover-board-reading-content">
        <header className="discover-board-header">
          <div className="discover-board-topline">
            <div className="discover-board-community">
              <span className="discover-board-community-icon"><Users size={18} aria-hidden="true" /></span>
              <div>
                <Link to={communityHref}>{t('discover.boards.community')}</Link>
                {date && <p>{t('discover.boards.updated')} <time dateTime={parseDbDate(average.updated_at)?.toISOString()}>{date}</time></p>}
              </div>
            </div>
            <div className="discover-board-tools">
              <BookmarkButton template={template} inSavedView={inSavedView} />
              <button type="button" onClick={() => onUse(template)} className="play-button"><Copy size={13} aria-hidden="true" />{t('discover.boards.rank')}</button>
            </div>
          </div>
          <HashtagList hashtags={template.hashtags} />
          <div className="discover-board-heading">
            <h2><Link to={communityHref}>{template.title}</Link></h2>
          </div>
          {template.description && <p className="discover-board-description">{template.description}</p>}
          <span className="discover-board-uses" title={t('discover.boards.communityHelp')}><Users size={13} aria-hidden="true" />{t('discover.boards.people', { count: participants })}</span>
        </header>
        <div className="discover-board-content">
          {hasPosts ? <>
            {rows.map(row => <div key={row.tier} className="discover-full-tier" data-tier={row.tier}>
              <TierLabel label={row.tier} color={row.color} index={row.index} className="discover-board-label" />
              <div className="discover-board-lane">
                {row.items.length ? row.items.map(entry => <BoardItem key={entry.id} entry={entry} onSelect={setSelectedItem} />) : <p className="discover-board-empty-tier">{t('feed.emptyTier')}</p>}
              </div>
            </div>)}
            {unranked.length > 0 && <section className="discover-board-pool"><h3>{t('discover.boards.unranked')}</h3><div>{unranked.map(entry => <BoardItem key={entry.id} entry={entry} onSelect={setSelectedItem} />)}</div></section>}
            {!rows.length && !unranked.length && <p className="discover-board-empty-tier">{t('template.noItems')}</p>}
          </> : <section className="discover-board-pool">
            <h3>{t('discover.boards.noRanking')}</h3>
            <p>{t('discover.boards.beFirst')}</p>
            <div>{unranked.map(entry => <BoardItem key={entry.id} entry={entry} onSelect={setSelectedItem} />)}</div>
            {!unranked.length && <p>{t('template.noItems')}</p>}
          </section>}
        </div>
      </div>
    </div>
    <div ref={viewTools} className="discover-board-view-tools">
      {(needsExpansion || expanded) && <button type="button" className="discover-board-expand" aria-controls={readingId} aria-expanded={expanded} onClick={toggleExpanded}>
        {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{t(expanded ? 'discover.boards.collapse' : 'discover.boards.expand')}
      </button>}
      <span>{t('discover.boards.itemCount', { count: itemCount })}</span>
    </div>
    <footer ref={footer} className="discover-board-footer">
      <Link to={`${communityHref}#comments`} className="discover-board-comment"><MessageCircle size={17} aria-hidden="true" />{t('post.comments')}<span>{stats.comments}</span></Link>
      <button type="button" onClick={() => setShareOpen(true)} className="discover-board-share"><Share2 size={17} aria-hidden="true" />{t('common.share')}</button>
    </footer>
    <ShareExportModal open={shareOpen} mode="share" onClose={() => setShareOpen(false)} link={shareUrl(communityHref)} />
    <Modal open={selectedItem !== null} onClose={() => setSelectedItem(null)} title={t('common.itemDetails')}>
      <p className="text-center text-lg font-bold leading-relaxed text-ink break-words">{selectedItem}</p>
    </Modal>
  </article>;
}
