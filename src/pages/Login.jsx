import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { registerUser, loginUser, syncGoogleUser } from '../lib/api'; 
import { signInWithGoogle } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning(t('auth.warnFillAll'));
      return;
    }
    if (isRegister && password !== confirmPassword) {
      toast.warning(t('auth.warnPasswordMismatch'));
      return;
    }
    if (isRegister && !username.trim()) {
      toast.warning(t('auth.warnFillAll'));
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
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setIsRegister(false);
      }
    } else {
      const { data, error } = await loginUser({ email, password });
      setIsLoading(false);

      if (error) {
        toast.error(t('auth.errLoginFailed', { msg: error }));
      } else {
        login(data);
        toast.success(t('auth.successLogin'));
        navigate('/');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { data: firebaseUser, error } = await signInWithGoogle();
      if (error) {
        toast.error(t('auth.errGoogleFailed', { msg: error }));
        return;
      }
      const { data: dbUser, error: syncError } = await syncGoogleUser(firebaseUser);
      if (syncError) {
        toast.error(t('auth.errSyncFailed', { msg: syncError }));
        return;
      }
      login(dbUser || firebaseUser);
      toast.success(t('auth.successWelcome', { name: dbUser?.username || firebaseUser.username }));
      navigate('/');
    } catch (err) {
      toast.error(t('auth.errGoogleFailed', { msg: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 font-sans text-ink">
      
      {/* Main Form Container */}
      <div className="glass w-full max-w-md p-8 rounded-2xl shadow-sm border border-line-soft text-center">
        
        <h1 className="text-3xl font-extrabold text-ink mb-2">
          {isRegister ? t('auth.createAccountTitle') : t('auth.loginTitle')}
        </h1>
        <p className="text-sm text-muted mb-8 leading-relaxed">
          {t('auth.tagline1')}<br />{t('auth.tagline2')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">{t('auth.username')}</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder')} 
                className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">{t('auth.email')}</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')} 
              className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-soft">{t('auth.password')}</label>
              {!isRegister && (
                <a href="#" className="text-xs text-muted hover:underline">{t('auth.forgotPassword')}</a>
              )}
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink-soft focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink-soft focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand hover:bg-brand-accent text-canvas font-bold py-3 rounded-xl transition-colors shadow-sm mt-2 disabled:opacity-50"
          >
            {isLoading ? t('auth.processing') : (isRegister ? t('auth.signUp') : t('auth.logIn'))}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-line-soft"></div>
          <span className="px-4 text-xs font-semibold text-muted uppercase tracking-widest">{t('auth.or')}</span>
          <div className="flex-1 border-t border-line-soft"></div>
        </div>

        {/* Google Sign In Button */}
        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full glass hover:bg-surface border border-line-soft text-ink-soft font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          {t('auth.continueGoogle')}
        </button>

        <p className="mt-6 text-sm text-muted">
          {isRegister ? t('auth.haveAccount') : t('auth.newHere')}{' '}
          <button 
            type="button"
            onClick={() => setIsRegister(!isRegister)} 
            className="font-bold text-ink hover:underline ml-1"
          >
            {isRegister ? t('auth.switchToLogin') : t('auth.switchToSignup')}
          </button>
        </p>

      </div>
    </div>
  );
}









