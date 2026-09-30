import { useTranslation } from 'react-i18next';
import TierLabel from '../tier/TierLabel';
import RipMark from '../ui/RipMark';

export default function AuthVisualPanel({ isRegister, onSwitchMode }) {
  const { t } = useTranslation();

  return (
    <div className={`
      hidden lg:flex flex-col items-center justify-center p-12
      absolute top-0 left-1/2 w-1/2 h-full z-20 overflow-hidden
      bg-ink border-line-soft
      transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]
      ${isRegister ? '-translate-x-full border-r-2 border-r-ink shadow-[5px_0_0_var(--color-pop-pink)]' : 'translate-x-0 border-l-2 border-l-ink shadow-[-5px_0_0_var(--color-pop-pink)]'}
      motion-reduce:transition-none
    `}>
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      {/* Login Mode Content (encourage signup) */}
      <div className={`
        absolute inset-0 flex flex-col justify-center items-center p-12 text-center
        transition-opacity duration-[400ms] ease-out
        ${isRegister ? 'opacity-0 pointer-events-none delay-0' : 'opacity-100 delay-200'}
        motion-reduce:transition-none
      `} aria-hidden={isRegister}>
        <div className="flex flex-col items-center max-w-[280px]">
          <h2 className="text-3xl font-display font-black text-canvas uppercase tracking-tight leading-none mb-3">
            {t('auth.joinTheClub')}
          </h2>
          <RipMark className="h-4 w-24 text-acid-green mb-6" />
          
          <div className="w-full bg-surface/10 rounded-xl p-4 mb-8 border border-white/10 shadow-lg" aria-hidden="true">
            <div className="flex min-h-9 items-stretch gap-1 bg-ink/50 p-1 mb-1 rounded-sm border border-white/5">
              <TierLabel label="S" color="bg-[#ff7f7f]" className="w-10 text-sm font-black" />
              <div className="flex flex-wrap items-center gap-1.5 px-2">
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Anime</span>
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Music</span>
              </div>
            </div>
            <div className="flex min-h-9 items-stretch gap-1 bg-ink/50 p-1 mb-1 rounded-sm border border-white/5">
              <TierLabel label="A" color="bg-[#ffbf7f]" className="w-10 text-sm font-black" />
              <div className="flex flex-wrap items-center gap-1.5 px-2">
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Games</span>
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Food</span>
              </div>
            </div>
            <div className="flex min-h-9 items-stretch gap-1 bg-ink/50 p-1 rounded-sm border border-white/5">
              <TierLabel label="B" color="bg-[#ffff7f]" className="w-10 text-sm font-black" />
              <div className="flex flex-wrap items-center gap-1.5 px-2">
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Movies</span>
                <span className="bg-canvas/90 text-ink px-2 py-0.5 text-xs font-bold rounded-sm">Campus</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-canvas/80 font-medium mb-1">{t('auth.buildTierLists')}</p>
          <p className="text-sm text-canvas/80 font-medium mb-1">{t('auth.shareYourTakes')}</p>
          <p className="text-sm text-canvas/80 font-medium mb-8">{t('auth.seeWhereEveryoneStands')}</p>
          
          <button 
            type="button" 
            onClick={() => onSwitchMode(true)}
            className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-ink bg-pop-pink border-2 border-pop-pink shadow-[3px_3px_0_var(--color-pop-violet)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wide text-sm w-full"
          >
            {t('auth.createAccountBtn')}
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </div>

      {/* Signup Mode Content (encourage login) */}
      <div className={`
        absolute inset-0 flex flex-col justify-center items-center p-12 text-center
        transition-opacity duration-[400ms] ease-out
        ${!isRegister ? 'opacity-0 pointer-events-none delay-0' : 'opacity-100 delay-200'}
        motion-reduce:transition-none
      `} aria-hidden={!isRegister}>
        <div className="flex flex-col items-center max-w-[280px]">
          <h2 className="text-3xl font-display font-black text-canvas uppercase tracking-tight leading-none mb-3">
            {t('auth.alreadyRanking')}
          </h2>
          <RipMark className="h-4 w-24 text-pop-violet mb-6" />
          
          <p className="text-base text-canvas/90 font-bold mb-8">{t('auth.yourListsWaiting')}</p>
          
          <button 
            type="button" 
            onClick={() => onSwitchMode(false)}
            className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-ink bg-acid-green border-2 border-acid-green shadow-[3px_3px_0_var(--color-pop-violet)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wide text-sm w-full"
          >
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            {t('auth.backToLoginBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
