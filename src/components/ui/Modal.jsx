import { useEffect, useState } from 'react';
import { CloseIcon } from './Icons';
import { useTranslation } from 'react-i18next';

// EXIT_MS ต้องตรงกับ --animate-modal-out (0.16s) ใน src/index.css
const EXIT_MS = 170;

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  const { t } = useTranslation();
  // render = ปัจจุบันยัง mount อยู่ไหม (ค้างไว้ระหว่างออกเพื่อให้ exit animation แสดง)
  // closing = กำลังเล่น animation ปิด (กันกด double-close)
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setRender(true);
    } else if (render) {
      setClosing(true);
      const timer = setTimeout(() => {
        setRender(false);
        setClosing(false);
      }, EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [open, render]);

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

  if (!render) return null;

  const handleClose = () => {
    if (closing) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${closing ? 'opacity-0 transition-opacity duration-150' : 'animate-fade-in'}`}
        onClick={handleClose}
      />
      <div
        className={`relative w-full ${maxWidth} rounded-2xl border border-line-soft bg-surface shadow-2xl shadow-black/30 ${
          closing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
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