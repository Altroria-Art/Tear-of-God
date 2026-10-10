import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const SHARES = [0.64, 0.22, 0.1, 0.04];
const GAP = 16;
const SLAT = 8;

function panelWidths(count, selected, width, hovered, desktop) {
  // On a phone the selected board gets the entire width; swiping changes topics.
  if (!desktop || width < 800) return Array(count).fill(width);
  const visible = Math.min(4, count - selected);
  const slats = Math.min(3, Math.max(0, count - selected - visible));
  const room = Math.max(0, width - GAP * (visible + slats - 1) - slats * SLAT);
  const shares = SHARES.slice(0, visible).map((share, index) => share * (selected + index === hovered ? 1.15 : 1));
  const total = shares.reduce((sum, share) => sum + share, 0);
  const expanded = shares.map(share => room * share / total);
  // Even the narrow selectable panels retain a 44px pointer target.
  for (let index = 1; index < expanded.length; index++) {
    const extra = Math.max(0, 44 - expanded[index]);
    expanded[index] += extra;
    expanded[0] -= extra;
  }
  return Array.from({ length: count }, (_, index) => {
    const column = index - selected;
    return column < 0 || column >= visible ? SLAT : expanded[column];
  });
}

// Adapted from the supplied carousel-squeeze: a wide panel, narrowing neighbours,
// and a sliding strip. The caller controls its card height and expansion behavior.
export default function SqueezeCarousel({ slides, renderSlide, renderPreview, label, labels }) {
  const id = useId();
  const viewport = useRef(null);
  const gesture = useRef(null);
  const [selectedId, setSelectedId] = useState(slides[0]?.id);
  const [width, setWidth] = useState(0);
  const [desktop, setDesktop] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(600);
  const [hovered, setHovered] = useState(-1);
  const selected = Math.max(0, slides.findIndex(slide => slide.id === selectedId));
  const activeSlideId = slides[selected]?.id;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const content = element.querySelector('[data-selected=true] > div');
    const measure = () => {
      setWidth(element.clientWidth);
      setDesktop(window.matchMedia('(min-width: 1024px)').matches);
      if (content) setPreviewHeight(content.parentElement.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [slides.length, activeSlideId]);

  const choose = index => {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    setSelectedId(slides[next]?.id);
    setHovered(-1);
    viewport.current?.focus({ preventScroll: true });
  };
  const widths = panelWidths(slides.length, selected, width, hovered, desktop);
  const offset = widths.slice(0, selected).reduce((sum, value) => sum + value + GAP, 0);
  const onKeyDown = event => {
    // Leave form fields and the board's own controls to handle their own keys.
    if (event.target !== viewport.current && !event.target.closest('[data-squeeze-choice], .squeeze-controls')) return;
    if (event.key === 'ArrowRight') choose(selected + 1);
    else if (event.key === 'ArrowLeft') choose(selected - 1);
    else if (event.key === 'Home') choose(0);
    else if (event.key === 'End') choose(slides.length - 1);
    else return;
    event.preventDefault();
  };
  const onPointerDown = event => {
    const control = event.target.closest('a, button, input, textarea, select');
    // Item buttons opt into swiping while retaining their tap/keyboard action.
    if (event.pointerType === 'mouse' || !event.isPrimary || (control && !control.hasAttribute('data-squeeze-swipe'))) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = event => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.25) choose(selected + (dx < 0 ? 1 : -1));
  };

  if (!slides.length) return null;
  return <section className="squeeze-carousel" role="region" aria-roledescription={labels.carousel} aria-label={label} onKeyDown={onKeyDown}>
    <div className="squeeze-toolbar">
      <p className="squeeze-help">{labels.help}</p>
      <div className="squeeze-controls">
        <span className="squeeze-position" role="status" aria-live="polite" aria-atomic="true">{labels.position(selected + 1, slides.length)}</span>
        <button type="button" data-squeeze-prev aria-label={labels.previous} aria-controls={`${id}-viewport`} disabled={selected === 0} onClick={() => choose(selected - 1)}><ArrowLeft size={20} aria-hidden="true" /></button>
        <button type="button" data-squeeze-next aria-label={labels.next} aria-controls={`${id}-viewport`} disabled={selected === slides.length - 1} onClick={() => choose(selected + 1)}><ArrowRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
    <div ref={viewport} id={`${id}-viewport`} className="squeeze-viewport" style={{ '--squeeze-preview-height': `${previewHeight}px` }} tabIndex={0} aria-label={label} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { gesture.current = null; }} onPointerLeave={() => setHovered(-1)}>
      <div className="squeeze-track" style={{ transform: `translateX(${-offset}px)` }}>
        {slides.map((slide, index) => <div key={slide.id} className={`squeeze-panel${index === selected ? ' is-selected' : ''}`} data-squeeze-id={slide.id} data-selected={index === selected} style={{ width: `${widths[index]}px`, '--squeeze-preview-width': `${widths[selected]}px` }} aria-hidden={index < selected || undefined}>
          {index === selected ? <div role="group" aria-roledescription={labels.slide} aria-label={labels.choose(slide.title, index + 1, slides.length)}>{renderSlide(slide)}</div>
            : <button type="button" className="squeeze-choice" data-squeeze-choice aria-label={labels.choose(slide.title, index + 1, slides.length)} tabIndex={desktop && width >= 800 && index > selected && index < selected + 4 ? 0 : -1} onPointerEnter={event => { if (event.pointerType === 'mouse' && index > selected && index < selected + 4) setHovered(index); }} onPointerLeave={() => setHovered(-1)} onFocus={() => setHovered(-1)} onClick={() => choose(index)}>
              <div className="squeeze-preview" aria-hidden="true">{renderPreview(slide)}</div>
            </button>}
        </div>)}
      </div>
    </div>
  </section>;
}
