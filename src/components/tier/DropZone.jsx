import { useEffect, useRef, useState } from 'react';

/** Native drag feedback, shared by both editors. Touch/keyboard use AssignTierModal. */
export default function DropZone({ children, className = '', onDragOver, onDrop, topTier = false }) {
  const [over, setOver] = useState(false);
  const [landed, setLanded] = useState(false);
  const markerRef = useRef(null);
  const frameRef = useRef(0);
  useEffect(() => {
    const clear = () => setOver(false);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear); cancelAnimationFrame(frameRef.current); };
  }, []);
  const positionMarker = (zone, clientX, clientY) => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const cards = [...zone.querySelectorAll(':scope > [data-item-id]')].filter(card => !card.classList.contains('is-dragging'));
      const marker = markerRef.current;
      if (!marker || cards.length === 0) { if (marker) marker.style.opacity = '0'; return; }
      const nearest = cards.map(card => ({ rect: card.getBoundingClientRect() }))
        .sort((a, b) => Math.abs(a.rect.top + a.rect.height / 2 - clientY) + Math.abs(a.rect.left + a.rect.width / 2 - clientX) - Math.abs(b.rect.top + b.rect.height / 2 - clientY) - Math.abs(b.rect.left + b.rect.width / 2 - clientX))[0].rect;
      const zoneRect = zone.getBoundingClientRect();
      marker.style.left = `${(clientX < nearest.left + nearest.width / 2 ? nearest.left : nearest.right) - zoneRect.left + zone.scrollLeft}px`;
      marker.style.top = `${nearest.top - zoneRect.top + zone.scrollTop}px`;
      marker.style.height = `${nearest.height}px`;
      marker.style.opacity = '1';
    });
  };
  return <div
    className={`drop-zone ${className} ${over ? 'is-over' : ''} ${landed ? 'is-landed' : ''} ${topTier ? 'is-top-tier' : ''}`}
    onDragOver={event => { onDragOver?.(event); if (!over) setOver(true); positionMarker(event.currentTarget, event.clientX, event.clientY); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOver(false); cancelAnimationFrame(frameRef.current); } }}
    onDrop={event => { setOver(false); setLanded(true); cancelAnimationFrame(frameRef.current); onDrop?.(event); }}
    onAnimationEnd={() => setLanded(false)}
  >{children}<span ref={markerRef} className="drop-insert-marker" aria-hidden="true" /></div>;
}
