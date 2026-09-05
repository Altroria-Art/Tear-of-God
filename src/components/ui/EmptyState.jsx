import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: IconComp = Inbox, title, children }) {
  return (
    <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-surface-glass border border-line-soft flex items-center justify-center mb-3">
        <IconComp size={20} className="text-muted" />
      </div>
      {title && <p className="text-sm font-bold text-ink-soft">{title}</p>}
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}