import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SortDropdown({ value, options, onChange, label = 'SORT BY:' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const currentLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  useEffect(() => {
    if (!open) return;
    const selected = root.current?.querySelector('[aria-checked="true"]');
    (selected || root.current?.querySelector('[role="menuitemradio"]'))?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const handleMenuKey = event => {
    if (event.key === 'Escape') {
      event.preventDefault(); setOpen(false); trigger.current?.focus(); return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    const choices = [...root.current.querySelectorAll('[role="menuitemradio"]')];
    const current = choices.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (current + 1) % choices.length
      : event.key === 'ArrowUp' ? (current - 1 + choices.length) % choices.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : null;
    if (next !== null) { event.preventDefault(); choices[next]?.focus(); }
  };

  return (
    <div ref={root} className="sort-control relative max-w-full">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-line-soft bg-surface px-3 text-sm text-muted hover:bg-surface-glass hover:text-ink"
      >
        {label} <span className="font-semibold text-ink-soft">{currentLabel}</span>
        <ChevronDown size={14} aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} onKeyDown={handleMenuKey} className="ui-popover absolute right-0 top-full mt-2 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-line-soft bg-surface p-1.5 shadow-xl z-50">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === value}
              tabIndex={-1}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-glass ${opt.value === value ? 'bg-tag font-bold text-ink' : 'text-ink-soft'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}




