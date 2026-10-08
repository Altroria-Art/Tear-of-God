import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resetPassword, verifyResetCode, forgotPassword } from '../lib/api';
import ResetCodeInput from '../components/auth/ResetCodeInput';
import RipMark from '../components/ui/RipMark';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [stage, setStage] = useState(token ? 'password' : 'code');
  const [codeStatus, setCodeStatus] = useState('idle');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(location.state?.email ? Date.now() + 30000 : 0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    if (codeStatus !== 'verified') return;
    const timer = setTimeout(() => setStage('password'), 900);
    return () => clearTimeout(timer);
  }, [codeStatus]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate('/login'), 3500);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const checkCode = async nextCode => {
    if (pending.current || codeStatus === 'verified') return;
    if (!/^\d{6}$/.test(nextCode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg(t('auth.resetCodeInvalid')); return;
    }
    pending.current = true;
    setCodeStatus('checking'); setErrorMsg(''); setNotice('');
    const res = await verifyResetCode({ email: email.trim().toLowerCase(), code: nextCode });
    pending.current = false;
    if (res.success && res.token) { setToken(res.token); setCodeStatus('verified'); }
    else { setCodeStatus('error'); setErrorMsg(res.error || t('auth.errGenericRetry')); }
  };
  const resend = async () => {
    if (pending.current || cooldown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrorMsg(t('auth.errInvalidEmail')); return; }
    pending.current = true;
    setLoading(true); setErrorMsg(''); setNotice('');
    const res = await forgotPassword(email.trim().toLowerCase());
    pending.current = false;
    setLoading(false);
    if (res.success) {
      setCode(''); setCodeStatus('idle');
      setResendAt(Date.now() + 30000); setNow(Date.now());
      setNotice(t('auth.resetLinkSentDesc'));
    } else setErrorMsg(res.error || t('auth.errGenericRetry'));
  };
  const handleSubmit = async event => {
    event.preventDefault();
    if (pending.current) return;
    if (password.length < 8 || password.length > 256) { setErrorMsg(t('auth.passwordLengthError')); return; }
    if (password !== confirmPassword) { setErrorMsg(t('auth.passwordsDoNotMatch')); return; }
    pending.current = true;
    setErrorMsg(''); setLoading(true);
    const res = await resetPassword({ token, password });
    pending.current = false; setLoading(false);
    if (res.success) { setToken(''); setSuccess(true); }
    else setErrorMsg(res.error || t('auth.errGenericRetry'));
  };

  if (stage === 'code') return <main className="reset-verification-page px-4 py-10">
    <div className="reset-verification-intro"><span className="club-serial">TEAR OF GOD / {t('auth.accountRecovery')}</span><h1>{t('auth.verifyEmailTitle')}</h1><p>{t('auth.verifyEmailSubtitle')}</p></div>
    <section className="reset-verification-card" aria-label={t('auth.resetCodeLabel')}>
      <div className="reset-verification-handle" aria-hidden="true" />
      <Mail className="mx-auto text-pop-violet" size={28} aria-hidden="true" />
      <h2>{t('auth.enterResetCode')}</h2>
      <form onSubmit={event => { event.preventDefault(); checkCode(code); }}>
        <label className="reset-email-label" htmlFor="reset-email">{t('auth.email')}</label>
        <input id="reset-email" className="reset-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setErrorMsg(''); }} autoComplete="email" placeholder="name@example.com" disabled={codeStatus === 'checking' || codeStatus === 'verified' || loading} required />
        <p id="reset-code-help" className="reset-verification-help">{t('auth.resetCodeHelp')}</p>
        <ResetCodeInput value={code} status={codeStatus} onChange={next => { setCode(next); setCodeStatus('idle'); setErrorMsg(''); }} onComplete={next => { if (!loading) checkCode(next); }} />
        {errorMsg && <p role="alert" className="reset-code-error">{errorMsg}</p>}
        {notice && <p role="status" className="reset-verification-help">{notice}</p>}
        <button type="submit" className="play-button w-full justify-center" disabled={loading || code.length !== 6 || codeStatus === 'checking' || codeStatus === 'verified'}>{codeStatus === 'checking' ? t('auth.checkingCode') : t('auth.verifyCodeButton')}</button>
      </form>
      <div className="reset-resend"><span>{t('auth.noCodeYet')}</span><button type="button" onClick={resend} disabled={loading || cooldown > 0 || codeStatus === 'checking' || codeStatus === 'verified'}>{loading ? t('common.loading') : cooldown > 0 ? t('auth.resendCountdown', { count: cooldown }) : t('auth.resendCode')}</button></div>
      <Link to="/login" className="reset-login-link"><ArrowLeft size={15} />{t('auth.backToLogin')}</Link>
    </section>
  </main>;

  return <main className="recovery-v2 mx-auto grid min-h-[calc(100dvh-68px)] max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_26rem] md:px-8">
    <div className="recovery-intro"><span className="club-serial">TEAR OF GOD / {t('auth.newPasswordBadge')}</span><h1 className="auth-display mt-5 text-ink">{t('auth.resetHeadline1')}<br /><mark>{t('auth.resetHeadline2')}</mark></h1><RipMark className="my-6 h-6 w-36 text-pop-violet" /><p className="max-w-md text-base leading-7 text-ink-soft">{t('auth.resetPasswordSubtitle')}</p></div>
    <section className="club-ticket p-6 sm:p-8" aria-label={t('auth.newPasswordBadge')}>
      {success ? <><div className="recovery-result-mark"><Check size={30} /></div><h2 className="mt-5 text-3xl font-black text-ink">{t('auth.passwordResetSuccessTitle')}</h2><p className="mt-3 text-sm leading-6 text-muted">{t('auth.passwordResetSuccessDesc')}</p><Link className="club-primary mt-7 flex min-h-12 items-center justify-center" to="/login">{t('auth.goToLoginNow')}</Link></> : <>
        <span className="club-serial">03 / {t('auth.newPassword')}</span><h2 className="mt-4 text-2xl font-black text-ink">{t('auth.resetPasswordTitle')}</h2>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="club-field"><label htmlFor="reset-password">{t('auth.newPassword')}</label><div className="relative"><input id="reset-password" className="pr-12" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={256} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={t('auth.showPassword')} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-soft">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <div className="club-field"><label htmlFor="reset-confirm">{t('auth.confirmPassword')}</label><input id="reset-confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></div>
          {errorMsg && <p role="alert" className="club-error">{errorMsg}</p>}
          <button type="submit" disabled={loading || !token} className="club-primary flex min-h-12 w-full items-center justify-center gap-2">{loading ? <Loader2 size={19} className="animate-spin" /> : t('auth.confirmResetButton')}</button>
        </form><Link to="/forgot-password" className="mt-4 flex min-h-11 items-center justify-center text-sm font-bold underline">{t('auth.resendCode')}</Link><Link className="mt-2 flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-ink-soft" to="/login"><ArrowLeft size={17} />{t('auth.backToLogin')}</Link>
      </>}
    </section>
  </main>;
}
