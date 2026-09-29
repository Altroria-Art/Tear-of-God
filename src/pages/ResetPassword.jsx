import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../lib/api';
import RipMark from '../components/ui/RipMark';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { if (!token) setErrorMsg(t('auth.invalidOrExpiredToken')); }, [token, t]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate('/login'), 3500);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) { setErrorMsg(t('auth.invalidOrExpiredToken')); return; }
    if (password.length < 8 || password.length > 256) { setErrorMsg(t('auth.passwordLengthError')); return; }
    if (password !== confirmPassword) { setErrorMsg(t('auth.passwordsDoNotMatch')); return; }
    setErrorMsg('');
    setLoading(true);
    const res = await resetPassword({ token, password });
    setLoading(false);
    if (res.success) setSuccess(true);
    else setErrorMsg(res.error || t('auth.errGenericRetry'));
  };

  return <main className="recovery-v2 mx-auto grid min-h-[calc(100dvh-68px)] max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_26rem] md:px-8">
    <div className="recovery-intro"><span className="club-serial">TEAR OF GOD / {t('auth.newPasswordBadge')}</span><h1 className="auth-display mt-5 text-ink">{t('auth.resetHeadline1')}<br /><mark>{t('auth.resetHeadline2')}</mark></h1><RipMark className="my-6 h-6 w-36 text-pop-violet" /><p className="max-w-md text-base leading-7 text-ink-soft">{t('auth.resetPasswordSubtitle')}</p><span className="recovery-sticker" aria-hidden="true">✳</span></div>
    <section className="club-ticket p-6 sm:p-8" aria-label={t('auth.newPasswordBadge')}>
      {success ? <><div className="recovery-result-mark"><Check size={30} /></div><h2 className="mt-5 text-3xl font-black text-ink">{t('auth.passwordResetSuccessTitle')}</h2><p className="mt-3 text-sm leading-6 text-muted">{t('auth.passwordResetSuccessDesc')}</p><Link className="club-primary mt-7 flex min-h-12 items-center justify-center gap-2" to="/login">{t('auth.goToLoginNow')}<ArrowLeft size={18} className="rotate-180" /></Link></> : <>
        <span className="club-serial">02 / {t('auth.newPassword')}</span><h2 className="mt-4 text-2xl font-black text-ink">{t('auth.resetPasswordTitle')}</h2>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="club-field"><label htmlFor="reset-password">{t('auth.newPassword')}</label><div className="relative"><input id="reset-password" className="pr-12" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.newPasswordPlaceholder')} autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={t('auth.showPassword')} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-soft">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <div className="club-field"><label htmlFor="reset-confirm">{t('auth.confirmPassword')}</label><input id="reset-confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('auth.confirmPasswordPlaceholder')} autoComplete="new-password" required /></div>
          {errorMsg && <p role="alert" className="club-error">{errorMsg}</p>}
          <button type="submit" disabled={loading || !token} className="club-primary flex min-h-12 w-full items-center justify-center gap-2">{loading ? <Loader2 size={19} className="animate-spin" /> : t('auth.confirmResetButton')}</button>
        </form><Link className="mt-5 flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-ink-soft underline underline-offset-4" to="/login"><ArrowLeft size={17} />{t('auth.backToLogin')}</Link>
      </>}
    </section>
  </main>;
}
