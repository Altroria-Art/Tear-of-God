import TierRow from '../components/feed/TierRow';
import { buildTierRows } from '../lib/tiers';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, voteRanking } from '../lib/api'; // 📍 นำเข้า voteRanking สำหรับบันทึกโหวตลง Cloudflare
import { ThumbsUp, ThumbsDown, MessageSquare, Copy, Share2, Download, Heart } from 'lucide-react';
import { shareUrl } from '../lib/share';
import ShareExportModal from '../components/ui/ShareExportModal';
import ExportCard from '../components/ui/ExportCard';
import BookmarkButton from '../components/template/BookmarkButton';

import { timeAgo } from '../lib/format';
import { takeLastPublished } from '../lib/lastPublished';
import HomeLeftSidebar from '../components/feed/HomeLeftSidebar';
import HomeRightSidebar from '../components/feed/HomeRightSidebar';
import { useTranslation } from 'react-i18next';

// buildTierRows() now lives in src/lib/tiers.js — shared with PostDetail.jsx
// so Feed/Feed Detailed order and color tiers the same way Discover Detailed
// does, and no longer coerce unranked (tier=NULL) items into a fake "S" row.
// See docs/tier-list-feed-debug-plan.md.



import { useToast } from '../components/ui/Toast';

// 📍 [ลบ mockKindredData ทิ้งไปเรียบร้อย บอทจะไม่มากวนใจอีก!]

const PAGE_SIZE = 12

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0, initialUserVote = null, onShare, onExport }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const toast = useToast();

  // seed จาก post.user_vote ที่ API ส่งมาเท่านั้น — ห้าม useState(null) เฉยๆ
  // (ดู docs/feature-like-dislike-voting.md §8)
  const [userVote, setUserVote] = useState(initialUserVote);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);

  // state machine เดียวรับทั้ง like/dislike: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('feed.voteLogin'));
      navigate('/login');
      return;
    }

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
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-line-soft">
      <div className="flex items-center gap-6">
        <button type="button" aria-label={t('post.like')} aria-pressed={userVote === 'like'} onClick={() => handleVote('like')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'like' ? 'text-vote-up' : 'text-muted hover:text-ink'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </button>

        <button type="button" aria-label={t('post.dislike')} aria-pressed={userVote === 'dislike'} onClick={() => handleVote('dislike')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'dislike' ? 'text-vote-down' : 'text-muted hover:text-ink'}`}>
          <ThumbsDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{dislikes}</span>
        </button>

        <button type="button" aria-label={t('post.comments')} onClick={() => navigate(`/post/${id}#comments`)} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <MessageSquare size={18} />
          <span className="text-[13px] font-bold">{initialComments}</span>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={t('common.export')} onClick={onExport} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Download size={18} />
          <span className="text-[13px] font-bold">{t('common.export')}</span>
        </button>
        <button type="button" aria-label={t('common.share')} onClick={onShare} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Share2 size={18} />
          <span className="text-[13px] font-bold">{t('common.share')}</span>
        </button>
      </div>
    </div>
  );
}

