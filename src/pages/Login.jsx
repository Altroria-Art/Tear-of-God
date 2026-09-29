import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { registerUser, loginUser, syncGoogleUser } from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';
import { returnPath } from '../lib/navigation';
import TierLabel from '../components/tier/TierLabel';
import RipMark from '../components/ui/RipMark';

const SAMPLE_ROWS = [
  { label: 'S', color: '#ff7f7f', items: ['ต้มยำกุ้ง', 'แกงเขียวหวาน'] },
  { label: 'A', color: '#ffbf7f', items: ['ลาบหมู'] },
  { label: 'B', color: '#ffff7f', items: ['หมูกระทะ'] },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = returnPath(location.search);
  const setupPath = `/profile?setup=education&next=${encodeURIComponent(next === '/' ? '/profile' : next)}`;
  const { login } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(() => new URLSearchParams(location.search).get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password || (isRegister && !username.trim())) {
      toast.warning(t('auth.warnFillAll'));
      return;
    }
    if (isRegister && password !== confirmPassword) {
      toast.warning(t('auth.warnPasswordMismatch'));
      return;
    }
    setIsLoading(true);
    if (isRegister) {
      const { error } = await registerUser({ email, password, username });
      setIsLoading(false);
      if (error) {
        toast.error(t('auth.errRegisterFailed', { msg: error }));
      } else {
        toast.success(t('auth.successRegister'));
        setIsLoading(true);
        const { data, error: loginError } = await loginUser({ email, password });
        setIsLoading(false);
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setIsRegister(false);
        if (loginError) {
          toast.error(t('auth.errLoginFailed', { msg: loginError }));
          navigate(`/login?next=${encodeURIComponent(setupPath)}`, { replace: true });
        } else {
          login(data);
          navigate(setupPath, { replace: true });
        }
      }
    } else {
      const { data, error } = await loginUser({ email, password });
      setIsLoading(false);
      if (error) {
        toast.error(t('auth.errLoginFailed', { msg: error }));
      } else {
        login(data);
        toast.success(t('auth.successLogin'));
        navigate(next, { replace: true });
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { data: firebaseUser, error } = await signInWithGoogle();
      if (error) { toast.error(t('auth.errGoogleFailed', { msg: error })); return; }
      const { data: dbUser, error: syncError, isNewUser } = await syncGoogleUser(firebaseUser);
      if (syncError) { toast.error(t('auth.errSyncFailed', { msg: syncError })); return; }
      login(dbUser);
      toast.success(t('auth.successWelcome', { name: dbUser?.username || firebaseUser.username }));
      navigate(isNewUser ? setupPath : next, { replace: true });
    } catch (error) {
      toast.error(t('auth.errGoogleFailed', { msg: error.message }));
    } finally {
      setIsLoading(false);
    }
  };

  return <main className="auth-v2 min-h-[calc(100dvh-68px)] px-4 py-5 sm:px-8 lg:py-8">
    <div className="mx-auto max-w-7xl">
      <div className="club-serial mb-3 flex items-center gap-3 text-ink-soft"><span className="brand-mark">t</span> TEAR OF GOD / {t('auth.clubEntry')}</div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] lg:gap-12">
        <div className="min-w-0 lg:pt-5">
          <h1 key={isRegister ? 'register' : 'login'} className={`auth-display text-ink ${isRegister ? 'auth-display--register' : ''}`}>
            {isRegister ? <><span>{t('auth.clubRegister1')}</span><span><mark>{t('auth.clubRegister2')}</mark></span><span>{t('auth.clubRegister3')}</span></> : <><span>{t('auth.clubLogin1')}</span><span><mark>{t('auth.clubLogin2')}</mark></span><span>{t('auth.clubLogin3a')}</span><span>{t('auth.clubLogin3b')}</span></>}
          </h1>
          <RipMark className="mt-4 h-5 w-32 text-pop-violet" />
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft sm:text-base">{t('auth.heroSubtitle')}</p>
          <div className="auth-example mt-6 hidden lg:block" aria-label={t('play.example')}>
            <div className="club-serial mb-2 text-muted">{t('play.example')} / #FOOD</div>
            <div className="border-2 border-ink bg-surface p-3 shadow-[5px_5px_0_var(--color-pop-pink)]">
              <p className="mb-2 text-sm font-black text-ink">{t('auth.clubSampleTitle')}</p>
              {SAMPLE_ROWS.map(row => <div key={row.label} className="mb-1 flex min-h-10 items-stretch gap-1 bg-tag p-1">
                <TierLabel label={row.label} color={row.color} className="grid w-9 shrink-0 place-items-center font-black text-acid-ink" />
                <span className="flex flex-wrap items-center gap-1.5 px-1">{row.items.map(item => <span key={item} className="bg-surface px-2 py-1 text-[11px] font-bold text-ink">{item}</span>)}</span>
              </div>)}
            </div>
          </div>
        </div>

        <section className="club-ticket min-w-0 p-5 sm:p-6 lg:mt-8" aria-label={isRegister ? t('auth.signUp') : t('auth.logIn')}>
          <div className="club-ticket-head">
            <p className="club-serial text-muted">{t('auth.clubPass')} / 001</p>
            <h2 className="mt-2 font-display text-3xl font-black uppercase leading-none tracking-tight text-ink sm:text-4xl">{isRegister ? t('auth.clubJoinTitle') : t('auth.clubWelcomeTitle')}</h2>
            <p className="mt-2 text-sm text-ink-soft">{isRegister ? t('auth.quickTimeSubtitle') : t('auth.loginSubtitle')}</p>
          </div>
          <div className={`auth-mode-tabs mb-4 grid grid-cols-2 border-b-2 border-line-soft ${isRegister ? 'auth-mode-tabs--register' : ''}`} role="group" aria-label={t('auth.clubEntry')}>
            <button type="button" aria-pressed={!isRegister} onClick={() => setIsRegister(false)} className={`min-h-11 px-2 py-2 text-sm font-black ${!isRegister ? 'text-ink' : 'text-muted'}`}>{t('auth.logIn')}</button>
            <button type="button" aria-pressed={isRegister} onClick={() => setIsRegister(true)} className={`min-h-11 px-2 py-2 text-sm font-black ${isRegister ? 'text-ink' : 'text-muted'}`}>{t('auth.switchToSignup')}</button>
          </div>
          <div key={isRegister ? 'register-form' : 'login-form'} className="auth-form-content">
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {isRegister && <div><label htmlFor="register-username" className="club-label">{t('auth.username')}</label><input id="register-username" className="club-field" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder={t('auth.usernamePlaceholder')} /></div>}
            <div><label htmlFor={isRegister ? 'register-email' : 'login-email'} className="club-label">{t('auth.email')}</label><input id={isRegister ? 'register-email' : 'login-email'} className="club-field" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t('auth.emailPlaceholder')} /></div>
            <div>
              <div className="flex items-center justify-between"><label htmlFor={isRegister ? 'register-password' : 'login-password'} className="club-label">{t('auth.password')}</label>{!isRegister && <Link className="text-xs font-bold text-highlight hover:underline" to="/forgot-password">{t('auth.forgotPassword')}</Link>}</div>
              <div className="relative"><input id={isRegister ? 'register-password' : 'login-password'} className="club-field pr-12" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={t('auth.showPassword')} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center text-muted">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </div>
            {isRegister && <div><label htmlFor="register-confirm-password" className="club-label">{t('auth.confirmPassword')}</label><div className="relative"><input id="register-confirm-password" className="club-field pr-12" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /><button type="button" aria-label={t('auth.showPassword')} onClick={() => setShowConfirmPassword(value => !value)} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center text-muted">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>}
            <button type="submit" disabled={isLoading} className="play-button w-full">{isLoading ? t('auth.processing') : isRegister ? t('auth.signUp') : t('auth.logIn')}<ArrowUpRight size={18} aria-hidden="true" /></button>
          </form>
          <div className="mt-4 border-t border-dashed border-line-soft pt-3">
            <p className="club-serial mb-2 text-center text-muted">{t('auth.or')}</p>
            <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="club-choice flex w-full items-center justify-center gap-3 text-sm text-ink"><span className="font-black text-hot-red">G</span>{t('auth.continueGoogle')}</button>
          </div>
          </div>
        </section>
      </div>
    </div>
  </main>;
}
