import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { useToast } from './Toast';

export default function DeleteConfirmation({ open, message, onClose, onConfirm }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const pending = useRef(false);

  const close = () => { if (!pending.current) onClose(); };
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    try {
      const deleted = await onConfirm();
      if (deleted) {
        pending.current = false;
        onClose();
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  };

  return <Modal open={open} onClose={close} title={t('common.delete')} footer={<>
    <button type="button" disabled={deleting} onClick={close} className="dialog-secondary">{t('common.cancel')}</button>
    <button type="button" disabled={deleting} onClick={confirm} className="dialog-danger">{deleting ? t('common.deleting') : t('common.delete')}</button>
  </>}>
    <p className="text-sm text-ink-soft break-words" aria-live="polite">{message}</p>
  </Modal>;
}
