import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';
import { useTranslation } from 'react-i18next';

let activeModals = 0;
let previousOverflow;
let previousInert;

function lockBackground() {
  const root = document.getElementById('root');
  if (activeModals++ === 0) {
    previousOverflow = document.body.style.overflow;
    previousInert = root?.inert;
    document.body.style.overflow = 'hidden';
    if (root) root.inert = true;
  }
  return () => {
    if (--activeModals === 0) {
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = previousInert;
    }
  };
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md', variant = 'action' }) {
  const { t } = useTranslation();
  const dialog = useRef(null);
  const titleId = useId();
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const unlock = lockBackground();
    const focusable = () => Array.from(dialog.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { e.preventDefault(); dialog.current?.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    (focusable()[0] || dialog.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal--${variant} fixed inset-0 z-[200] flex items-center justify-center p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="dialog-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div ref={dialog} tabIndex={-1} className={`dialog-panel relative flex flex-col w-full max-h-[85dvh] ${maxWidth} rounded-2xl border border-line bg-surface shadow-2xl shadow-black/30`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 id={titleId} className="min-w-0 text-lg font-black text-ink">{title}</h2>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label={t('common.close')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-tag hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap shrink-0 items-center justify-end gap-3 border-t border-line-soft px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>, document.body
  );
}
