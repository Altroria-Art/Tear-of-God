import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../lib/api';
import RipMark from '../components/ui/RipMark';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg(t('auth.errInvalidEmail'));
      return;
    }
    setErrorMsg('');
    setLoading(true);
    const res = await forgotPassword(email.trim().toLowerCase());
    setLoading(false);
    if (res.success) setSuccess(true);
    else setErrorMsg(res.error || t('auth.errGenericRetry'));
  };

  return <main className="recovery-v2 mx-auto grid min-h-[calc(100dvh-68px)] max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_26rem] md:px-8">
    <div className="recovery-intro">
      <span className="club-serial">TEAR OF GOD / {t('auth.accountRecovery')}</span>
      <h1 className="auth-display mt-5 text-ink">{t('auth.recoveryHeadline1')}<br /><mark>{t('auth.recoveryHeadline2')}</mark></h1>
      <RipMark className="my-6 h-6 w-36 text-hot-red" />
      <p className="max-w-md text-base leading-7 text-ink-soft">{t('auth.forgotPasswordSubtitle')}</p>
      <span className="recovery-sticker" aria-hidden="true">✳</span>
    </div>
    <section className="club-ticket p-6 sm:p-8" aria-label={t('auth.accountRecovery')}>
      {success ? <>
        <div className="recovery-result-mark"><Check size={30} /></div>
        <h2 className="mt-5 text-3xl font-black text-ink">{t('auth.resetLinkSentTitle')}</h2>
        <p className="mt-3 break-all font-bold text-ink-soft">{email}</p>
        <p className="mt-3 text-sm leading-6 text-muted">{t('auth.resetLinkSentDesc')} {t('auth.spamFolderNotice')}</p>
        <Link className="club-primary mt-7 flex min-h-12 items-center justify-center gap-2" to="/reset-password" state={{ email: email.trim().toLowerCase() }}>{t('auth.enterResetCode')}</Link>
        <button type="button" onClick={() => { setSuccess(false); setErrorMsg(''); }} className="mt-4 min-h-11 w-full text-sm font-bold text-ink-soft underline underline-offset-4">{t('auth.didNotReceiveEmail')}</button>
      </> : <>
        <span className="club-serial">01 / {t('auth.recovery')}</span>
        <h2 className="mt-4 text-2xl font-black text-ink">{t('auth.forgotPasswordTitle')}</h2>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="club-field"><label htmlFor="recovery-email">{t('auth.email')}</label><input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></div>
          {errorMsg && <p role="alert" className="club-error">{errorMsg}</p>}
          <button type="submit" disabled={loading} className="club-primary flex min-h-12 w-full items-center justify-center gap-2">{loading ? <Loader2 size={19} className="animate-spin" /> : t('auth.sendResetLink')}</button>
        </form>
        <Link className="mt-5 flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-ink-soft underline underline-offset-4" to="/login"><ArrowLeft size={17} />{t('auth.backToLogin')}</Link>
      </>}
    </section>
  </main>;
}
