import { useEffect } from 'react';
import { CloseIcon } from './Icons';
import { useTranslation } from 'react-i18next';

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full ${maxWidth} rounded-2xl border border-line-soft bg-surface shadow-2xl shadow-black/30`}>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-tag hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-line-soft px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
