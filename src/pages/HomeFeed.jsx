import TearMascot from '../components/ui/TearMascot';
import TierLoader from '../components/ui/TierLoader';
import HomeShowcase from '../components/ui/HomeShowcase';
import PlayHeader from '../components/ui/PlayHeader';
import TierRow from '../components/feed/TierRow';
import { buildTierRows } from '../lib/tiers';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, fetchSocialState, voteRanking } from '../lib/api';
import useLiveRefresh from '../lib/useLiveRefresh';
import { trackEvent } from '../lib/analytics';
import { ThumbsUp, ThumbsDown, MessageSquare, Copy, Share2, Download, Flame, Heart, Users, ListOrdered, BarChart3, Check, RotateCcw, Plus, Search, ArrowUpRight } from 'lucide-react';



import BookmarkButton from '../components/template/BookmarkButton';
import UserFollowButton from '../components/user/UserFollowButton';

import { formatCount, timeAgo, shortTimeAgo } from '../lib/format';
import { takeLastPublished } from '../lib/lastPublished';
import {
  loadTrendingSeen,
  persistTrendingSeen,
  pruneTrendingSeen,
  TRENDING_SEEN_EXCLUDE_MAX,
  filterUnseenTrending,
  fetchUnseenTrendingPage,
  trendingSeenExclude,
  trendingSeenFallback,
} from '../lib/trendingSeen';
import VirtualFeedContainer from '../components/feed/VirtualFeedContainer';
import { createPendingGuard } from '../lib/pendingGuard';
import GuestAuthPrompt from '../components/auth/GuestAuthPrompt';
import { useTranslation } from 'react-i18next';

// buildTierRows() now lives in src/lib/tiers.js — shared with PostDetail.jsx
// so Feed/Feed Detailed order and color tiers the same way Discover Detailed
// does, and no longer coerce unranked (tier=NULL) items into a fake "S" row.
// See docs/tier-list-feed-debug-plan.md.



import { useToast } from '../components/ui/Toast';

// 📍 [ลบ mockKindredData ทิ้งไปเรียบร้อย บอทจะไม่มากวนใจอีก!]

const PAGE_SIZE = 12
const FEED_TABS = [
  { id: 'trending', labelKey: 'feed.trending', Icon: Flame },
  { id: 'for_you', labelKey: 'feed.forYou', Icon: Heart },
  { id: 'following', labelKey: 'feed.following', Icon: Users },
]

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0, initialUserVote = null, onShare, onExport, onRequireAuth, onVoteChange }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();

  // seed จาก post.user_vote ที่ API ส่งมาเท่านั้น — ห้าม useState(null) เฉยๆ
  // (ดู docs/feature-like-dislike-voting.md §8)
  const [userVote, setUserVote] = useState(initialUserVote);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  // M4-C1: guard per-card (component นี้มี 1 instance ต่อ 1 ranking จึง per-resource
  // โดยธรรมชาติ) — กดซ้ำระหว่าง pending ไม่ยิง request ใหม่ การ์ดอื่นยังกดได้ปกติ,
  // resolve/reject แล้วกดใหม่ได้
  const voteGuardRef = useRef(null);
  if (!voteGuardRef.current) voteGuardRef.current = createPendingGuard();

  useEffect(() => {
    if (voteGuardRef.current.isPending(id)) return;
    setUserVote(initialUserVote);
    setLikes(initialLikes);
    setDislikes(initialDislikes);
  }, [id, initialUserVote, initialLikes, initialDislikes]);

  // state machine เดียวรับทั้ง like/dislike: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action
  // M4-C1: acquire ก่อน optimistic mutation ใดๆ — คลิกที่ถูก block จะไม่มีทั้ง request,
  // optimistic toggle และ rollback side effect ใดๆ
  const handleVote = async (type) => {
    if (!currentUser) {
      if (onRequireAuth) {
        onRequireAuth(`/post/${id}`);
      } else {
        toast.warning(t('feed.voteLogin'));
        navigate('/login');
      }
      return;
    }
    if (!voteGuardRef.current.acquire(id)) return;

    const nextVote = userVote === type ? null : type;
    const prevVote = userVote;
    const prevLikes = likes;
    const prevDislikes = dislikes;

    let optimisticLikes = prevLikes;
    let optimisticDislikes = prevDislikes;
    if (prevVote === 'like') optimisticLikes = Math.max(0, optimisticLikes - 1);
    if (prevVote === 'dislike') optimisticDislikes = Math.max(0, optimisticDislikes - 1);
    if (nextVote === 'like') optimisticLikes += 1;
    if (nextVote === 'dislike') optimisticDislikes += 1;

    setUserVote(nextVote);
    setLikes(optimisticLikes);
    setDislikes(optimisticDislikes);

    try {
      const result = await voteRanking({ rankingId: id, userId: currentUser.id, voteType: nextVote });

      if (result.success !== false) {
        setUserVote(result.userVote ?? null);
        setLikes(result.likes ?? optimisticLikes);
        setDislikes(result.dislikes ?? optimisticDislikes);
        onVoteChange?.(id, { user_vote: result.userVote ?? null, likes: result.likes ?? optimisticLikes, dislikes: result.dislikes ?? optimisticDislikes });
      } else {
        setUserVote(prevVote);
        setLikes(prevLikes);
        setDislikes(prevDislikes);
        toast.error(t('feed.voteFailed', { msg: result.error || t('common.error') }));
      }
    } finally {
      voteGuardRef.current.release(id);
    }
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-line-soft">
      <div className="flex items-center gap-4 sm:gap-6">
        <button type="button" aria-label={t('post.like')} aria-pressed={userVote === 'like'} onClick={() => handleVote('like')} className={`flex min-h-11 items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'like' ? 'text-vote-up' : 'text-muted hover:text-ink'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </button>

        <button type="button" aria-label={t('post.dislike')} aria-pressed={userVote === 'dislike'} onClick={() => handleVote('dislike')} className={`flex min-h-11 items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'dislike' ? 'text-vote-down' : 'text-muted hover:text-ink'}`}>
          <ThumbsDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{dislikes}</span>
        </button>

        <button type="button" data-auth-next={`/post/${id}#comments`} aria-label={t('post.comments')} onClick={() => navigate(`/post/${id}#comments`)} className="flex min-h-11 items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <MessageSquare size={18} />
          <span className="text-[13px] font-bold">{initialComments}</span>
        </button>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" aria-label={t('common.export')} onClick={onExport} className="flex min-h-11 items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Download size={18} />
          <span className="hidden text-[13px] font-bold sm:inline">{t('common.export')}</span>
        </button>
        <button type="button" aria-label={t('common.share')} onClick={onShare} className="flex min-h-11 items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Share2 size={18} />
          <span className="hidden text-[13px] font-bold sm:inline">{t('common.share')}</span>
        </button>
      </div>
    </div>
  );
}

