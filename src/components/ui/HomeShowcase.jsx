import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TierLabel from '../tier/TierLabel';

const DEMO_TIERS = [
  { label: 'S', color: '#ff7f7f', icon: '🎧', key: 'demoMusic' },
  { label: 'A', color: '#ffbf7f', icon: '🍜', key: 'demoFood' },
  { label: 'B', color: '#ffff7f', icon: '🎮', key: 'demoGames' },
];

export default function HomeShowcase() {
  const { t } = useTranslation();
  const board = useRef(null);
  const [visible, setVisible] = useState(false);
  const [order, setOrder] = useState([0, 1, 2]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(board.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={board} className={`home-demo ${visible ? 'is-visible' : ''}`} aria-label={t('play.demoBoard')}>
    <div className="home-demo-caption"><span className="ink-drop" aria-hidden="true" />{t('play.demoBoard')}<button type="button" className="ml-auto min-h-11 underline" onClick={() => setOrder([0, 1, 2])}>{t('play.demoReset')}</button></div>
    {DEMO_TIERS.map(({ label, color }, index) => <div className="home-demo-row" key={label}>
      <TierLabel label={label} color={color} className="home-demo-tier" />
      <button type="button" className="home-demo-item" aria-label={t('play.demoMove', { item: t(`play.${DEMO_TIERS[order[index]].key}`), tier: label })} onClick={() => setOrder(previous => {
        const next = [...previous];
        const destination = (index + 1) % next.length;
        [next[index], next[destination]] = [next[destination], next[index]];
        return next;
      })} style={{ '--demo-index': index }}><span aria-hidden="true">{DEMO_TIERS[order[index]].icon}</span>{t(`play.${DEMO_TIERS[order[index]].key}`)}<span aria-hidden="true">↕</span></button>
    </div>)}
    <p className="home-demo-help" role="status">{t('play.demoHelp')}</p>
  </div>;
}
