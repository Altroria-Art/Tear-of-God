import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, LayoutGrid, ListOrdered } from 'lucide-react';
import SqueezeCarousel from '../ui/SqueezeCarousel';
import TierLabel from '../tier/TierLabel';
import DiscoverRankingCard from './DiscoverRankingCard';
import { buildDiscoverCommunityBoard } from '../../lib/discoverCommunityBoard';

function BoardPreview({ template }) {
  const { t } = useTranslation();
  const { rows } = buildDiscoverCommunityBoard(template.board);
  const hasPosts = Number(template.use_count) > 0;
  return <div className="discover-squeeze-preview">
    <div className="discover-squeeze-mini-board">
      {hasPosts && rows.length ? rows.slice(0, 4).map(row => <div key={row.tier} className="discover-squeeze-mini-tier">
        <TierLabel label={row.tier} color={row.color} index={row.index} className="discover-squeeze-mini-label" />
        <div>{row.items.slice(0, 4).map(entry => <span key={entry.id} className="discover-squeeze-mini-item"><span>{entry.name}</span></span>)}</div>
      </div>) : <div className="discover-squeeze-no-ranking"><ListOrdered size={32} /><span>{t(hasPosts ? 'template.noItems' : 'discover.boards.noRanking')}</span></div>}
    </div>
    <div className="discover-squeeze-preview-caption"><strong>{template.title}</strong><span>{t('discover.boards.community')}</span></div>
  </div>;
}

function BrowseAll({ href, preview = false }) {
  const { t } = useTranslation();
  return <div className={`discover-squeeze-end${preview ? ' is-preview' : ''}`} data-squeeze-end={!preview || undefined}>
    <span className="discover-squeeze-end-icon"><LayoutGrid size={28} aria-hidden="true" /></span>
    <h2>{t('discover.viewAll')}</h2>
    <p>{t('discover.carousel.moreDescription')}</p>
    {!preview && <Link to={href} className="discover-squeeze-all-link">{t('discover.viewAll')}<ArrowUpRight size={18} aria-hidden="true" /></Link>}
  </div>;
}

export default function DiscoverBoardCarousel({ templates, onUse, inSavedView = false, viewAllHref }) {
  const { t } = useTranslation();
  const slides = viewAllHref ? [...templates, { id: 'discover:all', title: t('discover.viewAll'), browseAll: true }] : templates;
  return <div className="discover-squeeze">
    <SqueezeCarousel slides={slides} label={t('discover.browseTopics')} labels={{
      carousel: t('discover.carousel.label'), slide: t('discover.carousel.slide'),
      previous: t('discover.carousel.previous'), next: t('discover.carousel.next'), help: t('discover.carousel.help'),
      position: (index, count) => t('discover.carousel.position', { index, count }),
      choose: (title, index, count) => t('discover.carousel.choose', { title, index, count }),
    }} renderSlide={template => template.browseAll ? <BrowseAll href={viewAllHref} /> : <DiscoverRankingCard template={template} onUse={onUse} inSavedView={inSavedView} />} renderPreview={template => template.browseAll ? <BrowseAll preview /> : <BoardPreview template={template} />} />
  </div>;
}
