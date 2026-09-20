import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, ExternalLink, HeartHandshake, RotateCcw, Share2, Swords, Trophy, Zap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRanking } from '../lib/api';
import { challengePath, challengeUrl, shareUrl } from '../lib/share';
import TierLabel from '../components/tier/TierLabel';
import ShareExportModal from '../components/ui/ShareExportModal';
import ChallengeResultCard from '../components/challenge/ChallengeResultCard';

function rankingItems(ranking) {
  const tierDefinitions = Array.isArray(ranking?.tiers) ? ranking.tiers : [];
  const tierByLabel = new Map(tierDefinitions.map((tier, index) => [String(tier.label), { ...tier, index }]));
  const fallbackLabels = [];

  const items = new Map();
  (ranking?.ranking_items || []).forEach((rankingItem) => {
    // Legacy rows can contain unranked items (tier = NULL). They were never
    // part of the published tier result, so they must not affect match score.
    if (!rankingItem.tier) return;
    const label = String(rankingItem.tier || '');
    if (!tierByLabel.has(label) && !fallbackLabels.includes(label)) fallbackLabels.push(label);
    const fallbackIndex = tierDefinitions.length + fallbackLabels.indexOf(label);
    const definition = tierByLabel.get(label);
    const key = String(rankingItem.item_id || rankingItem.item?.id || rankingItem.item?.name || rankingItem.id);
    items.set(key, {
      key,
      name: rankingItem.item?.name || rankingItem.item_id,
      imageUrl: rankingItem.item?.image_url || null,
      tier: label,
      color: definition?.color,
      index: definition?.index ?? fallbackIndex,
    });
  });

  return items;
}

function scoreTone(score) {
  if (score >= 80) return 'challenge.sameWave';
  if (score >= 50) return 'challenge.closeCall';
  return 'challenge.hotDebate';
}

