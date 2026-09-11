import { Undo2, Redo2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditorToolbar({ history, ranked, total, onSave, saving, disabled }) {
  const { t } = useTranslation();
  return (
    <div className="editor-toolbar px-4 md:px-8" aria-label={t('editor.tools')}>
      <div className="max-w-7xl mx-auto flex items-center gap-2 w-full">
        <div className="flex items-center gap-1">
          <button type="button" onClick={history.undo} disabled={!history.canUndo || saving} aria-label={t('editor.undo')} title={t('editor.undo')} className="editor-icon-button"><Undo2 size={19} /></button>
          <button type="button" onClick={history.redo} disabled={!history.canRedo || saving} aria-label={t('editor.redo')} title={t('editor.redo')} className="editor-icon-button"><Redo2 size={19} /></button>
        </div>
        <p role="status" className="text-xs sm:text-sm text-muted flex-1 text-center font-medium">{t('editor.progress', { ranked, total })}</p>
        <button type="button" onClick={onSave} disabled={saving || disabled} className="flex items-center justify-center gap-2 rounded-xl bg-brand text-canvas px-6 py-2.5 text-sm font-bold whitespace-nowrap shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-sm">
          <Upload size={16} className="hidden sm:block" />{saving ? t('rank.saving') : t('editor.publish')}
        </button>
      </div>
    </div>
  );
}
