import { Undo2, Redo2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EditorToolbar({ history, ranked, total, onSave, saving, disabled }) {
  const { t } = useTranslation();
  return (
    <div className="editor-toolbar" aria-label={t('editor.tools')}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={history.undo} disabled={!history.canUndo || saving} aria-label={t('editor.undo')} title={t('editor.undo')} className="editor-icon-button"><Undo2 size={19} /></button>
        <button type="button" onClick={history.redo} disabled={!history.canRedo || saving} aria-label={t('editor.redo')} title={t('editor.redo')} className="editor-icon-button"><Redo2 size={19} /></button>
      </div>
      <p role="status" className="text-xs sm:text-sm text-muted flex-1 text-center">{t('editor.progress', { ranked, total })}</p>
      <button type="button" onClick={onSave} disabled={saving || disabled} className="flex items-center justify-center gap-2 rounded-xl bg-brand text-canvas px-4 py-3 text-sm font-bold whitespace-nowrap disabled:opacity-50">
        <Upload size={16} className="hidden sm:block" />{saving ? t('rank.saving') : t('editor.publish')}
      </button>
    </div>
  );
}
