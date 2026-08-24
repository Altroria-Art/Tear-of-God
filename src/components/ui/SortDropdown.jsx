import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SortDropdown({ value, options, onChange, label = 'SORT BY:' }) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        {label} <span className="font-semibold text-gray-700">{currentLabel}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-40 rounded-lg border border-gray-100 bg-white py-2 shadow-xl z-50">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-zinc-100"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

