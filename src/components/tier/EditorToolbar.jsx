import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditorToolbar({ ranked, total, onSave, saving, disabled, label, icon: Icon = Upload }) {
  const { t } = useTranslation();
  return (
    <div
      className={`editor-toolbar-float ${total === 0 ? 'is-idle' : ranked === total ? 'is-ready' : 'is-progress'} fixed bottom-0 inset-x-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-2 sm:px-0 sm:pb-0 sm:bottom-6 sm:inset-x-auto sm:right-6 md:right-8 z-60 pointer-events-none w-full sm:w-auto sm:max-w-[calc(100vw-32px)]`}
      aria-label={t('editor.tools')}
    >
      <div className="pointer-events-auto flex items-center justify-between gap-2.5 sm:gap-4 rounded-2xl sm:rounded-full border border-line-soft/80 bg-surface/90 backdrop-blur-xl shadow-2xl px-4 sm:px-5 py-2.5 sm:py-2 ring-1 ring-black/5 dark:ring-white/10 transition-all hover:shadow-3xl">
        <div className="flex flex-col min-w-0 gap-1 pl-1">
          <progress className="editor-progress" aria-label={t('editor.progress', { ranked, total })} value={ranked} max={Math.max(total, 1)} />
          <p role="status" className="text-xs sm:text-sm font-bold text-ink">
            {t('editor.progress', { ranked, total })}
          </p>
        </div>

        <div className="w-px h-5 bg-line-soft shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onSave}
          disabled={saving || disabled}
          className={`play-button ${saving ? 'tear-reveal' : ''}`}
        >
          <Icon size={14} className="shrink-0" />
          <span className="text-[13px] sm:text-sm font-bold">{saving ? (label ? t('duel.submitting') : t('rank.saving')) : (label || t('editor.publish'))}</span>
        </button>
      </div>
    </div>
  );
}