function HomeTierCard({ post, onRequireAuth, onVoteChange, featured = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  // Full placements are loaded by Post Detail, including explicit export/share.
  const openExport = (mode = 'export') => navigate('/post/' + encodeURIComponent(post.id), { state: { feedAction: mode } });

  const hashtags = post.hashtags ? post.hashtags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const builtRows = buildTierRows(post.ranking_items, post.tiers);
  // ranking ที่ไม่มีไอเทมถูกจัดเลย (เคสหายาก) — โชว์การ์ดเปล่า 2 แถวเหมือนพฤติกรรมเดิม
  // แทนไม่มีอะไรให้ดูเลย
  const tierRows = builtRows.length > 0 ? builtRows : [
    { tier: 'S', color: undefined, index: 0, items: [] },
    { tier: 'A', color: undefined, index: 1, items: [] },
  ];
  const totalItems = tierRows.reduce((sum, row) => sum + row.items.length, 0);
  const mobileRows = mobileExpanded ? tierRows : tierRows.slice(0, 3);
  const hasMobileOverflow = post.preview || tierRows.length > 3 || tierRows.some((row) => row.items.length > 4);
  const templateUses = Number(post.stats?.templateUses) || 0;
  const rawDisagreement = post.stats?.communityDisagreement;
  const disagreementValue = rawDisagreement !== null && rawDisagreement !== undefined && rawDisagreement !== '' && Number.isFinite(Number(rawDisagreement))
    ? Math.max(0, Math.min(100, Number(rawDisagreement)))
    : null;
  const disagreementLabel = disagreementValue >= 55
    ? t('feed.disagreementHigh')
    : disagreementValue >= 30
      ? t('feed.disagreementMedium')
      : t('feed.disagreementLow');

  const renderTierRow = (row, compact = false, itemLimit = null) => (
    <TierRow
      key={row.tier}
      tier={row.tier}
      color={row.color}
      index={row.index}
      compact={compact}
      itemLimit={itemLimit}
      items={row.items.map((ri) => ({
        id: ri.id,
        name: ri.item?.name || ri.item_id,
        image_url: ri.item?.image_url,
      }))}
    />
  );

  const renderActions = () => (
    <>
      <BookmarkButton
        template={{ id: post.template_id, is_saved: post.is_template_saved }}
        onRequireAuth={onRequireAuth}
        className="flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-xs hover:bg-surface hover:text-ink hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
      />
      <button
        onClick={() => navigate(`/rank?template=${encodeURIComponent(post.template_id)}`)}
        disabled={!post.template_id}
        title={t('feed.useTemplate', { title: post.title })}
        className="play-button px-3 py-1.5 text-xs disabled:opacity-40"
      >
        <Copy size={12} strokeWidth={2.5} />
        <span>{t('feed.useTemplateShort')}</span>
      </button>
    </>
  );

  return (
    <article data-social-ranking={post.id} className={`social-card bg-surface border border-line-soft rounded-[20px] p-4 sm:p-6 shadow-sm ${featured ? 'feed-card--featured' : ''}`}>
      {/* Header Profile & Use Template Button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="flex shrink-0 flex-col items-center">
            {post.user_id ? (
              <Link
                to={`/profile/${encodeURIComponent(post.user_id)}`}
                data-auth-next={`/profile/${post.user_id}`}
                className="w-10 h-10 rounded-full overflow-hidden bg-surface-glass border border-line-soft cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {post.profile?.avatar_url ? (
                  <img src={post.profile.avatar_url} alt={t('feed.avatarAlt')} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-muted">
                    {post.profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </Link>
            ) : (
              <div
                className="w-10 h-10 rounded-full overflow-hidden bg-surface-glass border border-line-soft"
              >
                {post.profile?.avatar_url ? (
                  <img src={post.profile.avatar_url} alt={t('feed.avatarAlt')} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-muted">
                    {post.profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            )}
            <div className="sm:hidden -mt-2.5">
              <UserFollowButton
                compact
                targetUserId={post.user_id}
                initialIsFollowing={post.profile?.is_following}
                onRequireAuth={onRequireAuth}
                ariaLabel={post.profile?.username}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-x-1.5 sm:gap-x-2">
              {post.user_id ? (
                <Link
                  to={`/profile/${encodeURIComponent(post.user_id)}`}
                  data-auth-next={`/profile/${post.user_id}`}
                  className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink leading-tight cursor-pointer hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.profile?.username || t('common.unknownUser')}
                </Link>
              ) : (
                <h3
                  className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink leading-tight"
                >
                  {post.profile?.username || t('common.unknownUser')}
                </h3>
              )}
              <div className="hidden sm:inline-flex">
                <UserFollowButton
                  targetUserId={post.user_id}
                  initialIsFollowing={post.profile?.is_following}
                  onRequireAuth={onRequireAuth}
                  className="shrink-0"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                {renderActions()}
              </div>
            </div>
            <div
              data-auth-next={`/post/${post.id}`}
              className="mt-0 text-[13px] text-muted font-medium cursor-pointer sm:hidden"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {shortTimeAgo(post.created_at)}
            </div>
            <p
              data-auth-next={`/post/${post.id}`}
              className="mt-1 hidden sm:block text-[13px] text-muted font-medium cursor-pointer"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {timeAgo(post.created_at)}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center justify-end gap-1.5 sm:shrink-0">
          {renderActions()}
        </div>
      </div>

      {/* Hashtags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {hashtags.slice(0, 4).map((tag, idx) => {
          const cleanTag = tag.trim().replace('#', '');
          return (
            <span
              key={idx}
              data-auth-next={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
              onClick={(e) => { e.stopPropagation(); navigate(`/discover/hashtag/${encodeURIComponent(cleanTag)}`); }}
              className={`px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:border-line hover:shadow-sm transition-all items-center ${idx >= 2 ? 'hidden sm:flex' : 'flex'}`}
            >
              <span className="text-highlight mr-[2px]">#</span>
              {cleanTag}
            </span>
          );
        })}
      </div>

      {/* Title */}
      <p className="mb-1 text-xs text-muted">{t('template.ownerRanking', { name: post.profile?.username || t('common.unknownUser') })}</p>
      <h2
        data-auth-next={`/post/${post.id}`}
        onClick={() => navigate(`/post/${post.id}`)}
        className="text-lg sm:text-xl font-extrabold mb-3 sm:mb-5 text-ink cursor-pointer hover:text-highlight transition-colors"
      >
        {post.title}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label={t('feed.featuredStats')}>
        {post.template_id && templateUses > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-2.5 py-1 text-[11px] font-bold text-ink-soft">
            <ListOrdered size={13} className="text-brand" />
            {t('feed.rankedBy', { count: formatCount(templateUses) })}
          </span>
        )}
        {disagreementValue !== null && (
          <span
            className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ' + (
              disagreementValue >= 55
                ? 'border-highlight/40 bg-highlight/10 text-highlight'
                : 'border-line-soft bg-surface-glass text-ink-soft'
            )}
            title={t('feed.disagreementHelp')}
          >
            <BarChart3 size={13} />
            {disagreementLabel} · {disagreementValue}%
          </span>
        )}
      </div>

      <div
        className="mb-4 sm:hidden cursor-pointer"
        onClick={() => navigate(`/post/${post.id}`)}
      >
        <div className="space-y-1.5">
          {mobileRows.map((row) => renderTierRow(row, true, mobileExpanded ? null : 4))}
        </div>
        {hasMobileOverflow && (
          <button
            type="button"
            aria-expanded={mobileExpanded}
            onClick={(e) => { e.stopPropagation(); if (post.preview) navigate(`/post/${post.id}`); else setMobileExpanded((expanded) => !expanded); }}
            className="mt-2.5 min-h-11 w-full rounded-xl border border-line-soft bg-surface-glass px-4 py-2.5 text-xs font-bold text-ink-soft transition-colors hover:bg-tag hover:text-ink"
          >
            {post.preview ? t('feed.openFullRanking') : mobileExpanded
              ? t('feed.showLess')
              : t('feed.showFullRanking', { tiers: tierRows.length, items: totalItems })}
          </button>
        )}
      </div>

      <div
        className="hidden space-y-1.5 mb-4 sm:block cursor-pointer"
        onClick={() => navigate(`/post/${post.id}`)}
      >
        {tierRows.map((row) => renderTierRow(row))}
        {post.preview && <p className="py-2 text-center text-xs font-bold text-brand">{t('feed.openFullRanking')}</p>}
      </div>

      {/* Action Bar */}
      <FeedCardActionBar
        id={post.id}
        initialLikes={post.stats?.likes || 0}
        initialDislikes={post.stats?.dislikes || 0}
        initialComments={post.stats?.comments || 0}
        initialUserVote={post.user_vote ?? null}
        onShare={() => openExport('share')}
        onExport={() => openExport('export')}
        onVoteChange={onVoteChange}
        onRequireAuth={onRequireAuth}
      />

    </article>
  );
}


