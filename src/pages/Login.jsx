import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { registerUser, loginUser, syncGoogleUser } from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';
import { returnPath } from '../lib/navigation';
import RipMark from '../components/ui/RipMark';
import AuthVisualPanel from '../components/auth/AuthVisualPanel';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = returnPath(location.search);
  const setupPath = `/profile?setup=education&next=${encodeURIComponent(next === '/' ? '/profile' : next)}`;
  const { login } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(() => new URLSearchParams(location.search).get('mode') === 'signup');
  const [loginEmail, setLoginEmail] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [authError, setAuthError] = useState('');
  const email = isRegister ? registerEmail : loginEmail;
  const password = isRegister ? registerPassword : loginPassword;
  const changeMode = (register) => {
    if (isLoading) return;
    setLoginEmail('');
    setRegisterEmail('');
    setUsername('');
    setLoginPassword('');
    setRegisterPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAuthError('');
    setIsRegister(register);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    if (!email || !password || (isRegister && !username.trim())) {
      setAuthError(t('auth.warnFillAll'));
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setAuthError(t('auth.warnPasswordMismatch'));
      return;
    }
    setIsLoading(true);
    if (isRegister) {
      const { error } = await registerUser({ email, password, username });
      setIsLoading(false);
      if (error) {
        setAuthError(t('auth.errRegisterFailed', { msg: error }));
      } else {
        toast.success(t('auth.successRegister'));
        setIsLoading(true);
        const { data, error: loginError } = await loginUser({ email, password });
        setIsLoading(false);
        setLoginPassword('');
        setRegisterPassword('');
        setConfirmPassword('');
        setUsername('');
        changeMode(false);
        if (loginError) {
          setAuthError(t('auth.errLoginFailed', { msg: loginError }));
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
        setAuthError(t('auth.errLoginFailed', { msg: error }));
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
      if (error) { setAuthError(t('auth.errGoogleFailed', { msg: error })); return; }
      const { data: dbUser, error: syncError, isNewUser } = await syncGoogleUser(firebaseUser);
      if (syncError) { setAuthError(t('auth.errSyncFailed', { msg: syncError })); return; }
      login(dbUser);
      toast.success(t('auth.successWelcome', { name: dbUser?.username || firebaseUser.username }));
      navigate(isNewUser ? setupPath : next, { replace: true });
    } catch (error) {
      setAuthError(t('auth.errGoogleFailed', { msg: error.message }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-v2 min-h-[calc(100dvh-68px)] flex items-center justify-center p-4 sm:p-8">
      <div className="auth-book-wrap w-full max-w-[1000px] mx-auto">
      <div className={`auth-card auth-book relative flex flex-col ${isRegister ? 'auth-card--register' : 'auth-card--login'}`}>
        
        {/* MOBILE VISUAL HEADER (Below md) */}
        <div className="auth-book-mobile-head lg:hidden flex flex-col items-center justify-center text-center p-4 bg-ink text-canvas">
          <h2 className="text-2xl font-display font-black text-canvas uppercase tracking-tight leading-none mb-2">
            {isRegister ? t('auth.joinTheClub') : t('auth.memberAccess')}
          </h2>
          <RipMark className="h-4 w-24 text-pop-violet mb-4" />
          <p className="text-sm text-canvas/80 font-medium">
            {isRegister ? t('auth.buildTierLists') : t('auth.yourListsWaiting')}
          </p>
        </div>

        <div className="auth-book-pages">
        {/* Both pages reserve the same space, including the inactive form. */}
        <div 
          className={`auth-book-form auth-book-form--login flex flex-col justify-center p-6 lg:p-8 ${isRegister ? 'auth-book-form--inactive' : ''}`}
          inert={isRegister ? true : undefined}
          aria-hidden={isRegister ? "true" : undefined}
        >
          <div className="mb-5">
            <p className="club-serial text-muted mb-2">TEAR OF GOD / {t('auth.memberAccess').toUpperCase()}</p>
            <h2 className="font-display text-4xl font-black uppercase leading-none tracking-tight text-ink">
              {t('auth.clubWelcomeTitle')}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">{t('auth.loginSubtitle')}</p>
          </div>
          
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {authError && <p role="alert" className="text-sm text-hot-red">{authError}</p>}
            <div>
              <label htmlFor="login-email" className="club-label">{t('auth.email')}</label>
              <input id="login-email" name="login-email" className="club-field" type="email" autoComplete="section-login username" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} placeholder={t('auth.emailPlaceholder')} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="club-label">{t('auth.password')}</label>
                <Link className="text-xs font-bold text-highlight hover:underline" to="/forgot-password">{t('auth.forgotPassword')}</Link>
              </div>
              <div className="relative">
                <input id="login-password" name="login-password" className="club-field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="section-login current-password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} />
                <button type="button" aria-label={t('auth.showPassword')} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center text-muted">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="play-button w-full mt-2">
              {isLoading ? t('auth.processing') : t('auth.logIn')}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>
          
          <div className="mt-4 border-t border-dashed border-line-soft pt-3">
            <p className="club-serial mb-3 text-center text-muted">{t('auth.or')}</p>
            <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="club-choice flex w-full items-center justify-center gap-3 text-sm text-ink bg-canvas hover:bg-surface border-2 border-line-soft">
              <span className="font-black text-hot-red">G</span>{t('auth.continueGoogle')}
            </button>
          </div>
        </div>

        {/* SIGNUP FORM PANE */}
        <div 
          className={`auth-book-form auth-book-form--signup flex flex-col justify-center p-6 lg:p-8 ${!isRegister ? 'auth-book-form--inactive' : ''}`}
          inert={!isRegister ? true : undefined}
          aria-hidden={!isRegister ? "true" : undefined}
        >
          <div className="mb-5">
            <p className="club-serial text-muted mb-2">TEAR OF GOD / {t('auth.newMember').toUpperCase()}</p>
            <h2 className="font-display text-4xl font-black uppercase leading-none tracking-tight text-ink">
              {t('auth.clubJoinTitle')}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">{t('auth.quickTimeSubtitle')}</p>
          </div>
          
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {authError && <p role="alert" className="text-sm text-hot-red">{authError}</p>}
            <div>
              <label htmlFor="register-username" className="club-label">{t('auth.username')}</label>
              <input id="register-username" name="register-username" className="club-field" autoComplete="section-signup username" value={username} onChange={event => setUsername(event.target.value)} placeholder={t('auth.usernamePlaceholder')} />
            </div>
            <div>
              <label htmlFor="register-email" className="club-label">{t('auth.email')}</label>
              <input id="register-email" name="register-email" className="club-field" type="email" autoComplete="section-signup email" value={registerEmail} onChange={event => setRegisterEmail(event.target.value)} placeholder={t('auth.emailPlaceholder')} />
            </div>
            <div>
              <label htmlFor="register-password" className="club-label">{t('auth.password')}</label>
              <div className="relative">
                <input id="register-password" name="register-password" className="club-field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="section-signup new-password" value={registerPassword} onChange={event => setRegisterPassword(event.target.value)} />
                <button type="button" aria-label={t('auth.showPassword')} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center text-muted">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="register-confirm-password" className="club-label">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <input id="register-confirm-password" name="register-confirm-password" className="club-field pr-12" type={showConfirmPassword ? 'text' : 'password'} autoComplete="section-signup new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
                <button type="button" aria-label={t('auth.showPassword')} onClick={() => setShowConfirmPassword(value => !value)} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center text-muted">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="play-button w-full mt-2">
              {isLoading ? t('auth.processing') : t('auth.signUp')}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>
          
          <div className="mt-4 border-t border-dashed border-line-soft pt-3">
            <p className="club-serial mb-3 text-center text-muted">{t('auth.or')}</p>
            <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="club-choice flex w-full items-center justify-center gap-3 text-sm text-ink bg-canvas hover:bg-surface border-2 border-line-soft">
              <span className="font-black text-hot-red">G</span>{t('auth.continueGoogle')}
            </button>
          </div>
        </div>
        </div>

        {/* MOBILE MODE SWITCHER (Below md) */}
        <div className="auth-book-mobile-switch lg:hidden p-5 border-t-2 border-line-soft bg-surface text-center">
          <p className="text-sm text-ink-soft mb-2">
            {isRegister ? t('auth.alreadyRanking') : t('auth.newHere', 'New to Tear of God?')}
          </p>
          <button 
            type="button" 
            onClick={() => changeMode(!isRegister)}
            className="min-h-11 px-3 text-sm font-bold text-pop-violet hover:underline uppercase tracking-wide"
          >
            {isRegister ? t('auth.backToLoginBtn') : t('auth.createAccountBtn')}
          </button>
        </div>

        {/* A two-sided page turns around the book's center spine. */}
        <AuthVisualPanel isRegister={isRegister} onSwitchMode={changeMode} />
        
      </div>
      </div>
    </main>
  );
}
