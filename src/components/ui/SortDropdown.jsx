import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SortDropdown({ value, options, onChange, label = 'SORT BY:' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const currentLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-muted hover:text-ink-soft"
      >
        {label} <span className="font-semibold text-ink-soft">{currentLabel}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-40 rounded-lg border border-line-soft glass py-2 shadow-xl z-50 animate-dropdown-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-surface-glass"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}