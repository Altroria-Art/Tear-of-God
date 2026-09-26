import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditorToolbar({ ranked, total, onSave, saving, disabled, label, icon: Icon = Upload }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed bottom-5 sm:bottom-6 right-4 sm:right-6 md:right-8 z-60 pointer-events-none max-w-[calc(100vw-32px)]"
      aria-label={t('editor.tools')}
    >
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-4 rounded-full border border-line-soft/80 bg-surface/90 backdrop-blur-xl shadow-2xl px-3.5 sm:px-5 py-2 ring-1 ring-black/5 dark:ring-white/10 transition-all hover:shadow-3xl">
        <div className="flex items-center gap-2 pl-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <p role="status" className="text-xs sm:text-sm font-bold text-ink whitespace-nowrap">
            {t('editor.progress', { ranked, total })}
          </p>
        </div>

        <div className="w-px h-5 bg-line-soft shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onSave}
          disabled={saving || disabled}
          className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-full bg-brand hover:bg-brand-accent text-canvas px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-md cursor-pointer"
        >
          <Icon size={14} className="shrink-0" />
          <span>{saving ? (label ? t('duel.submitting') : t('rank.saving')) : (label || t('editor.publish'))}</span>
        </button>
      </div>
    </div>
  );
}