function SeenCardObserver({ postId, onSeen, children }) {
  const nodeRef = useRef(null);
  useEffect(() => {
    if (!nodeRef.current || typeof IntersectionObserver === 'undefined') return;
    let timer = null;
    let visible = false;
    let marked = false;
    const updateTimer = () => {
      clearTimeout(timer);
      timer = null;
      if (visible && !document.hidden && !marked) {
        timer = setTimeout(() => {
          marked = true;
          onSeen(postId);
          observer.disconnect();
        }, 701);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const nextVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (nextVisible !== visible) {
          visible = nextVisible;
          updateTimer();
        }
      }
    }, { threshold: [0, 0.5] });
    observer.observe(nodeRef.current);
    document.addEventListener('visibilitychange', updateTimer);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateTimer);
    };
  }, [postId, onSeen]);

  return <div ref={nodeRef}>{children}</div>;
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const [postsKey, setPostsKey] = useState(null);
  const [trendingError, setTrendingError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true); // หน้าแรกเท่านั้น — กันจอกระพริบตอน append หน้าถัดไป
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const inFlightRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;
  const [activeTab, setActiveTab] = useState('trending');
  const [guestPrompt, setGuestPrompt] = useState({ open: false, next: '/' });
  const [showTabNav, setShowTabNav] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Cache each feed+viewer separately, including pages loaded by infinite scroll.
  const cacheKey = `${activeTab}:${currentUser?.id ?? 'anon'}`;

  // The backend gives each mode distinct semantics: engagement+freshness, interest
  // matching, or authors followed by the signed-in viewer.
  const feedType = activeTab;
  const feedLocked = activeTab === 'following' && !currentUser;

  const lastScrollYRef = useRef(0);
  const loadingRef = useRef(false); // กันยิงซ้ำตอนเลื่อนเร็วๆ หรือ observer ยิงซ้อนตอนกำลังโหลดอยู่
  const cursorRef = useRef(null);
  const pageRef = useRef(1); // หน้าล่าสุดที่ fetch ไป — loadMore อ่านที่นี่ ไม่ใช่ closure `page` ที่ค้าง
  const feedCacheRef = useRef({});
  const resolvedFeedTypeRef = useRef(feedType);
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  // 📍 [ใหม่]: ranking ที่เพิ่ง publish ของฉัน — ขึ้นการ์ดแรกหน้า Home แค่ mount แรกหลัง publish
  // (ได้จาก src/lib/lastPublished.js; F5/เข้าหน้าใหม่ = module reset → null → สับสุ่มตามเดิม)
  // ส่ง pin ต่อทุกหน้า (loadMore) เพื่อให้ backend slice จาก shuffle ชุดเดียวกัน ไม่ซ้ำ/ไม่ข้าม
  const pinnedIdRef = useRef(null);
  const pinSessionRef = useRef(null);
  const isManualRefreshRef = useRef(false);
  // บันทึก ID โพสต์ที่เพิ่งแสดงผลไปเพื่อส่ง exclude ตอนกดรีเฟรช ป้องกันการเห็นโพสต์ซ้ำเมื่อกดรีเฟรชรัวๆ
  const seenFeedIdsRef = useRef({});
  const currentExcludeRef = useRef('');
  const trendingSeenRef = useRef([]);
  const trendingSeenLoadedForRef = useRef(null);

  // Auto-hide tab navigation on scroll down, reveal on scroll up
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isShortPage = typeof document !== 'undefined'
        && document.documentElement
        && document.documentElement.scrollHeight <= window.innerHeight + 100;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (currentScrollY <= 60 || isShortPage) {
            setShowTabNav(true);
          } else {
            const diff = currentScrollY - lastScrollYRef.current;
            if (diff > 8) {
              setShowTabNav(false);
            } else if (diff < -8) {
              setShowTabNav(true);
            }
          }
          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setShowTabNav(true);
  }, [activeTab, refreshTrigger]);

  const ensureTrendingSeenLoaded = useCallback(() => {
    const viewer = currentUser?.id ?? 'guest';
    trendingSeenRef.current = pruneTrendingSeen([
      ...(trendingSeenLoadedForRef.current === viewer ? trendingSeenRef.current : []),
      ...loadTrendingSeen(currentUser?.id),
    ]);
    trendingSeenLoadedForRef.current = viewer;
  }, [currentUser?.id]);

  const markTrendingSeen = useCallback((ids, now = Date.now()) => {
    if (!ids || ids.length === 0) return;
    ensureTrendingSeenLoaded();
    const latest = new Map(trendingSeenRef.current.map((entry) => [entry.id, Number(entry.seenAt) || now]));
    let changed = false;
    for (const id of ids) {
      if (!id) continue;
      const prev = latest.get(id);
      if (prev && now - prev < 1000) continue;
      latest.set(id, now);
      changed = true;
    }
    if (!changed) return;
    const pruned = pruneTrendingSeen([...latest].map(([id, seenAt]) => ({ id, seenAt })), now);
    trendingSeenRef.current = pruned;
    persistTrendingSeen(currentUser?.id, pruned);
  }, [currentUser?.id, ensureTrendingSeenLoaded]);

  const trendingExclude = useCallback((now = Date.now()) => {
    ensureTrendingSeenLoaded();
    return trendingSeenExclude(trendingSeenRef.current, TRENDING_SEEN_EXCLUDE_MAX, now);
  }, [ensureTrendingSeenLoaded]);

  const trendingFallback = useCallback((now = Date.now()) => {
    ensureTrendingSeenLoaded();
    return trendingSeenFallback(trendingSeenRef.current, TRENDING_SEEN_EXCLUDE_MAX, now);
  }, [ensureTrendingSeenLoaded]);

  const handleSeen = useCallback((postId) => {
    if (!postId) return;
    markTrendingSeen([postId]);
  }, [markTrendingSeen]);

  const requestGenerationRef = useRef(0);
  const lastRefreshRef = useRef(0);
  const refreshFeed = useCallback(() => {
    if (inFlightRef.current || loadingRef.current || feedLocked) return;
    const currentPosts = postsRef.current;
    if (activeTab === 'trending' && currentPosts.length > 0 && Date.now() - lastRefreshRef.current < 1500) return;
    lastRefreshRef.current = Date.now();
    loadingRef.current = true;
    if (activeTab !== 'trending') {
      setIsLoading(true);
      const currentIds = currentPosts.map(post => post.id).filter(Boolean);
      const prevSeen = seenFeedIdsRef.current[cacheKey] || [];
      seenFeedIdsRef.current[cacheKey] = [...new Set([...prevSeen, ...currentIds])].slice(-60);
      delete feedCacheRef.current[cacheKey];
    }
    isManualRefreshRef.current = true;
    requestGenerationRef.current += 1;
    pageRef.current = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setRefreshTrigger(prev => prev + 1);
  }, [activeTab, cacheKey, feedLocked]);

  // รองรับการกดรีเฟรชจาก Navbar (คลิก Home หรือ Logo) หรือ Mobile Bottom Nav
  useEffect(() => {
    const handleGlobalRefresh = () => {
      refreshFeed();
    };
    window.addEventListener('tog-refresh-feed', handleGlobalRefresh);
    return () => window.removeEventListener('tog-refresh-feed', handleGlobalRefresh);
  }, [refreshFeed]);

  // สลับแท็บ/ล็อกอิน ต้องเริ่มฟีดใหม่ตั้งแต่หน้า 1 เสมอ ไม่งั้นข้อมูลแท็บเก่าจะค้าง
  // ปนกับแท็บใหม่ตอน infinite scroll ต่อท้าย — เว้นแต่มี cache ของ key นี้อยู่แล้ว
  useEffect(() => {
    let cancelled = false;
    requestGenerationRef.current += 1;
    const generation = requestGenerationRef.current;
    loadingRef.current = false;
    inFlightRef.current = false;
    setIsLoadingMore(false);
    if (feedLocked) {
      setPosts([]);
      setHasMore(false);
      setIsLoading(false);
      return () => { cancelled = true; requestGenerationRef.current += 1; };
    }
    const cached = activeTab === 'trending' ? null : feedCacheRef.current[cacheKey];
    if (cached) {
      cursorRef.current = cached.cursor || null;
      seedRef.current = cached.seed;
      currentExcludeRef.current = cached.exclude;
      pinnedIdRef.current = cached.pin;
      resolvedFeedTypeRef.current = cached.feedType;
      setPosts(cached.posts);
      setPostsKey(cacheKey);
      pageRef.current = cached.page;
      setHasMore(cached.hasMore);
      setIsLoading(false);
      return () => { cancelled = true; requestGenerationRef.current += 1; };
    }

    async function loadFirstPage() {
      if (inFlightRef.current) return;
      const isManual = isManualRefreshRef.current;
      isManualRefreshRef.current = false;
      if (activeTab !== 'trending' || !isManual) {
        setIsLoading(true);
        setTrendingError(null);
        setPosts([]);
        pageRef.current = 1;
        setHasMore(true);
      }
      loadingRef.current = true;
      inFlightRef.current = true;
      // consume pin ครั้งเดียวตอน mount (ครั้งถัดไป/เข้าหน้าใหม่ = ไม่มีอีก → กลับสุ่ม)
      const pinSession = `${cacheKey}:${refreshTrigger}`;
      if (activeTab !== 'trending' || pinSessionRef.current !== pinSession) {
        pinnedIdRef.current = takeLastPublished(currentUser?.id);
        pinSessionRef.current = pinSession;
      }
      ensureTrendingSeenLoaded();
      if (activeTab === 'trending' && trendingSeenRef.current.some(entry => entry.id === pinnedIdRef.current)) {
        pinnedIdRef.current = null;
      }
      resolvedFeedTypeRef.current = feedType;
      seedRef.current = Math.floor(Math.random() * 1e9);
      currentExcludeRef.current = activeTab === 'trending'
        ? trendingExclude()
        : (seenFeedIdsRef.current[cacheKey] || []).join(',');
      const currentSeen = activeTab === 'trending'
        ? trendingFallback()
        : undefined;
      try {
        let requestCursor = null;
        const effectiveExclude = currentExcludeRef.current || undefined;
        const effectiveSeen = currentSeen || undefined;
        const fetchPage = async (page) => {
          const response = await fetchRankings({
          cursor: requestCursor,
          userId: currentUser?.id,
          feedType,
          seed: seedRef.current,
          pin: pinnedIdRef.current || undefined,
          exclude: effectiveExclude,
          seen: effectiveSeen,
          page,
          limit: PAGE_SIZE,
          refresh: isManual,
          });
          if (!response.error && response.success !== false) requestCursor = response.nextCursor || null;
          return response;
        };
        const result = activeTab === 'trending'
          ? await fetchUnseenTrendingPage(fetchPage, {
            limit: PAGE_SIZE,
            getSeen: () => { ensureTrendingSeenLoaded(); return trendingSeenRef.current; },
            cancelled: () => cancelled || generation !== requestGenerationRef.current,
            maxAttempts: 2,
          })
          : await fetchPage(1);
        if (cancelled || generation !== requestGenerationRef.current) return;
        cursorRef.current = requestCursor;
        const data = activeTab === 'trending'
          ? filterUnseenTrending(result.data, trendingSeenRef.current)
          : result.data;
        if (cancelled || generation !== requestGenerationRef.current) return;
        if (result.error || result.success === false) {
          setTrendingError(result.error || tRef.current('errors.fetchFailed'));
          setHasMore(false);
          return;
        }

        const currentPosts = postsRef.current;
        // Non-resetting refresh for Trending: prepend brand new rankings without wiping feed
        if (activeTab === 'trending' && isManual && currentPosts.length > 0) {
          const currentIdSet = new Set(currentPosts.map(p => p.id));
          const brandNew = (data || []).filter(p => !currentIdSet.has(p.id));
          const updatedPosts = brandNew.length > 0 ? [...brandNew, ...currentPosts] : currentPosts;
          pageRef.current = result.page || 1;
          setPosts(updatedPosts);
          setPostsKey(cacheKey);
          setHasMore(!!result.hasMore);
          feedCacheRef.current[cacheKey] = {
            posts: updatedPosts,
            page: 1,
            hasMore: !!result.hasMore,
            seed: seedRef.current,
            exclude: currentExcludeRef.current,
            pin: pinnedIdRef.current,
            feedType: resolvedFeedTypeRef.current,
            cursor: cursorRef.current
          };
          if (Date.now() - lastRefreshToastRef.current >= 3000) {
            toastRef.current.success(tRef.current('feed.refreshed'));
            lastRefreshToastRef.current = Date.now();
          }
          return;
        }

        const nextHasMore = !!result.hasMore;
        pageRef.current = result.page || 1;
        setPosts(data || []);
        setPostsKey(cacheKey);
        setHasMore(nextHasMore);
        feedCacheRef.current[cacheKey] = { posts: data || [], page: result.page || 1, cursor: cursorRef.current, hasMore: nextHasMore, seed: seedRef.current, exclude: currentExcludeRef.current, pin: pinnedIdRef.current, feedType: resolvedFeedTypeRef.current };

        // For You / Following ยังคง behavior เดิม: backend ส่งการ์ดมา = นับว่า seen
        // เพื่อกันการวนซ้ำตอนกด refresh (Trending จะ mark seen จาก viewport จริง
        // ผ่าน SeenCardObserver แล้ว persist ลง localStorage — ดู ../lib/trendingSeen)
        if (activeTab !== 'trending') {
          const pageIds = (data || []).map((p) => p.id).filter(Boolean);
          const tabKey = cacheKey;
          const prevSeen = seenFeedIdsRef.current[tabKey] || [];
          const nextSeen = [...prevSeen, ...pageIds.filter((id) => !prevSeen.includes(id))];
          if (nextSeen.length > 60) nextSeen.splice(0, nextSeen.length - 60);
          seenFeedIdsRef.current[tabKey] = nextSeen;
        }

        if (isManual && !result.error && result.success !== false) {
          if (activeTab !== 'trending' || Date.now() - lastRefreshToastRef.current >= 4500) {
            toastRef.current.success(tRef.current('feed.refreshed'));
            lastRefreshToastRef.current = Date.now();
          }
        }
      } finally {
        if (!cancelled && generation === requestGenerationRef.current) {
          inFlightRef.current = false;
          setIsLoading(false);
          loadingRef.current = false;
        }
      }
    }
    loadFirstPage();
    return () => { cancelled = true; requestGenerationRef.current += 1; };
  }, [currentUser?.id, activeTab, cacheKey, feedType, feedLocked, refreshTrigger, trendingExclude, trendingFallback, ensureTrendingSeenLoaded]);

  // ไม่มี total จาก API สำหรับฟีดทั่วไป (เฉพาะ template_id เท่านั้นที่ API คำนวณ total ให้ —
  // ดู functions/api/rankings.js) เลยเช็คจบฟีดจากจำนวนที่ได้กลับมาน้อยกว่า PAGE_SIZE แทน
  const loadMore = useCallback(async () => {
    if (feedLocked || loadingRef.current || inFlightRef.current || !hasMore) return;
    loadingRef.current = true;
    inFlightRef.current = true;
    // 📍 ใช้ pageRef ไม่ใช่ closure `page` — ถ้า observer เก่ายิงค้างมาก่อน React commit
    // re-render (ที่จะ re-attach observer ใหม่) จะได้ร่างหน้าถัดไปที่ถูกต้อง ไม่ fetch ซ้ำหน้าเดิม
    const nextPage = pageRef.current + 1;
    setIsLoadingMore(true);
    const activeFeedType = resolvedFeedTypeRef.current;
    const generation = requestGenerationRef.current;
    const currentExclude = currentExcludeRef.current || undefined;
    const currentSeen = activeTab === 'trending' ? (trendingFallback() || undefined) : undefined;
    try {
      let requestCursor = cursorRef.current;
      const fetchPage = async (page) => {
        const response = await fetchRankings({
        cursor: requestCursor,
        userId: currentUser?.id,
        feedType: activeFeedType,
        seed: seedRef.current,
        pin: pinnedIdRef.current || undefined,
        exclude: currentExclude,
        seen: currentSeen,
        page,
        limit: PAGE_SIZE
        });
        if (!response.error && response.success !== false) requestCursor = response.nextCursor || null;
        return response;
      };
      const result = activeTab === 'trending'
        ? await fetchUnseenTrendingPage(fetchPage, {
          page: nextPage, limit: PAGE_SIZE,
          getSeen: () => { ensureTrendingSeenLoaded(); return trendingSeenRef.current; },
          existingIds: postsRef.current.map(post => post.id),
          cancelled: () => generation !== requestGenerationRef.current,
          maxAttempts: 2,
        })
        : await fetchPage(nextPage);
      const { data, success, error } = result;
      if (generation !== requestGenerationRef.current) return;
      if (success === false || error) {
        setTrendingError(error || tRef.current('errors.fetchFailed'));
        setHasMore(false);
        return;
      }
      pageRef.current = result.page || nextPage;
      cursorRef.current = requestCursor;
      const nextHasMore = !!result.hasMore;
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = activeTab === 'trending'
          ? filterUnseenTrending(data, trendingSeenRef.current, existingIds)
          : (data || []).filter(p => !existingIds.has(p.id));

        const effectiveHasMore = nextHasMore;

        const merged = [...prev, ...newPosts];
        feedCacheRef.current[cacheKey] = { ...feedCacheRef.current[cacheKey], posts: merged, page: result.page || nextPage, cursor: cursorRef.current, hasMore: effectiveHasMore };
        setHasMore(effectiveHasMore);
        return merged;
      });
    } finally {
      if (generation === requestGenerationRef.current) {
        inFlightRef.current = false;
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    }
  }, [hasMore, currentUser?.id, cacheKey, feedLocked, activeTab, ensureTrendingSeenLoaded, trendingFallback]);

  // callback ref แทน useRef+useEffect — React เรียก callback นี้เองทันทีที่ DOM node
  // ของ sentinel ถูกสร้าง/ถอดออกจริงๆ (ตอน commit) ไม่ต้องเดาว่า effect จะ rerun
  // ทันเวลาไหม (เคยพลาดมาแล้ว: ตอน isLoading เปลี่ยนจาก true→false โดยที่
  // page/hasMore/currentUser/activeTab ไม่เปลี่ยนค่าเลย loadMore เลย memo อ้างตัวเดิม
  // effect ที่ depend [loadMore] ไม่รีรัน เลยไม่เคย attach observer เข้ากับ node จริง)

  const displayData = postsKey === cacheKey ? posts : [];
  useLiveRefresh({
    resourceKey: cacheKey,
    enabled: displayData.length > 0 && !feedLocked,
    interval: 15000,
    matches: change => ['/api/comments', '/api/admin/comments', '/api/votes', '/api/rankings'].includes(change.path),
    load: async signal => {
      const cards = [...document.querySelectorAll('[data-social-ranking]')];
      const visibleIds = cards.filter(card => {
        const bounds = card.getBoundingClientRect();
        return bounds.bottom >= -window.innerHeight && bounds.top <= window.innerHeight * 2;
      }).map(card => card.dataset.socialRanking);
      const ids = (visibleIds.length ? visibleIds : postsRef.current.slice(0, PAGE_SIZE).map(post => post.id)).slice(0, 40);
      const result = await fetchSocialState(ids, { signal });
      return { ...result, requestedIds: ids };
    },
    apply: result => {
      const snapshots = new Map((result.data || []).map(row => [row.id, row]));
      const requested = new Set(result.requestedIds);
      const update = rows => rows.filter(post => !requested.has(post.id) || snapshots.has(post.id)).map(post => {
        const row = snapshots.get(post.id);
        return row ? { ...post, user_vote: row.user_vote ?? null,
          stats: { ...post.stats, likes: row.likes ?? 0, dislikes: row.dislikes ?? 0, comments: row.comments ?? 0 } } : post;
      });
      setPosts(update);
      for (const cached of Object.values(feedCacheRef.current)) cached.posts = update(cached.posts);
    },
  });
  const handleVoteChange = useCallback((id, vote) => {
    const update = post => post.id === id ? { ...post, user_vote: vote.user_vote, stats: { ...post.stats, likes: vote.likes, dislikes: vote.dislikes } } : post;
    setPosts(previous => previous.map(update));
    for (const cached of Object.values(feedCacheRef.current)) cached.posts = cached.posts.map(update);
  }, []);
  const allSeen = activeTab === 'trending'
    && !isLoading
    && !trendingError
    && !hasMore
    && displayData.length === 0;
  const followingEmpty = !isLoading
    && !feedLocked
    && activeTab === 'following'
    && displayData.length === 0;
  const LockedIcon = Users;

  return (
    <div className="min-h-screen font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-5">
        <PlayHeader variant="home" eyebrow={t('play.homeEyebrow')}
          title={<><span>{t('play.homeTitleLead')}</span><span><em>{t('play.homeTitleAccent')}</em></span></>}
          description={t('play.homeDescription')} visual={<HomeShowcase />}>
          <div className="home-actions mt-4">
            <Link to="/discover/templates" className="play-button">{t('play.pickAction')}</Link>
            <a href="#home-feed" className="home-secondary-action">{t('play.browseAction')}</a>
            <Link to="/create" className="home-secondary-action">{t('play.newTopicAction')}</Link>
          </div>
        </PlayHeader>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-2 pb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-xl font-extrabold text-ink">{t('play.feedHeading')}</h2><p className="text-sm text-muted mt-1">{t('play.feedHelp')}</p></div>
        <Link to="/discover" className="inline-flex items-center gap-1 text-sm font-bold text-ink min-h-11">{t('nav.discover')} <ArrowUpRight size={14} /></Link>
      </div>
      {/* Floating Tab Navigation Capsule with Auto-hide on Scroll */}
      <div
        id="home-feed" className={`scroll-mt-24 sticky top-[80px] z-30 flex justify-center pointer-events-none transition-all duration-300 ease-in-out pb-2 ${
          (showTabNav || displayData.length === 0)
            ? 'translate-y-0 opacity-100'
            : '-translate-y-16 opacity-0'
        }`}
      >
        <div className="pointer-events-auto flex items-center rounded-full bg-surface/85 border border-line-soft/80 backdrop-blur-xl p-1 shadow-md hover:shadow-lg transition-shadow">
          {FEED_TABS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeTab === id}
              onClick={() => {
                if (activeTab === id) {
                  refreshFeed();
                } else {
                  requestGenerationRef.current += 1;
                  setActiveTab(id);
                }
              }}
              className={`flex items-center gap-1.5 rounded-full min-h-11 px-3 sm:px-5 py-1.5 text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === id
                  ? 'opinion-active shadow-xs scale-100'
                  : 'text-muted hover:text-ink hover:bg-surface-glass scale-95'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="home-content-grid mx-auto max-w-7xl px-4 sm:px-6 pt-3 pb-12">
        <main className="home-feed-main w-full min-w-0 max-w-[760px] lg:max-w-none">
        <div className="space-y-6">
          {activeTab === 'for_you' && !currentUser && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface/80 p-3.5 text-xs text-muted shadow-xs">
              <div className="flex items-center gap-2.5">
                <Heart size={16} className="text-brand shrink-0" />
                <span>{t('feed.forYouGuestNotice')}</span>
              </div>
              <button
                type="button"
                onClick={() => setGuestPrompt({ open: true, next: '/' })}
                className="shrink-0 font-bold text-brand hover:underline"
              >
                {t('nav.login')}
              </button>
            </div>
          )}

          {isLoading && (
            <TierLoader />
          )}

          {!isLoading && trendingError && (
            <p role="alert" className="text-center text-sm text-muted py-10">{trendingError}</p>
          )}

          {allSeen && (
            <div className="text-center py-16 px-4 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <div className="mx-auto mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-surface-glass text-brand">
                <Check size={24} aria-hidden="true" />
              </div>
              <p className="text-base font-bold text-ink">
                {t('feed.allSeen')}
              </p>
              <p className="mt-2 text-sm text-muted font-medium">
                {t('feed.allSeenSubtitle')}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={refreshFeed}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-soft bg-surface px-5 py-2 text-sm font-bold text-ink shadow-xs transition-all hover:bg-surface-glass hover:border-line active:scale-[0.97]"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {t('feed.refresh')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/discover/templates')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-bold text-canvas shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <Search size={16} aria-hidden="true" />
                  {t('feed.exploreTemplates')}
                </button>
              </div>
            </div>
          )}

          {!isLoading && !feedLocked && !followingEmpty && !allSeen && !trendingError && displayData.length === 0 && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <p className="text-xl font-black text-ink">{t('play.emptyTitle')}</p><p className="mt-2 text-muted font-medium">{t('feed.empty')}</p>
              <button onClick={() => navigate('/discover/templates')} className="play-button mt-4">
                {t('feed.exploreTemplates')}
              </button>
            </div>
          )}

          {!isLoading && feedLocked && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <div className="mx-auto mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-surface-glass text-brand">
                <LockedIcon size={24} />
              </div>
              <p className="text-base font-bold text-ink">
                {t('feed.followingLockedTitle')}
              </p>
              <p className="mt-2 text-sm text-muted font-medium">
                {t('feed.followingLockedDesc')}
              </p>
              <button
                onClick={() => setGuestPrompt({ open: true, next: '/' })}
                className="mt-5 px-5 py-2.5 bg-brand text-canvas text-sm font-bold rounded-full shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
              >
                {t('feed.loginCta')}
              </button>
            </div>
          )}

          {followingEmpty && (
            <div className="following-empty personality-empty text-center bg-surface rounded-2xl border border-line-soft shadow-sm">
              <TearMascot pose="welcome" />
              <p className="text-base font-bold text-ink">{t('feed.followingEmptyTitle')}</p>
              <p className="mt-2 text-sm text-muted font-medium">{t('feed.followingEmptyDesc')}</p>
              <button
                type="button"
                onClick={() => setActiveTab('trending')}
                className="mt-5 min-h-11 px-5 py-2.5 bg-brand text-canvas text-sm font-bold rounded-full shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
              >
                {t('feed.followingEmptyCta')}
              </button>
            </div>
          )}

          {!isLoading && displayData.length > 0 && (
              <VirtualFeedContainer
                key={cacheKey}
                items={displayData}
                onLoadMore={loadMore}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                windowSize={12}
                bufferBefore={3}
                estimatedItemHeight={440}
                renderItem={(post, index) => activeTab === 'trending' ? (
                  <SeenCardObserver postId={post.id} onSeen={handleSeen}>
                    <HomeTierCard post={post} featured={index === 0} onVoteChange={handleVoteChange} onRequireAuth={(next) => setGuestPrompt({ open: true, next })} />
                  </SeenCardObserver>
                ) : <HomeTierCard post={post} featured={index === 0} onVoteChange={handleVoteChange} onRequireAuth={(next) => setGuestPrompt({ open: true, next })} />}
              />
          )}
          {!isLoading && !isLoadingMore && hasMore && displayData.length === 0 && (
            <button type="button" onClick={loadMore} className="w-full rounded-xl border border-line-soft p-4 font-bold">{t('common.loadMore')}</button>
          )}

          {isLoadingMore && (
            <p className="text-center text-xs font-medium text-muted animate-pulse py-4">
              {t('common.loadMore')}
            </p>
          )}

          {!isLoading && !hasMore && displayData.length > 0 && (
            <div 
              key={`end_feed_${activeTab}`}
              ref={(el) => {
                if (!el || el.dataset.tracked) return;
                if (typeof IntersectionObserver === 'undefined') {
                  el.dataset.tracked = 'true';
                  trackEvent('feed_end_reached', { entityType: 'feed', entityId: activeTab, onceKey: `feed_end_${activeTab}` });
                  return;
                }
                const observer = new IntersectionObserver(([entry]) => {
                  if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    el.dataset.tracked = 'true';
                    trackEvent('feed_end_reached', { entityType: 'feed', entityId: activeTab, onceKey: `feed_end_${activeTab}` });
                    observer.disconnect();
                  }
                }, { threshold: 0.5 });
                observer.observe(el);
                return () => observer.disconnect();
              }}
              className="mt-8 mb-12 flex flex-col items-center justify-center rounded-2xl border border-line-soft bg-surface px-4 py-10 text-center shadow-sm"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-glass text-brand">
                <Check size={24} aria-hidden="true" />
              </div>
              <p className="text-base font-bold text-ink">
                {activeTab === 'trending' ? t('feed.allSeen') : t('feed.allCaughtUp')}
              </p>
              <p className="mt-2 text-sm font-medium text-muted">
                {activeTab === 'trending' ? t('feed.allSeenSubtitle') : t('feed.allCaughtUpSubtitle')}
              </p>
              <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                <Link
                  to="/discover/templates"
                  onClick={() => trackEvent('empty_state_cta_click', { entityType: 'button', entityId: 'end_feed_explore_templates' })}
                  className="play-button w-full sm:w-auto"
                >
                  <Search size={18} aria-hidden="true" />
                  {t('feed.exploreTemplates')}
                </Link>
                <Link
                  to="/create"
                  onClick={() => trackEvent('empty_state_cta_click', { entityType: 'button', entityId: 'end_feed_create' })}
                  className="opinion-secondary w-full gap-2 sm:w-auto"
                >
                  <Plus size={18} aria-hidden="true" />
                  {t('play.newTopicAction')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
      <GuestAuthPrompt
        open={guestPrompt.open}
        next={guestPrompt.next}
        onClose={() => setGuestPrompt((prompt) => ({ ...prompt, open: false }))}
      />
    </div>
  );
}





















