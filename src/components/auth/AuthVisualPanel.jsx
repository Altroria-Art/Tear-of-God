import { useTranslation } from 'react-i18next';
import TierLabel from '../tier/TierLabel';
import TearMascot from '../ui/TearMascot';
import RipMark from '../ui/RipMark';

export default function AuthVisualPanel({ isRegister, onSwitchMode }) {
  const { t } = useTranslation();

  return (
    <div className={`
      hidden lg:flex flex-col items-center justify-center p-12
      absolute top-0 left-1/2 w-1/2 h-full z-20 overflow-hidden
      bg-hero-surface border-line-soft
      transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]
      ${isRegister ? '-translate-x-full border-r-2 border-r-hero-surface shadow-[5px_0_0_var(--color-pop-pink)]' : 'translate-x-0 border-l-2 border-l-hero-surface shadow-[-5px_0_0_var(--color-pop-pink)]'}
      motion-reduce:transition-none
    `}>
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      {/* Login Mode Content (encourage signup) */}
      <div 
        className={`
          absolute inset-0 flex flex-col justify-center items-center p-12 text-center
          transition-opacity duration-[400ms] ease-out
          ${isRegister ? 'opacity-0 pointer-events-none delay-0' : 'opacity-100 delay-200'}
          motion-reduce:transition-none
        `} 
        aria-hidden={isRegister ? "true" : undefined}
        inert={isRegister ? true : undefined}
      >
        <div className="flex flex-col items-center max-w-[280px]">
          <h2 className="text-3xl font-display font-black text-hero-ink uppercase tracking-tight leading-none mb-3">
            {t('auth.joinTheClub')}
          </h2>
          <RipMark className="h-4 w-24 text-acid mb-6" />
          
          <div className="auth-tear-scene w-full mb-5" aria-hidden="true">
            <TearMascot pose="welcome" />
            <div className="auth-tear-board">
              <div className="flex min-h-9 items-stretch gap-1 bg-hero-surface/50 p-1 mb-1 rounded-sm border border-white/5">
                <TierLabel label="S" color="bg-[#ff7f7f]" className="w-10 text-sm font-black" />
                <div className="flex flex-wrap items-center gap-1.5 px-2">
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleAnime')}</span>
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleMusic')}</span>
                </div>
              </div>
              <div className="flex min-h-9 items-stretch gap-1 bg-hero-surface/50 p-1 mb-1 rounded-sm border border-white/5">
                <TierLabel label="A" color="bg-[#ffbf7f]" className="w-10 text-sm font-black" />
                <div className="flex flex-wrap items-center gap-1.5 px-2">
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleGames')}</span>
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleFood')}</span>
                </div>
              </div>
              <div className="flex min-h-9 items-stretch gap-1 bg-hero-surface/50 p-1 rounded-sm border border-white/5">
                <TierLabel label="B" color="bg-[#ffff7f]" className="w-10 text-sm font-black" />
                <div className="flex flex-wrap items-center gap-1.5 px-2">
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleMovies')}</span>
                  <span className="bg-hero-ink/90 text-hero-surface px-2 py-0.5 text-xs font-bold rounded-sm">{t('auth.sampleCampus')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-hero-ink/80 font-medium mb-1">{t('auth.buildTierLists')}</p>
          <p className="text-sm text-hero-ink/80 font-medium mb-1">{t('auth.shareYourTakes')}</p>
          <p className="text-sm text-hero-ink/80 font-medium mb-8">{t('auth.seeWhereEveryoneStands')}</p>
          
          <button 
            type="button" 
            onClick={() => onSwitchMode(true)}
            className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-acid-ink bg-pop-pink border-2 border-pop-pink shadow-[3px_3px_0_var(--color-pop-violet)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wide text-sm w-full"
          >
            {t('auth.createAccountBtn')}
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </div>

      {/* Signup Mode Content (encourage login) */}
      <div 
        className={`
          absolute inset-0 flex flex-col justify-center items-center p-12 text-center
          transition-opacity duration-[400ms] ease-out
          ${!isRegister ? 'opacity-0 pointer-events-none delay-0' : 'opacity-100 delay-200'}
          motion-reduce:transition-none
        `} 
        aria-hidden={!isRegister ? "true" : undefined}
        inert={!isRegister ? true : undefined}
      >
        <div className="flex flex-col items-center max-w-[280px]">
          <h2 className="text-3xl font-display font-black text-hero-ink uppercase tracking-tight leading-none mb-3">
            {t('auth.alreadyRanking')}
          </h2>
          <RipMark className="h-4 w-24 text-pop-violet mb-6" />
          
          <div className="auth-tear-scene mb-5" aria-hidden="true">
            <TearMascot pose="welcome" />
            <div className="auth-tear-card">
              <TierLabel label="S" color="var(--color-pop-violet)" className="w-12 h-11 font-black" />
              <span>{t('auth.sampleMusic')}</span>
            </div>
          </div>
          <p className="text-base text-hero-ink/90 font-bold mb-8">{t('auth.yourListsWaiting')}</p>
          
          <button 
            type="button" 
            onClick={() => onSwitchMode(false)}
            className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-acid-ink bg-acid border-2 border-acid shadow-[3px_3px_0_var(--color-pop-violet)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wide text-sm w-full"
          >
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            {t('auth.backToLoginBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
