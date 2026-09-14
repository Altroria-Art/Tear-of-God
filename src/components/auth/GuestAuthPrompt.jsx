import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import { loginPath, signupPath } from '../../lib/navigation';

export default function GuestAuthPrompt({ open, onClose, next = '/' }) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('guestGate.title')}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
          <LogIn size={26} strokeWidth={2.4} />
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{t('guestGate.description')}</p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <Link
            to={loginPath(next)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-canvas shadow-sm transition-all hover:bg-brand-accent active:scale-[0.98]"
          >
            <LogIn size={17} /> {t('guestGate.login')}
          </Link>
          <Link
            to={signupPath(next)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-glass px-4 py-2.5 text-sm font-black text-ink transition-colors hover:bg-tag"
          >
            <UserPlus size={17} /> {t('guestGate.signup')}
          </Link>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-xs font-bold text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          {t('guestGate.continueBrowsing')}
        </button>
      </div>
    </Modal>
  );
}