export default function ChallengeCompare() {
  const { sourceId, responseId } = useParams();
  const { t } = useTranslation();
  const [source, setSource] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([fetchRanking(sourceId), fetchRanking(responseId)]).then(([sourceResult, responseResult]) => {
      if (cancelled) return;
      const sourceRanking = sourceResult.data;
      const responseRanking = responseResult.data;
      if (!sourceRanking || !responseRanking) {
        setError(t('challenge.compareNotFound'));
      } else if (!sourceRanking.template_id || sourceRanking.template_id !== responseRanking.template_id) {
        setError(t('challenge.templateMismatch'));
      } else {
        setSource(sourceRanking);
        setResponse(responseRanking);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [sourceId, responseId, t]);

  const comparison = useMemo(() => {
    if (!source || !response) return null;
    const sourceItems = rankingItems(source);
    const responseItems = rankingItems(response);
    const rows = [...sourceItems.values()]
      .filter((item) => responseItems.has(item.key))
      .map((sourceItem) => {
        const responseItem = responseItems.get(sourceItem.key);
        return {
          key: sourceItem.key,
          name: sourceItem.name || responseItem.name,
          imageUrl: sourceItem.imageUrl || responseItem.imageUrl,
          source: sourceItem,
          response: responseItem,
          same: sourceItem.tier === responseItem.tier,
          distance: Math.abs(sourceItem.index - responseItem.index),
        };
      });
    const matches = rows.filter((row) => row.same).length;
    const score = rows.length ? Math.round((matches / rows.length) * 100) : 0;
    rows.sort((a, b) => b.distance - a.distance || Number(a.same) - Number(b.same) || a.name.localeCompare(b.name));
    const maxDistance = rows[0]?.distance || 0;
    const biggestDisagreements = maxDistance > 0
      ? rows.filter((row) => row.distance === maxDistance).slice(0, 3)
      : [];
    const sharedTop = rows.filter((row) => row.source.index === 0 && row.response.index === 0);
    const kindness = (side, tierCount) => {
      if (!rows.length) return 0;
      const divisor = Math.max(1, tierCount - 1);
      const total = rows.reduce((sum, row) => sum + (1 - Math.min(row[side].index, divisor) / divisor) * 100, 0);
      return Math.round(total / rows.length);
    };
    const sourceKindness = kindness('source', source.tiers?.length || 0);
    const responseKindness = kindness('response', response.tiers?.length || 0);
    return {
      rows,
      matches,
      score,
      disagreements: rows.length - matches,
      maxDistance,
      biggestDisagreements,
      sharedTop,
      sourceKindness,
      responseKindness,
      generosityDelta: responseKindness - sourceKindness,
    };
  }, [source, response]);

  if (loading) {
    return <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4"><p className="animate-pulse text-muted">{t('challenge.comparing')}</p></main>;
  }

  if (error || !comparison) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-line-soft bg-surface p-8 shadow-sm">
          <Swords className="mx-auto text-muted" size={36} />
          <h1 className="mt-4 text-xl font-black text-ink">{t('challenge.compareUnavailable')}</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link to="/" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-canvas">{t('common.backHome')}</Link>
        </div>
      </main>
    );
  }

  const sourceName = source.profile?.username || t('common.unknownUser');
  const responseName = response.profile?.username || t('common.unknownUser');
  const nextChallengePath = challengePath(response.template_id, response.id);
  const generosityText = Math.abs(comparison.generosityDelta) < 2
    ? t('challenge.sameKindness')
    : comparison.generosityDelta > 0
      ? t('challenge.kinderResult', { name: responseName, other: sourceName, percent: Math.abs(comparison.generosityDelta) })
      : t('challenge.kinderResult', { name: sourceName, other: responseName, percent: Math.abs(comparison.generosityDelta) });
  const cardComparison = { ...comparison, generosityText };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <Link to={`/post/${response.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink">
        <ArrowLeft size={17} /> {t('challenge.backToPost')}
      </Link>

      <section className="mt-4 overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-md">
        <div className="bg-[radial-gradient(circle_at_top,var(--color-highlight),transparent_65%)] px-5 py-8 text-center sm:px-8 sm:py-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-highlight text-canvas shadow-lg">
            <Swords size={28} strokeWidth={2.5} />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-muted">{t('challenge.resultEyebrow')}</p>
          <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">{comparison.score}%</h1>
          <p className="mt-1 text-lg font-black text-ink">{t(scoreTone(comparison.score))}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {t('challenge.resultSummary', {
              source: sourceName,
              response: responseName,
              matches: comparison.matches,
              total: comparison.rows.length,
            })}
          </p>

          <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line-soft bg-canvas/70 p-3">
              <Check className="mx-auto text-status-success" size={20} />
              <p className="mt-1 text-2xl font-black text-ink">{comparison.matches}</p>
              <p className="text-xs font-bold text-muted">{t('challenge.sameTier')}</p>
            </div>
            <div className="rounded-2xl border border-line-soft bg-canvas/70 p-3">
              <Zap className="mx-auto text-highlight" size={20} />
              <p className="mt-1 text-2xl font-black text-ink">{comparison.disagreements}</p>
              <p className="text-xs font-bold text-muted">{t('challenge.differentTier')}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-line-soft p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-tag px-3 py-2 text-center text-xs font-black text-ink-soft sm:text-sm">
            <Link to={`/post/${source.id}`} className="truncate hover:text-ink">{sourceName}</Link>
            <Swords size={15} className="text-highlight" />
            <Link to={`/post/${response.id}`} className="truncate hover:text-ink">{responseName}</Link>
          </div>

          <section className="mt-4" aria-labelledby="challenge-insights-title">
            <h2 id="challenge-insights-title" className="text-sm font-black uppercase tracking-wider text-ink">{t('challenge.insightsTitle')}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line-soft bg-tag p-4">
                <Zap size={19} className="text-highlight" />
                <p className="mt-2 text-xs font-black uppercase tracking-wider text-muted">{t('challenge.biggestDifference')}</p>
                <p className="mt-1 text-sm font-black text-ink">
                  {comparison.biggestDisagreements.length
                    ? comparison.biggestDisagreements.map((item) => item.name).join(', ')
                    : t('challenge.noDifference')}
                </p>
                {comparison.maxDistance > 0 && <p className="mt-1 text-xs font-bold text-muted">{t('challenge.distanceSummary', { count: comparison.maxDistance })}</p>}
              </div>
              <div className="rounded-2xl border border-line-soft bg-tag p-4">
                <Trophy size={19} className="text-tier-s" />
                <p className="mt-2 text-xs font-black uppercase tracking-wider text-muted">{t('challenge.sharedTop')}</p>
                <p className="mt-1 text-sm font-black text-ink">
                  {comparison.sharedTop.length
                    ? comparison.sharedTop.map((item) => item.name).join(', ')
                    : t('challenge.noSharedTop')}
                </p>
                <p className="mt-1 text-xs font-bold text-muted">{t('challenge.sharedTopCount', { count: comparison.sharedTop.length })}</p>
              </div>
              <div className="rounded-2xl border border-line-soft bg-tag p-4">
                <HeartHandshake size={19} className="text-status-success" />
                <p className="mt-2 text-xs font-black uppercase tracking-wider text-muted">{t('challenge.generosity')}</p>
                <p className="mt-1 text-sm font-black text-ink">{generosityText}</p>
                <p className="mt-1 text-xs font-bold text-muted">{sourceName} {comparison.sourceKindness}% · {responseName} {comparison.responseKindness}%</p>
              </div>
            </div>
          </section>

          <div className="mt-3 space-y-2">
            {comparison.rows.map((row) => (
              <div key={row.key} className={`grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-2 rounded-xl border p-2 sm:grid-cols-[88px_minmax(0,1fr)_88px] sm:p-3 ${row.same ? 'border-status-success/25 bg-status-success/5' : 'border-line-soft bg-tag'}`}>
                <TierLabel label={row.source.tier} color={row.source.color} index={row.source.index} className="h-10 w-16 rounded-lg text-sm font-black sm:w-22" />
                <div className="min-w-0 text-center">
                  {row.imageUrl && (
                    <img
                      src={row.imageUrl}
                      alt=""
                      className="mx-auto mb-1 h-9 w-9 rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <p className="truncate text-xs font-bold text-ink sm:text-sm" title={row.name}>{row.name}</p>
                  <p className={`mt-0.5 text-[10px] font-bold ${row.same ? 'text-status-success' : 'text-muted'}`}>
                    {row.same ? t('challenge.agree') : t('challenge.tiersApart', { count: row.distance })}
                  </p>
                </div>
                <TierLabel label={row.response.tier} color={row.response.color} index={row.response.index} className="h-10 w-16 rounded-lg text-sm font-black sm:w-22" />
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link to={nextChallengePath} className="flex items-center justify-center gap-2 rounded-xl border border-line-soft bg-tag px-4 py-3 text-sm font-bold text-ink transition-colors hover:bg-surface-glass">
              <RotateCcw size={18} /> {t('challenge.rankAgain')}
            </Link>
            <button type="button" onClick={() => setModal('export')} className="flex items-center justify-center gap-2 rounded-xl border border-line-soft bg-tag px-4 py-3 text-sm font-bold text-ink transition-colors hover:bg-surface-glass">
              <Download size={18} /> {t('challenge.downloadCard')}
            </button>
            <button type="button" onClick={() => setModal('share')} className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-canvas shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
              <Share2 size={18} /> {t('challenge.shareResult')}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-center text-xs font-bold">
            <Link to={`/post/${source.id}`} className="inline-flex items-center justify-center gap-1 text-muted hover:text-ink">{t('challenge.sourcePost')} <ExternalLink size={12} /></Link>
            <Link to={`/post/${response.id}`} className="inline-flex items-center justify-center gap-1 text-muted hover:text-ink">{t('challenge.responsePost')} <ExternalLink size={12} /></Link>
          </div>
        </div>
      </section>

      <ShareExportModal
        open={modal !== null}
        mode={modal}
        onClose={() => setModal(null)}
        link={shareUrl(`/compare/${source.id}/${response.id}`)}
        challengeLink={challengeUrl(response.template_id, response.id)}
        preview={
          <ChallengeResultCard
            sourceName={sourceName}
            sourceAvatar={source.profile?.avatar_url}
            responseName={responseName}
            responseAvatar={response.profile?.avatar_url}
            title={response.title || source.title}
            comparison={cardComparison}
          />
        }
        filename={`challenge-${source.id}-${response.id}.png`}
      />
    </main>
  );
}
