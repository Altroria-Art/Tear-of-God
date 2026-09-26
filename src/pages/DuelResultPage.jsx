import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Swords, ArrowLeft, User, Share2, Check, ExternalLink, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchDuel } from '../lib/api';
import Avatar from '../components/ui/Avatar';
import TierLabel from '../components/tier/TierLabel';
import { useToast } from '../components/ui/Toast';
import { timeAgo } from '../lib/format';
import { shareUrl } from '../lib/share';

export default function DuelResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [duel, setDuel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      const res = await fetchDuel(id);
      if (cancelled) return;
      if (res.success && res.data) {
        setDuel(res.data);
      } else {
        setError(res.error || t('common.error'));
      }
      setLoading(false);
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const handleShare = async () => {
    try {
      await shareUrl({
        title: `${duel?.challenger?.username} vs ${duel?.owner?.username} | ${duel?.template?.title}`,
        text: t('duel.tasteSummary', {
          score: duel?.similarity_score,
          name: duel?.owner?.username,
        }),
        url: window.location.href,
      });
      toast.success(t('common.copied'));
    } catch {
      // User cancelled or unsupported
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-highlight/15 text-highlight animate-pulse">
            <Swords size={24} />
          </div>
          <p className="text-sm font-medium text-muted animate-pulse">{t('duel.submitting')}</p>
        </div>
      </main>
    );
  }

  if (error || !duel) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-bold text-ink">{error || t('common.notFound')}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-glass"
        >
          <ArrowLeft size={16} />
          <span>{t('common.back')}</span>
        </button>
      </main>
    );
  }

  const { challenger, owner, template, comparison } = duel;
  const sameTierItems = (comparison?.details || []).filter((d) => d.isMatch);
  const diffTierItems = (comparison?.details || []).filter((d) => !d.isMatch);

  return (
    <main className="min-h-screen font-sans text-ink">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to={`/template/${encodeURIComponent(template.id)}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{t('duel.backToTemplate')}</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-full glass border border-line-soft px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink hover:bg-surface transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Share2 size={14} />
            <span>{t('common.share')}</span>
          </button>
        </div>

        {/* Hero Card: Taste Match Overview */}
        <section className="relative overflow-hidden rounded-3xl glass border border-line-soft/80 p-6 sm:p-10 shadow-xl text-center bg-surface/70 flex flex-col items-center gap-6">
          {/* Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-highlight/10 rounded-full blur-3xl pointer-events-none" />

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-highlight/15 text-highlight border border-highlight/30 text-xs font-black uppercase tracking-widest shadow-2xs">
            <Sparkles size={13} />
            <span>{t('duel.resultEyebrow')}</span>
          </div>

          {/* Users VS Header */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 w-full max-w-lg">
            {/* Challenger A */}
            <Link
              to={`/profile/${encodeURIComponent(challenger.id)}`}
              className="flex flex-col items-center gap-2 group cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="relative p-1 rounded-full ring-2 ring-brand/50 group-hover:ring-brand transition-all">
                <Avatar size="lg" name={challenger.username} src={challenger.avatar_url} />
              </div>
              <span className="text-sm sm:text-base font-bold text-ink group-hover:underline max-w-[120px] truncate">
                @{challenger.username}
              </span>
            </Link>

            {/* VS Badge */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black tracking-widest text-muted uppercase">VS</span>
              <div className="h-6 w-px bg-line-soft my-1" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-glass text-highlight border border-line-soft shadow-inner">
                <Swords size={16} />
              </div>
            </div>

            {/* Template Owner B */}
            <Link
              to={`/profile/${encodeURIComponent(owner.id)}`}
              className="flex flex-col items-center gap-2 group cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="relative p-1 rounded-full ring-2 ring-highlight/50 group-hover:ring-highlight transition-all">
                <Avatar size="lg" name={owner.username} src={owner.avatar_url} />
              </div>
              <span className="text-sm sm:text-base font-bold text-ink group-hover:underline max-w-[120px] truncate">
                @{owner.username}
              </span>
            </Link>
          </div>

          {/* Big Score Display */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="text-5xl sm:text-7xl font-black text-ink tracking-tight flex items-baseline justify-center gap-1">
              <span>{duel.similarity_score}</span>
              <span className="text-2xl sm:text-3xl text-highlight font-bold">%</span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-ink-soft max-w-md">
              {t('duel.tasteSummary', {
                score: duel.similarity_score,
                name: owner.username,
              })}
            </p>
            <p className="text-xs text-muted">
              {t('duel.duelTime', { time: timeAgo(duel.created_at) })}
            </p>
          </div>

          {/* Dual Stat Metrics: Owner Match vs Community Match */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-xl mt-4">
            {/* 1. vs Template Owner */}
            <div className="rounded-2xl border border-line-soft/80 bg-surface/80 p-4 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">
                {t('duel.duelWith', { name: owner.username })}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-ink">
                {duel.similarity_score}%
              </span>
              <span className="text-xs text-muted mt-1">
                {comparison?.matched_items} / {comparison?.total_items} {t('duel.sameTier')}
              </span>
            </div>

            {/* 2. vs Community Average */}
            <div className="rounded-2xl border border-line-soft/80 bg-surface/80 p-4 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Users size={14} className="text-brand-accent" />
                <span>{t('duel.communityMatch')}</span>
              </span>
              {duel.community_similarity_score !== null ? (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-brand-accent">
                    {duel.community_similarity_score}%
                  </span>
                  <span className="text-xs text-muted mt-1">
                    {t('duel.communitySamples', { count: duel.community_sample_count })}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center my-auto py-1">
                  <span className="text-xs text-muted italic">
                    {t('duel.notEnoughCommunity')}
                  </span>
                  <span className="text-[11px] text-muted/70 mt-0.5">
                    ({duel.community_sample_count} / 3 samples)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to={`/template/${encodeURIComponent(template.id)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-surface-glass border border-line-soft px-4 py-2 text-xs sm:text-sm font-bold text-ink hover:bg-surface transition-all active:scale-95"
            >
              <span>{t('duel.backToTemplate')}</span>
            </Link>
            <Link
              to={`/profile/${encodeURIComponent(challenger.id)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand text-canvas px-4 py-2 text-xs sm:text-sm font-bold hover:bg-brand-accent transition-all active:scale-95"
            >
              <User size={15} />
              <span>{t('duel.goToProfile')}</span>
            </Link>
          </div>
        </section>

        {/* Template Context Banner */}
        <section className="rounded-2xl glass border border-line-soft p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              {t('template.title')}
            </span>
            <h2 className="text-lg font-bold text-ink truncate">{template.title}</h2>
          </div>
          <Link
            to={`/template/${encodeURIComponent(template.id)}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-highlight hover:underline shrink-0"
          >
            <span>{t('template.viewDetails')}</span>
            <ExternalLink size={13} />
          </Link>
        </section>

        {/* Item-by-Item Breakdown */}
        {comparison?.details && comparison.details.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-bold text-ink">
                {t('duel.breakdown')}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted font-medium">
                <span className="flex items-center gap-1">
                  <Check size={14} className="text-emerald-500" />
                  {sameTierItems.length} {t('duel.sameTier')}
                </span>
                <span>·</span>
                <span>{diffTierItems.length} {t('duel.diffTier')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {comparison.details.map((item) => (
                <div
                  key={item.itemId}
                  className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                    item.isMatch
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-surface/50 border-line-soft'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.itemName}
                        className="h-10 w-10 shrink-0 rounded-xl object-cover border border-line-soft"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface border border-line-soft text-xs font-bold text-muted">
                        {item.itemName.slice(0, 2)}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-ink truncate">
                      {item.itemName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Challenger A Placement */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-muted uppercase">You</span>
                      {item.tierA ? (
                        <TierLabel label={item.tierA} color={item.tierColorA} className="text-xs px-2 py-0.5 rounded-md" />
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </div>

                    <span className="text-xs text-muted/60">vs</span>

                    {/* Owner B Placement */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-muted uppercase">@{owner.username.slice(0, 6)}</span>
                      {item.tierB ? (
                        <TierLabel label={item.tierB} color={item.tierColorB} className="text-xs px-2 py-0.5 rounded-md" />
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