function HomeTierCard({ post }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // 'share' | 'export' | null

  const hashtags = post.hashtags ? post.hashtags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const builtRows = buildTierRows(post.ranking_items, post.tiers);
  // ranking ที่ไม่มีไอเทมถูกจัดเลย (เคสหายาก) — โชว์การ์ดเปล่า 2 แถวเหมือนพฤติกรรมเดิม
  // แทนไม่มีอะไรให้ดูเลย
  const tierRows = builtRows.length > 0 ? builtRows : [
    { tier: 'S', color: undefined, index: 0, items: [] },
    { tier: 'A', color: undefined, index: 1, items: [] },
  ];

  return (
    <article className="bg-surface border border-line-soft rounded-[20px] p-6 shadow-sm">
      {/* Header Profile & Use Template Button */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
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
          <div>
            <h3
              className="text-[15px] font-bold text-ink leading-tight cursor-pointer hover:underline"
              onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}
            >
              {post.profile?.username || t('common.unknownUser')}
            </h3>
            <p
              className="text-[13px] text-muted font-medium cursor-pointer"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {timeAgo(post.created_at)}
            </p>
          </div>
        </div>

        <div className="flex gap-1.5">
          <BookmarkButton 
            template={{ id: post.template_id, is_saved: post.is_template_saved }} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-xs hover:bg-surface hover:text-ink hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
          />
          <button
            onClick={() => navigate(`/rank?template=${post.template_id || ''}`)}
            title={t('feed.useTemplate', { title: post.title })}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-xs hover:bg-surface hover:text-ink hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
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
              onClick={(e) => { e.stopPropagation(); navigate(`/discover/hashtag/${encodeURIComponent(cleanTag)}`); }}
              className="px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:border-line hover:shadow-sm transition-all flex items-center"
            >
              <span className="text-highlight mr-[2px]">#</span>
              {cleanTag}
            </span>
          );
        })}
      </div>

      {/* Title */}
      <h2
        onClick={() => navigate(`/post/${post.id}`)}
        className="text-xl font-extrabold mb-5 text-ink cursor-pointer hover:text-highlight transition-colors"
      >
        {post.title}
      </h2>

      <div className="space-y-1.5 mb-4">
        {tierRows.map(row => <TierRow key={row.tier} tier={row.tier} color={row.color} index={row.index} items={row.items.map(ri => ({ id: ri.id, name: ri.item?.name || ri.item_id, image_url: ri.item?.image_url }))} />)}
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
      />

      {modal !== null && (
        <ShareExportModal
          open={modal !== null}
          mode={modal}
          onClose={() => setModal(null)}
          link={shareUrl(`/post/${post.id}`)}
          preview={
            <ExportCard
              title={post.title}
              authorName={post.profile?.username}
              authorAvatar={post.profile?.avatar_url}
              postedAt={timeAgo(post.created_at)}
              category={post.category}
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

export default function HomeFeed() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true) // หน้าแรกเท่านั้น — กันจอกระพริบตอน append หน้าถัดไป
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState('general');
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

  // 📍 per-tab cache — ดู docs/row-read-optimization-plan.md §6/§8: สลับ General↔Kindred
  // เดิมยิง fetchRankings ใหม่ทุกครั้ง ทั้งที่ backend ยังไม่รองรับ feedType จริง (ดูหมายเหตุ
  // ด้านล่าง) แคชผลของแต่ละแท็บ+ผู้ใช้ไว้ใน ref นี้ — สลับแท็บที่เคยโหลดแล้วไม่ต้องยิงซ้ำอีก
  // (รวมหน้าที่ scroll ต่อไว้ด้วย ไม่ใช่แค่หน้าแรก)
  const feedCacheRef = useRef({})
  const cacheKey = `${activeTab}:${currentUser?.id ?? 'anon'}`

  // 🟡 [ใหม่]: feed_type/seed ถูก forward ไป backend แล้ว — functions/api/rankings.js อ่านค่าจริง
  // (ดู docs/row-read-optimization-plan.md §14.7 #11):
  //   general = สุ่ม seeded ทั้ง pool ตั้งแต่หน้าแรก (backend สับทั้ง pool; ไม่มีโซนใหม่ล่าสุดคั่นหัว)
  //   kindred = pool โพสต์ที่เกี่ยวข้องจริง (ต้องตรง ≥ 2 สัญญาณ: หมวด/template/แฮชแท็ก)
  //             แล้วสุ่มในนั้น; ไม่ล็อกอิน → backend ส่ง kindredLocked หน้าบ้านชวนเข้าสู่ระบบ
  // seed สุ่มใหม่ทุกครั้งที่ mount (เปิด/โหลดหน้าใหม่ = ลำดับใหม่); cache ระหว่าง session ยังเก็บผลต่อ tab
  const feedType = activeTab;
  const kindredLocked = activeTab === 'kindred' && !currentUser;
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  // 📍 [ใหม่]: ranking ที่เพิ่ง publish ของฉัน — ขึ้นการ์ดแรกหน้า Home แค่ mount แรกหลัง publish
  // (ได้จาก src/lib/lastPublished.js; F5/เข้าหน้าใหม่ = module reset → null → สับสุ่มตามเดิม)
  // ส่ง pin ต่อทุกหน้า (loadMore) เพื่อให้ backend slice จาก shuffle ชุดเดียวกัน ไม่ซ้ำ/ไม่ข้าม
  const pinnedIdRef = useRef(null);

  // สลับแท็บ/ล็อกอิน ต้องเริ่มฟีดใหม่ตั้งแต่หน้า 1 เสมอ ไม่งั้นข้อมูลแท็บเก่าจะค้าง
  // ปนกับแท็บใหม่ตอน infinite scroll ต่อท้าย — เว้นแต่มี cache ของ key นี้อยู่แล้ว
  useEffect(() => {
    let cancelled = false
    if (kindredLocked) {
      setPosts([])
      setHasMore(false)
      setIsLoading(false)
      return
    }
    const cached = feedCacheRef.current[cacheKey]
    if (cached) {
      setPosts(cached.posts)
      pageRef.current = cached.page
      setHasMore(cached.hasMore)
      setIsLoading(false)
      return
    }

    async function loadFirstPage() {
      setIsLoading(true)
      setPosts([])
      pageRef.current = 1
      setHasMore(true)
      loadingRef.current = true
      // consume pin ครั้งเดียวตอน mount (ครั้งถัดไป/เข้าหน้าใหม่ = ไม่มีอีก → กลับสุ่ม)
      pinnedIdRef.current = takeLastPublished(currentUser?.id)
      const { data } = await fetchRankings({
        userId: currentUser?.id,
        feedType,
        seed: seedRef.current,
        pin: pinnedIdRef.current || undefined,
        page: 1,
        limit: PAGE_SIZE
      })
      if (cancelled) return
      const nextHasMore = (data?.length || 0) === PAGE_SIZE
      setPosts(data || [])
      setHasMore(nextHasMore)
      setIsLoading(false)
      loadingRef.current = false
      feedCacheRef.current[cacheKey] = { posts: data || [], page: 1, hasMore: nextHasMore }
    }
    loadFirstPage()
    return () => { cancelled = true }
  }, [currentUser, activeTab, cacheKey, feedType, kindredLocked]);

  // ไม่มี total จาก API สำหรับฟีดทั่วไป (เฉพาะ template_id เท่านั้นที่ API คำนวณ total ให้ —
  // ดู functions/api/rankings.js) เลยเช็คจบฟีดจากจำนวนที่ได้กลับมาน้อยกว่า PAGE_SIZE แทน
  const loadMore = useCallback(async () => {
    if (kindredLocked || loadingRef.current || !hasMore) return
    loadingRef.current = true
    // 📍 ใช้ pageRef ไม่ใช่ closure `page` — ถ้า observer เก่ายิงค้างมาก่อน React commit
    // re-render (ที่จะ re-attach observer ใหม่) จะได้ร่างหน้าถัดไปที่ถูกต้อง ไม่ fetch ซ้ำหน้าเดิม
    const nextPage = pageRef.current + 1
    pageRef.current = nextPage
    setIsLoadingMore(true)
    const { data } = await fetchRankings({
      userId: currentUser?.id,
      feedType,
      seed: seedRef.current,
      pin: pinnedIdRef.current || undefined,
      page: nextPage,
      limit: PAGE_SIZE
    })
    setPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newPosts = (data || []).filter(p => !existingIds.has(p.id));
      const merged = [...prev, ...newPosts]
      const nextHasMore = (data?.length || 0) === PAGE_SIZE
      feedCacheRef.current[cacheKey] = { posts: merged, page: nextPage, hasMore: nextHasMore }
      return merged
    })
    setHasMore((data?.length || 0) === PAGE_SIZE)
    setIsLoadingMore(false)
    loadingRef.current = false
  }, [hasMore, currentUser, cacheKey, feedType, kindredLocked]);

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
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`rounded-full px-7 py-1.5 text-xs font-bold transition-all duration-200 ${
              activeTab === 'general'
                ? 'bg-brand text-canvas shadow-xs scale-100'
                : 'text-muted hover:text-ink hover:bg-surface-glass scale-95'
            }`}
          >
            {t('feed.general')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kindred')}
            className={`rounded-full px-7 py-1.5 text-xs font-bold transition-all duration-200 ${
              activeTab === 'kindred'
                ? 'bg-brand text-canvas shadow-xs scale-100'
                : 'text-muted hover:text-ink hover:bg-surface-glass scale-95'
            }`}
          >
            {t('feed.kindred')}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 flex gap-8 pt-3 pb-12 items-start justify-center">
        <aside className="hidden lg:block w-[240px] shrink-0 sticky top-[92px] max-h-[calc(100vh-92px)] overflow-y-auto hide-scrollbar pb-6">
          <HomeLeftSidebar />
        </aside>
        <main className="w-full max-w-2xl shrink">
        <div className="space-y-6">
          {isLoading && (
            <p className="text-center text-sm font-medium text-muted animate-pulse py-10">
              {t('feed.loadingYourFeed')}
            </p>
          )}

          {!isLoading && !kindredLocked && displayData.length === 0 && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <p className="text-muted font-medium">{t('feed.empty')}</p>
              <button onClick={() => navigate('/create')} className="mt-4 text-sm font-bold text-brand hover:underline">
                {t('feed.emptyCta')}
              </button>
            </div>
          )}

          {/* Kindred ต้องล็อกอิน — สลับแท็บแล้วเห็นต่างชัด แทนการ fallback เงียบๆ */}
          {!isLoading && kindredLocked && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <div className="mx-auto mb-4 w-12 h-12 flex items-center justify-center rounded-full bg-surface-glass text-brand">
                <Heart size={24} />
              </div>
              <p className="text-base font-bold text-ink">{t('feed.kindredLockedTitle')}</p>
              <p className="mt-2 text-sm text-muted font-medium">{t('feed.kindredLockedDesc')}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-5 px-5 py-2.5 bg-brand text-canvas text-sm font-bold rounded-full shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
              >
                {t('feed.kindredLoginCta')}
              </button>
            </div>
          )}

          {!isLoading && displayData.map((post) => (
            <HomeTierCard key={post.id} post={post} />
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
      <aside className="hidden xl:block w-[300px] shrink-0 sticky top-[88px] max-h-[calc(100vh-88px)] overflow-y-auto hide-scrollbar pb-6">
        <HomeRightSidebar />
      </aside>
    </div>
    </div>
  );
}





















