import TierRow from '../components/feed/TierRow';
import { buildTierRows } from '../lib/tiers';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, voteRanking } from '../lib/api'; // 📍 นำเข้า voteRanking สำหรับบันทึกโหวตลง Cloudflare
import { ThumbsUp, ThumbsDown, MessageSquare, Copy, Share2, Download, Flame, Heart, Users, BarChart3, RotateCw } from 'lucide-react';
import { challengeUrl, shareUrl } from '../lib/share';
import ShareExportModal from '../components/ui/ShareExportModal';
import ExportCard from '../components/ui/ExportCard';
import BookmarkButton from '../components/template/BookmarkButton';
import UserFollowButton from '../components/user/UserFollowButton';

import { formatCount, timeAgo } from '../lib/format';
import { takeLastPublished } from '../lib/lastPublished';
import { createPendingGuard } from '../lib/pendingGuard';
import HomeLeftSidebar from '../components/feed/HomeLeftSidebar';
import FeaturedPrompts from '../components/feed/FeaturedPrompts';
import FreshnessHub from '../components/feed/FreshnessHub';
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

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0, initialUserVote = null, onShare, onExport, onRequireAuth }) {
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
        <button type="button" aria-label={t('post.like')} aria-pressed={userVote === 'like'} onClick={() => handleVote('like')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'like' ? 'text-vote-up' : 'text-muted hover:text-ink'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </button>

        <button type="button" aria-label={t('post.dislike')} aria-pressed={userVote === 'dislike'} onClick={() => handleVote('dislike')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'dislike' ? 'text-vote-down' : 'text-muted hover:text-ink'}`}>
          <ThumbsDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{dislikes}</span>
        </button>

        <button type="button" data-auth-next={`/post/${id}#comments`} aria-label={t('post.comments')} onClick={() => navigate(`/post/${id}#comments`)} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <MessageSquare size={18} />
          <span className="text-[13px] font-bold">{initialComments}</span>
        </button>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" aria-label={t('common.export')} onClick={onExport} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Download size={18} />
          <span className="hidden text-[13px] font-bold sm:inline">{t('common.export')}</span>
        </button>
        <button type="button" aria-label={t('common.share')} onClick={onShare} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Share2 size={18} />
          <span className="hidden text-[13px] font-bold sm:inline">{t('common.share')}</span>
        </button>
      </div>
    </div>
  );
}

