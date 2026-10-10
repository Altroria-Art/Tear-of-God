import { useId, useLayoutEffect, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function TableScroller({ label, children }) {
  const { t } = useTranslation();
  const region = useRef(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const element = region.current;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return <>
    <p id={hintId} hidden={!overflow} className="border-b border-line-soft px-4 py-2 text-xs leading-relaxed text-muted">
      <MoveHorizontal size={16} aria-hidden="true" className="mr-2 inline-block align-middle" />
      {t('common.scrollTable')}
    </p>
    <div ref={region} role="region" aria-label={label} aria-describedby={overflow ? hintId : undefined} tabIndex={overflow ? 0 : undefined} className="overflow-x-auto">
      {children}
    </div>
  </>;
}
