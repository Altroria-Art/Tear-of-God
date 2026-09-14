import { Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Avatar from '../ui/Avatar';
import ShareQr from '../ui/ShareQr';

export default function ChallengeResultCard({
  sourceName,
  sourceAvatar,
  responseName,
  responseAvatar,
  title,
  comparison,
  theme = 'light',
  shareLink = null,
  shareFormat = 'square',
  shareCta = null,
  shareQrHint = null,
}) {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const biggestItems = comparison.biggestDisagreements.map((item) => item.name).join(', ');
  const sharedTopItems = comparison.sharedTop.map((item) => item.name).join(', ');
  const qrSize = shareFormat === 'story' ? 78 : shareFormat === 'landscape' ? 56 : 68;
  const cardAspect = shareFormat === 'story' ? 'min-h-[640px]' : shareFormat === 'landscape' ? 'min-h-[430px]' : 'aspect-square';

  return (
    <div className={`${cardAspect} w-full overflow-hidden p-7 sm:p-9 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-950'}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
            <Swords size={15} /> Tear of God Battle
          </span>
          <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>tearofgod.pages.dev</span>
        </div>

        <div className="mt-6 text-center">
          <p className={`text-xs font-black uppercase tracking-[0.22em] ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
            {t('challenge.resultCardEyebrow')}
          </p>
          <h2 className="mx-auto mt-2 line-clamp-2 max-w-lg text-2xl font-black leading-tight sm:text-3xl">{title}</h2>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 flex-col items-center">
            <Avatar name={sourceName} src={sourceAvatar} size="lg" />
            <p className="mt-2 max-w-full truncate text-sm font-black">{sourceName}</p>
          </div>
          <div className="text-center">
            <p className={`text-5xl font-black sm:text-6xl ${isDark ? 'text-amber-300' : 'text-indigo-700'}`}>{comparison.score}%</p>
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('challenge.resultEyebrow')}</p>
          </div>
          <div className="flex min-w-0 flex-col items-center">
            <Avatar name={responseName} src={responseAvatar} size="lg" />
            <p className="mt-2 max-w-full truncate text-sm font-black">{responseName}</p>
          </div>
        </div>

        <div className={`mt-6 grid grid-cols-2 gap-3 rounded-2xl p-4 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('challenge.biggestDifference')}</p>
            <p className="mt-1 line-clamp-3 text-sm font-black">{biggestItems || t('challenge.noDifference')}</p>
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('challenge.sharedTop')}</p>
            <p className="mt-1 line-clamp-3 text-sm font-black">{sharedTopItems || t('challenge.noSharedTop')}</p>
          </div>
          <div className="col-span-2 self-end border-t border-current/10 pt-3 text-center">
            <p className="text-sm font-black">{comparison.generosityText}</p>
          </div>
        </div>

        <div className={`mt-auto flex items-center justify-between gap-3 pt-5 ${shareLink ? `rounded-xl border p-3 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-100'}` : ''}`}>
          <p className={`min-w-0 text-sm font-black ${shareLink ? 'text-left' : 'text-center w-full'} ${isDark ? 'text-amber-300' : 'text-indigo-700'}`}>
            {shareCta || t('challenge.shareCardCta')}
            {shareLink && <span className={`mt-1 block text-[10px] font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{shareQrHint || t('shareExport.qrHint')}</span>}
          </p>
          {shareLink && <ShareQr value={shareLink} size={qrSize} />}
        </div>
      </div>
    </div>
  );
}