function HomeTierCard({ post, onRequireAuth }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // 'share' | 'export' | null
  const [mobileExpanded, setMobileExpanded] = useState(false);

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
  const hasMobileOverflow = tierRows.length > 3 || tierRows.some((row) => row.items.length > 4);
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

  return (
    <article className="bg-surface border border-line-soft rounded-[20px] p-4 sm:p-6 shadow-sm">
      {/* Header Profile & Use Template Button */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            data-auth-next={`/profile/${post.user_id}`}
            className="w-10 h-10 rounded-full overflow-hidden bg-surface-glass border border-line-soft cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}
          >
            {post.profile?.avatar_url ? (
              <img src={post.profile.avatar_url} alt={t('feed.avatarAlt')} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-muted">
                {post.profile?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                data-auth-next={`/profile/${post.user_id}`}
                className="truncate text-[15px] font-bold text-ink leading-tight cursor-pointer hover:underline"
                onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}
              >
                {post.profile?.username || t('common.unknownUser')}
              </h3>
              <UserFollowButton
                targetUserId={post.user_id}
                initialIsFollowing={post.profile?.is_following}
                onRequireAuth={onRequireAuth}
              />
            </div>
            <p
              data-auth-next={`/post/${post.id}`}
              className="text-[13px] text-muted font-medium cursor-pointer"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {timeAgo(post.created_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <BookmarkButton 
            template={{ id: post.template_id, is_saved: post.is_template_saved }} 
            onRequireAuth={onRequireAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-xs hover:bg-surface hover:text-ink hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
          />
          <button
            onClick={() => {
              if (!currentUser) {
                if (onRequireAuth) {
                  onRequireAuth(`/rank?template=${encodeURIComponent(post.template_id || '')}`);
                } else {
                  navigate(`/login?next=${encodeURIComponent(`/rank?template=${post.template_id || ''}`)}`);
                }
                return;
              }
              navigate(`/rank?template=${post.template_id || ''}`);
            }}
            title={t('feed.useTemplate', { title: post.title })}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-xs hover:bg-surface hover:text-ink hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
          >
            <Copy size={12} strokeWidth={2.5} />
            <span>{t('feed.useTemplateShort')}</span>
          </button>
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
      <h2
        data-auth-next={`/post/${post.id}`}
        onClick={() => navigate(`/post/${post.id}`)}
        className="text-lg sm:text-xl font-extrabold mb-3 sm:mb-5 text-ink cursor-pointer hover:text-highlight transition-colors"
      >
        {post.title}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label={t('feed.featuredStats')}>
        {post.template_id && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-2.5 py-1 text-[11px] font-bold text-ink-soft">
            <Users size={13} className="text-brand" />
            {t('feed.rankedBy', { count: formatCount(Math.max(1, templateUses)) })}
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

      <div className="mb-4 sm:hidden">
        <div className="space-y-1.5">
          {mobileRows.map((row) => renderTierRow(row, true, mobileExpanded ? null : 4))}
        </div>
        {hasMobileOverflow && (
          <button
            type="button"
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((expanded) => !expanded)}
            className="mt-2.5 w-full rounded-xl border border-line-soft bg-surface-glass px-4 py-2.5 text-xs font-bold text-ink-soft transition-colors hover:bg-tag hover:text-ink"
          >
            {mobileExpanded
              ? t('feed.showLess')
              : t('feed.showFullRanking', { tiers: tierRows.length, items: totalItems })}
          </button>
        )}
      </div>

      <div className="hidden space-y-1.5 mb-4 sm:block">
        {tierRows.map((row) => renderTierRow(row))}
      </div>

      {/* Action Bar */}
      <FeedCardActionBar
        id={post.id}
        initialLikes={post.stats?.likes || 0}
        initialDislikes={post.stats?.dislikes || 0}
        initialComments={post.stats?.comments || 0}
        initialUserVote={post.user_vote ?? null}
        onShare={() => setModal('share')}
        onExport={() => setModal('export')}
        onRequireAuth={onRequireAuth}
      />

      {modal !== null && (
        <ShareExportModal
          open={modal !== null}
          mode={modal}
          onClose={() => setModal(null)}
          link={shareUrl(`/post/${post.id}`)}
          challengeLink={post.template_id ? challengeUrl(post.template_id, post.id) : null}
          preview={
            <ExportCard
              title={post.title}
              authorName={post.profile?.username}
              authorAvatar={post.profile?.avatar_url}
              postedAt={timeAgo(post.created_at)}
              hashtags={post.hashtags}
              tiers={tierRows.map((row) => ({
                tier: row.tier,
                color: row.color,
                items: row.items.map((ri) => ({
                  name: ri.item?.name || ri.item_id || t('common.unknownItem'),
                  image_url: ri.item?.image_url || null,
                })),
              }))}
            />
          }
          filename={`feed-${post.id}.png`}
        />
      )}
    </article>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true) // หน้าแรกเท่านั้น — กันจอกระพริบตอน append หน้าถัดไป
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState('trending');
  const [guestPrompt, setGuestPrompt] = useState({ open: false, next: '/' });
  const [showTabNav, setShowTabNav] = useState(true);
  const lastScrollYRef = useRef(0);
  const loadingRef = useRef(false) // กันยิงซ้ำตอนเลื่อนเร็วๆ หรือ observer ยิงซ้อนตอนกำลังโหลดอยู่
  const observerRef = useRef(null) // instance ของ IntersectionObserver ตัวปัจจุบัน (ผูกกับ sentinel node ล่าสุด)
  const pageRef = useRef(1) // หน้าล่าสุดที่ fetch ไป — loadMore อ่านที่นี่ ไม่ใช่ closure `page` ที่ค้าง

  // Auto-hide tab navigation on scroll down, reveal on scroll up
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (currentScrollY <= 60) {
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

  // Cache each feed+viewer separately, including pages loaded by infinite scroll.
  const feedCacheRef = useRef({})
  const cacheKey = `${activeTab}:${currentUser?.id ?? 'anon'}`

  // The backend gives each mode distinct semantics: engagement+freshness, interest
  // matching, or authors followed by the signed-in viewer.
  const feedType = activeTab;
  const feedLocked = activeTab === 'following' && !currentUser;
  const resolvedFeedTypeRef = useRef(feedType);
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  // 📍 [ใหม่]: ranking ที่เพิ่ง publish ของฉัน — ขึ้นการ์ดแรกหน้า Home แค่ mount แรกหลัง publish
  // (ได้จาก src/lib/lastPublished.js; F5/เข้าหน้าใหม่ = module reset → null → สับสุ่มตามเดิม)
  // ส่ง pin ต่อทุกหน้า (loadMore) เพื่อให้ backend slice จาก shuffle ชุดเดียวกัน ไม่ซ้ำ/ไม่ข้าม
  const pinnedIdRef = useRef(null);
  const isManualRefreshRef = useRef(false);
  // บันทึก ID โพสต์ที่เพิ่งแสดงผลไปเพื่อส่ง exclude ตอนกดรีเฟรช ป้องกันการเห็นโพสต์ซ้ำเมื่อกดรีเฟรชรัวๆ
  const seenFeedIdsRef = useRef({});
  const currentExcludeRef = useRef('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const requestGenerationRef = useRef(0);
  const refreshFeed = useCallback(() => {
    if (loadingRef.current || feedLocked) return;
    isManualRefreshRef.current = true;
    const prevSeen = seenFeedIdsRef.current[cacheKey] || [];
    const currentIds = posts.map(post => post.id).filter(Boolean);
    seenFeedIdsRef.current[cacheKey] = [...new Set([...prevSeen, ...currentIds])].slice(-60);
    delete feedCacheRef.current[cacheKey];
    requestGenerationRef.current += 1;
    pageRef.current = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  }, [cacheKey, posts, feedLocked]);

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
    loadingRef.current = false;
    setIsLoadingMore(false);
    if (feedLocked) {
      setPosts([]);
      setHasMore(false);
      setIsLoading(false);
      setIsRefreshing(false);
      return () => { requestGenerationRef.current += 1; };
    }
    const cached = feedCacheRef.current[cacheKey];
    if (cached) {
      seedRef.current = cached.seed;
      currentExcludeRef.current = cached.exclude;
      pinnedIdRef.current = cached.pin;
      resolvedFeedTypeRef.current = cached.feedType;
      setPosts(cached.posts);
      pageRef.current = cached.page;
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRefreshing(false);
      return () => { requestGenerationRef.current += 1; };
    }

    async function loadFirstPage() {
      setIsLoading(true);
      setPosts([]);
      pageRef.current = 1;
      setHasMore(true);
      loadingRef.current = true;
      // consume pin ครั้งเดียวตอน mount (ครั้งถัดไป/เข้าหน้าใหม่ = ไม่มีอีก → กลับสุ่ม)
      pinnedIdRef.current = takeLastPublished(currentUser?.id);
      resolvedFeedTypeRef.current = feedType;
      seedRef.current = Math.floor(Math.random() * 1e9);
      currentExcludeRef.current = (seenFeedIdsRef.current[cacheKey] || []).join(',');
      const isManual = isManualRefreshRef.current;
      isManualRefreshRef.current = false;
      try {
        const effectiveExclude = currentExcludeRef.current || undefined;
        let result = await fetchRankings({
          userId: currentUser?.id,
          feedType,
          seed: seedRef.current,
          pin: pinnedIdRef.current || undefined,
          exclude: effectiveExclude,
          page: 1,
          limit: PAGE_SIZE,
          refresh: isManual,
        });
        if (cancelled) return;
        // For You must always be useful. The API normally falls back to Trending
        // for accounts without enough taste signals; keep the same guarantee in
        // the client for an empty successful result. A request error must not
        // silently switch the viewer to an unrelated feed.
        if (feedType === 'for_you' && currentUser?.id && !result.error && result.success !== false && !result.data?.length) {
          result = await fetchRankings({
            userId: currentUser.id,
            feedType: 'trending',
            seed: seedRef.current,
            exclude: effectiveExclude,
            page: 1,
            limit: PAGE_SIZE,
            refresh: isManual,
          });
          if (cancelled) return;
          resolvedFeedTypeRef.current = 'trending';
        }
        const data = result.data;
        if (cancelled) return;
        const nextHasMore = (data?.length || 0) === PAGE_SIZE;
        setPosts(data || []);
        setHasMore(nextHasMore);
        feedCacheRef.current[cacheKey] = { posts: data || [], page: 1, hasMore: nextHasMore, seed: seedRef.current, exclude: currentExcludeRef.current, pin: pinnedIdRef.current, feedType: resolvedFeedTypeRef.current };

        // บันทึก ID หน้าแรกลงประวัติที่เคยเห็นของแท็บนี้ ป้องกันการขึ้นซ้ำในรอบถัดไป
        const pageIds = (data || []).map((p) => p.id).filter(Boolean);
        const tabKey = cacheKey;
        const prevSeen = seenFeedIdsRef.current[tabKey] || [];
        const nextSeen = [...prevSeen, ...pageIds.filter((id) => !prevSeen.includes(id))];
        if (nextSeen.length > 60) nextSeen.splice(0, nextSeen.length - 60);
        seenFeedIdsRef.current[tabKey] = nextSeen;

        if (isManual) {
          toast.success(t('feed.refreshed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          loadingRef.current = false;
          setIsRefreshing(false);
        }
      }
    }
    loadFirstPage();
    return () => { cancelled = true; requestGenerationRef.current += 1; };
  }, [currentUser, activeTab, cacheKey, feedType, feedLocked, refreshTrigger, t, toast]);

  // ไม่มี total จาก API สำหรับฟีดทั่วไป (เฉพาะ template_id เท่านั้นที่ API คำนวณ total ให้ —
  // ดู functions/api/rankings.js) เลยเช็คจบฟีดจากจำนวนที่ได้กลับมาน้อยกว่า PAGE_SIZE แทน
  const loadMore = useCallback(async () => {
    if (feedLocked || loadingRef.current || !hasMore) return
    loadingRef.current = true
    // 📍 ใช้ pageRef ไม่ใช่ closure `page` — ถ้า observer เก่ายิงค้างมาก่อน React commit
    // re-render (ที่จะ re-attach observer ใหม่) จะได้ร่างหน้าถัดไปที่ถูกต้อง ไม่ fetch ซ้ำหน้าเดิม
    const nextPage = pageRef.current + 1
    setIsLoadingMore(true)
    const activeFeedType = resolvedFeedTypeRef.current;
    const generation = requestGenerationRef.current;
    const currentExclude = currentExcludeRef.current || undefined;
    try {
      const { data, success, error } = await fetchRankings({
        userId: currentUser?.id,
        feedType: activeFeedType,
        seed: seedRef.current,
        pin: pinnedIdRef.current || undefined,
        exclude: currentExclude,
        page: nextPage,
        limit: PAGE_SIZE
      })
      if (generation !== requestGenerationRef.current) return;
      if (success === false || error) return;
      pageRef.current = nextPage;
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = (data || []).filter(p => !existingIds.has(p.id));
        const merged = [...prev, ...newPosts]
        const nextHasMore = (data?.length || 0) === PAGE_SIZE
        feedCacheRef.current[cacheKey] = { ...feedCacheRef.current[cacheKey], posts: merged, page: nextPage, hasMore: nextHasMore }
        return merged
      })
      setHasMore((data?.length || 0) === PAGE_SIZE)
    } finally {
      if (generation === requestGenerationRef.current) {
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    }
  }, [hasMore, currentUser, cacheKey, feedLocked]);

  // callback ref แทน useRef+useEffect — React เรียก callback นี้เองทันทีที่ DOM node
  // ของ sentinel ถูกสร้าง/ถอดออกจริงๆ (ตอน commit) ไม่ต้องเดาว่า effect จะ rerun
  // ทันเวลาไหม (เคยพลาดมาแล้ว: ตอน isLoading เปลี่ยนจาก true→false โดยที่
  // page/hasMore/currentUser/activeTab ไม่เปลี่ยนค่าเลย loadMore เลย memo อ้างตัวเดิม
  // effect ที่ depend [loadMore] ไม่รีรัน เลยไม่เคย attach observer เข้ากับ node จริง)
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!node) return
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore()
    })
    observerRef.current.observe(node)
  }, [loadMore]);

  const displayData = posts;
  const followingEmpty = !isLoading
    && !feedLocked
    && activeTab === 'following'
    && displayData.length === 0;
  const LockedIcon = Users;

  return (
    <div className="min-h-screen font-sans">
      {/* Floating Tab Navigation Capsule with Auto-hide on Scroll */}
      <div
        className={`sticky top-[80px] z-30 flex justify-center pointer-events-none transition-all duration-300 ease-in-out pb-2 ${
          showTabNav
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
              className={`flex items-center gap-1.5 rounded-full px-3 sm:px-5 py-1.5 text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                activeTab === id
                  ? 'bg-brand text-canvas shadow-xs scale-100'
                  : 'text-muted hover:text-ink hover:bg-surface-glass scale-95'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {t(labelKey)}
            </button>
          ))}
          <div className="h-4 w-px bg-line-soft mx-0.5" aria-hidden="true" />
          <button
            type="button"
            onClick={refreshFeed}
            disabled={isRefreshing}
            aria-label={t('feed.refresh')}
            title={t('feed.refresh')}
            className="flex items-center justify-center rounded-full p-1.5 text-muted hover:text-brand hover:bg-surface-glass transition-all disabled:opacity-50 active:scale-90"
          >
            <RotateCw size={13} className={isRefreshing ? 'animate-spin text-brand' : ''} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 flex gap-8 pt-3 pb-12 items-start justify-center">
        <aside className="hidden lg:block w-[240px] shrink-0 sticky top-[88px] max-h-[calc(100vh-88px)] overflow-y-auto hide-scrollbar pb-6 space-y-4">
          <HomeLeftSidebar />
          {activeTab === 'trending' && isLg && (
            <FeaturedPrompts compact />
          )}
        </aside>
        <main className="w-full max-w-2xl shrink">
        <div className="space-y-6">
          {activeTab === 'trending' && !isLg && <div className="lg:hidden"><FeaturedPrompts /></div>}
          {activeTab === 'trending' && !isXl && (
            <div className="xl:hidden">
              <FreshnessHub />
            </div>
          )}

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
            <p className="text-center text-sm font-medium text-muted animate-pulse py-10">
              {t('feed.loadingYourFeed')}
            </p>
          )}

          {!isLoading && !feedLocked && !followingEmpty && displayData.length === 0 && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <p className="text-muted font-medium">{t('feed.empty')}</p>
              <button onClick={() => navigate('/create')} className="mt-4 text-sm font-bold text-brand hover:underline">
                {t('feed.emptyCta')}
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
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <div className="mx-auto mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-surface-glass text-brand">
                <Users size={24} />
              </div>
              <p className="text-base font-bold text-ink">{t('feed.followingEmptyTitle')}</p>
              <p className="mt-2 text-sm text-muted font-medium">{t('feed.followingEmptyDesc')}</p>
              <button
                type="button"
                onClick={() => setActiveTab('trending')}
                className="mt-5 px-5 py-2.5 bg-brand text-canvas text-sm font-bold rounded-full shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
              >
                {t('feed.followingEmptyCta')}
              </button>
            </div>
          )}

          {!isLoading && displayData.map((post) => (
            <HomeTierCard key={post.id} post={post} onRequireAuth={(next) => setGuestPrompt({ open: true, next })} />
          ))}

          {/* เงื่อนไขต้องไม่มี isLoading — ถ้ามี sentinel จะยังไม่ mount ตอนโหลดหน้าแรก
              เสร็จพอดี (page/hasMore/currentUser/activeTab ไม่เปลี่ยนค่าในจังหวะนั้น)
              loadMore เลย memo อ้างตัวเดิม effect ที่ observe ไม่รีรันไปเจอ node จริง
              ให้กันการยิงซ้ำตอนโหลดหน้าแรกด้วย loadingRef guard ใน loadMore แทน */}
          {hasMore && <div ref={sentinelRef} className="h-1" />}

          {isLoadingMore && (
            <p className="text-center text-xs font-medium text-muted animate-pulse py-4">
              {t('common.loadMore')}
            </p>
          )}

          {!isLoading && !hasMore && displayData.length > 0 && (
            <p className="text-center text-xs font-medium text-muted py-6">
              {t('common.endOfFeed')}
            </p>
          )}
        </div>
      </main>
      <aside className="hidden xl:block w-[320px] shrink-0 sticky top-[88px] max-h-[calc(100vh-88px)] overflow-y-auto hide-scrollbar pb-6 space-y-4">
        {isXl && <FreshnessHub compact />}
        <div className="px-2 pt-2 text-[11px] font-medium text-muted/80 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>&copy; 2026 Tear of God</span>
          <span>&bull;</span>
          <a href="#" className="hover:text-ink transition-colors">{t('sidebar.privacy')}</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-ink transition-colors">{t('sidebar.terms')}</a>
        </div>
      </aside>
    </div>
      <GuestAuthPrompt
        open={guestPrompt.open}
        next={guestPrompt.next}
        onClose={() => setGuestPrompt((prompt) => ({ ...prompt, open: false }))}
      />
    </div>
  );
}





















