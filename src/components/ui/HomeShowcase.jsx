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

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(board.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={board} className={`home-demo ${visible ? 'is-visible' : ''}`} aria-label={t('play.demoBoard')}>
    <div className="home-demo-caption"><span className="ink-drop" aria-hidden="true" />{t('play.demoBoard')}</div>
    {DEMO_TIERS.map(({ label, color, icon, key }, index) => <div className="home-demo-row" key={label}>
      <TierLabel label={label} color={color} className="home-demo-tier" />
      <span className="home-demo-item" style={{ '--demo-index': index }}><span aria-hidden="true">{icon}</span>{t(`play.${key}`)}</span>
    </div>)}
  </div>;
}
