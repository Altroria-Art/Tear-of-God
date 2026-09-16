import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, Check, Sparkles, KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../lib/api';

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

  useEffect(() => {
    if (!token) {
      setErrorMsg(t('auth.invalidOrExpiredToken'));
    }
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg(t('auth.invalidOrExpiredToken'));
      return;
    }
    if (password.length < 8 || password.length > 256) {
      setErrorMsg(t('auth.passwordLengthError'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('auth.passwordsDoNotMatch'));
      return;
    }
    
    setErrorMsg('');
    setLoading(true);
    
    const res = await resetPassword({ token, password });
    setLoading(false);
    
    if (res.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3500);
    } else {
      setErrorMsg(res.error || t('auth.errGenericRetry'));
    }
  };

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center py-12 px-4 overflow-hidden select-none">
      {/* Ambient Radial Glows (Butter-smooth GPU layers) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] rounded-full blur-[110px] opacity-70 dark:opacity-30 will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(255, 120, 80, 0.45) 0%, rgba(255, 180, 140, 0.12) 70%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] rounded-full blur-[110px] opacity-60 dark:opacity-25 will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(160, 100, 255, 0.4) 0%, rgba(100, 180, 255, 0.15) 70%, transparent 100%)',
        }}
      />

      {/* =========================================================================
          Scattered Floating Stickers Across Full Screen (Asymmetric & Organic)
         ========================================================================= */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        
        {/* --- Left Column Scattered Stickers --- */}
        <div
          style={{ top: '10%', left: '7%', transform: 'rotate(-14deg)' }}
          className="animate-float-1 absolute hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-amber-500/10"
        >
          <span className="text-2xl drop-shadow-sm">🔑</span>
          <span className="text-xs font-black text-ink tracking-tight">{t('auth.newPassword')}</span>
        </div>

        <div
          style={{ top: '26%', left: '19%', transform: 'rotate(9deg)' }}
          className="animate-float-2 absolute hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface/85 dark:bg-[#1a1c28]/85 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-lg shadow-black/5"
        >
          <span className="text-xl">⚡</span>
          <span className="text-[11px] font-extrabold text-muted">{t('auth.instantAccess')}</span>
        </div>

        <div
          style={{ top: '48%', left: '5%', transform: 'rotate(-7deg)' }}
          className="animate-float-3 absolute hidden md:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-purple-500/10"
        >
          <span className="text-2xl">🎮</span>
          <span className="text-xs font-black text-ink">{t('auth.tierList')}</span>
        </div>

        <div
          style={{ top: '68%', left: '15%', transform: 'rotate(15deg)' }}
          className="animate-float-4 absolute hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-emerald-500/10"
        >
          <span className="text-xl">🛡️</span>
          <span className="text-xs font-black text-ink">{t('auth.protected')}</span>
        </div>

        <div
          style={{ top: '84%', left: '8%', transform: 'rotate(-11deg)' }}
          className="animate-float-slow absolute hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 dark:bg-[#1a1c28]/85 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-lg shadow-black/5"
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-tier-s font-black text-xs text-white shadow-xs">S</span>
          <span className="text-xs font-bold text-ink">{t('auth.godTier')}</span>
        </div>

        {/* --- Right Column Scattered Stickers --- */}
        <div
          style={{ top: '12%', right: '8%', transform: 'rotate(13deg)' }}
          className="animate-float-2 absolute hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-brand/10"
        >
          <span className="text-2xl drop-shadow-sm">🔐</span>
          <span className="text-xs font-black text-ink tracking-tight">{t('auth.secured')}</span>
        </div>

        <div
          style={{ top: '27%', right: '19%', transform: 'rotate(-13deg)' }}
          className="animate-float-1 absolute hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface/85 dark:bg-[#1a1c28]/85 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-lg shadow-black/5"
        >
          <span className="text-xl">✨</span>
          <span className="text-[11px] font-black text-highlight">#TearOfGod</span>
        </div>

        <div
          style={{ top: '50%', right: '6%', transform: 'rotate(6deg)' }}
          className="animate-float-4 absolute hidden md:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-amber-500/10"
        >
          <span className="text-2xl">🏆</span>
          <span className="text-xs font-black text-ink">{t('auth.topCreator')}</span>
        </div>

        <div
          style={{ top: '71%', right: '15%', transform: 'rotate(-10deg)' }}
          className="animate-float-3 absolute hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface/90 dark:bg-[#1a1c28]/90 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-xl shadow-blue-500/10"
        >
          <span className="text-xl">🔒</span>
          <span className="text-xs font-black text-ink">{t('auth.encrypted')}</span>
        </div>

        <div
          style={{ top: '85%', right: '8%', transform: 'rotate(16deg)' }}
          className="animate-float-slow absolute hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 dark:bg-[#1a1c28]/85 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-lg shadow-black/5"
        >
          <span className="text-xl">🔥</span>
          <span className="text-xs font-bold text-ink">{t('auth.trending')}</span>
        </div>

        {/* --- Floating Micro Stickers --- */}
        <div
          style={{ top: '6%', left: '38%', transform: 'rotate(-18deg)' }}
          className="animate-float-1 absolute hidden xl:flex items-center justify-center w-11 h-11 rounded-2xl bg-surface/80 dark:bg-[#1a1c28]/80 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-md text-xl"
        >
          ⭐
        </div>

        <div
          style={{ top: '7%', right: '35%', transform: 'rotate(17deg)' }}
          className="animate-float-3 absolute hidden xl:flex items-center justify-center w-11 h-11 rounded-2xl bg-surface/80 dark:bg-[#1a1c28]/80 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-md text-xl"
        >
          💖
        </div>

        <div
          style={{ bottom: '7%', left: '35%', transform: 'rotate(11deg)' }}
          className="animate-float-2 absolute hidden xl:flex items-center justify-center w-11 h-11 rounded-2xl bg-surface/80 dark:bg-[#1a1c28]/80 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-md text-xl"
        >
          ☕
        </div>

        <div
          style={{ bottom: '6%', right: '37%', transform: 'rotate(-16deg)' }}
          className="animate-float-4 absolute hidden xl:flex items-center justify-center w-11 h-11 rounded-2xl bg-surface/80 dark:bg-[#1a1c28]/80 backdrop-blur-md border-2 border-white dark:border-white/15 shadow-md text-xl"
        >
          🚀
        </div>
      </div>

      {/* Main Form/Success Card in Center */}
      <div className="relative z-10 w-full max-w-md mx-auto bg-surface/90 dark:bg-[#14151c]/90 backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-[2.5rem] p-7 sm:p-9 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-center transition-all select-text">
        {success ? (
          <div className="py-2 animate-in fade-in zoom-in-95 duration-300">
            {/* ✨ Multi-layer Glowing Animated Checkmark Badge */}
            <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 blur-xl animate-pulse" />
              <div className="absolute inset-1 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 ring-8 ring-emerald-500/15 dark:ring-emerald-400/10" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-300 text-white shadow-xl shadow-emerald-500/35 border-2 border-white/50 dark:border-white/20">
                <Check size={32} strokeWidth={3.5} className="text-white drop-shadow-md animate-in zoom-in-75 duration-300" />
              </div>
              <div className="absolute -top-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-surface border border-line-soft shadow-md text-amber-400 animate-bounce">
                <Sparkles size={14} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-ink mb-2">{t('auth.passwordResetSuccessTitle')}</h2>
            <p className="text-sm text-muted leading-relaxed mb-7 px-1">
              {t('auth.passwordResetSuccessDesc')}
            </p>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-brand to-brand-accent hover:brightness-110 text-canvas rounded-2xl px-5 py-3.5 font-black text-sm shadow-md shadow-brand/25 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span>{t('auth.goToLoginNow')}</span>
              <ArrowLeft size={16} className="rotate-180" />
            </Link>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold text-brand bg-brand/10 border border-brand/20 mb-3 select-none">
                <KeyRound size={12} />
                <span>{t('auth.newPasswordBadge')}</span>
              </div>
              <h1 className="text-2xl font-black text-ink mb-2">{t('auth.resetPasswordTitle')}</h1>
              <p className="text-sm text-muted">
                {t('auth.resetPasswordSubtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-line-soft text-ink rounded-2xl pl-10 pr-12 py-3.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-line-soft text-ink rounded-2xl pl-10 pr-12 py-3.5 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted transition-all"
                    required
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-sm font-bold text-status-error bg-status-error/10 px-3.5 py-2.5 rounded-xl border border-status-error/20">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-accent hover:brightness-110 text-canvas rounded-2xl px-4 py-3.5 font-black text-sm shadow-md shadow-brand/25 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : t('auth.confirmResetButton')}
              </button>

              <div className="text-center pt-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline transition-colors"
                >
                  <ArrowLeft size={16} /> {t('auth.backToLogin')}
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
