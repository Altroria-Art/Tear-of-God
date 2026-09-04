import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, InfoCircleIcon } from './Icons';
import { useTranslation } from 'react-i18next';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircleIcon, chip: 'bg-status-success', bar: 'bg-status-success' },
  error: { icon: AlertTriangleIcon, chip: 'bg-status-error', bar: 'bg-status-error' },
  warning: { icon: AlertTriangleIcon, chip: 'bg-status-warning', bar: 'bg-status-warning' },
  info: { icon: InfoCircleIcon, chip: 'bg-status-info', bar: 'bg-status-info' },
};

const MAX_VISIBLE = 5;
const EXIT_MS = 200;

function ToastItem({ toast, onDismiss }) {
  const variant = VARIANTS[toast.variant] || VARIANTS.info;
  const { t } = useTranslation();
  const Icon = variant.icon;

  return (
    <div
      role="status"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl shadow-2xl shadow-black/20 animate-toast-in transition-all duration-300 ease-out ${
        toast.leaving ? 'translate-y-[-10px] sm:translate-y-0 sm:translate-x-4 scale-95 opacity-0' : ''
      }`}
    >
      <div className="flex items-start gap-3 p-4 pr-9">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${variant.chip} text-white shadow-inner`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm font-semibold leading-snug text-ink pt-2">{toast.message}</p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('common.close')}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted transition-colors hover:bg-tag hover:text-ink"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>

      <div
        className={`h-1 animate-toast-progress transition-opacity duration-300 ${variant.bar} ${toast.isSticky ? 'opacity-0' : 'opacity-100'}`}
        style={{
          animationDuration: `${toast.duration}ms`,
          animationPlayState: toast.paused ? 'paused' : 'running',
        }}
      />
    </div>
  );
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);
  const timers = useRef(new Map()); // id -> { timer, duration, start, remaining }

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((rec) => clearTimeout(rec.timer));
  }, []);

  const remove = useCallback((id) => {
    const rec = timers.current.get(id);
    if (rec) {
      clearTimeout(rec.timer);
      timers.current.delete(id);
    }
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  // เล่น animation จางออกก่อนแล้วค่อยเอาออกจาก state
  const dismiss = useCallback(
    (id) => {
      setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => remove(id), EXIT_MS);
    },
    [remove]
  );

  const push = useCallback((message, variant, opts = {}) => {
    if (!message) return;
    const id = ++counter.current;
    const duration = opts.duration ?? 4000;
    setToasts((ts) => [...ts.slice(-(MAX_VISIBLE - 1)), { id, message, variant, duration }]);

    const rec = { duration, remaining: duration, start: Date.now(), timer: null };
    rec.timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, rec);
  }, [dismiss]);

  const pauseTimer = (id) => {
    const rec = timers.current.get(id);
    if (!rec || rec.timer == null) return;
    clearTimeout(rec.timer);
    rec.timer = null;
    rec.remaining -= Date.now() - rec.start;
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, paused: true, isSticky: true } : t)));
  };

  const resumeTimer = (id) => {
    const rec = timers.current.get(id);
    if (!rec || rec.timer != null) return;
    rec.start = Date.now();
    rec.timer = setTimeout(() => dismiss(id), Math.max(rec.remaining, 800));
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, paused: false } : t)));
  };

  const api = useMemo(
    () => ({
      success: (message, opts) => push(message, 'success', opts),
      error: (message, opts) => push(message, 'error', opts),
      warning: (message, opts) => push(message, 'warning', opts),
      info: (message, opts) => push(message, 'info', opts),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      >
        {toasts.map((toast) => (
          <div key={toast.id} onMouseEnter={() => pauseTimer(toast.id)} onMouseLeave={() => resumeTimer(toast.id)}>
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export default ToastProvider;



