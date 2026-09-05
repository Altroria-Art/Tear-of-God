import TierLabel from '../components/tier/TierLabel';
import { buildTierRows } from '../lib/tiers';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, voteRanking } from '../lib/api'; // 📍 นำเข้า voteRanking สำหรับบันทึกโหวตลง Cloudflare
import { ThumbsUp, ThumbsDown, MessageSquare, Copy, Share2, Download } from 'lucide-react';
import { shareUrl } from '../lib/share';
import ShareExportModal from '../components/ui/ShareExportModal';
import ExportCard from '../components/ui/ExportCard';

import { timeAgo } from '../lib/format';
import HomeLeftSidebar from '../components/feed/HomeLeftSidebar';
import HomeRightSidebar from '../components/feed/HomeRightSidebar';
import { SkeletonFeedList } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

// buildTierRows() now lives in src/lib/tiers.js — shared with PostDetail.jsx
// so Feed/Feed Detailed order and color tiers the same way Discover Detailed
// does, and no longer coerce unranked (tier=NULL) items into a fake "S" row.
// See docs/tier-list-feed-debug-plan.md.



// 📍 [ลบ mockKindredData ทิ้งไปเรียบร้อย บอทจะไม่มากวนใจอีก!]

const PAGE_SIZE = 5

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0, initialUserVote = null, onShare, onExport }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();

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
        <div onClick={() => handleVote('like')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'like' ? 'text-vote-up' : 'text-muted hover:text-ink'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </div>

        <div onClick={() => handleVote('dislike')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'dislike' ? 'text-vote-down' : 'text-muted hover:text-ink'}`}>
          <ThumbsDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{dislikes}</span>
        </div>

        <div onClick={() => navigate(`/post/${id}#comments`)} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <MessageSquare size={18} />
          <span className="text-[13px] font-bold">{initialComments}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div onClick={onExport} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Download size={18} />
          <span className="text-[13px] font-bold">{t('common.export')}</span>
        </div>
        <div onClick={onShare} className="flex items-center gap-1.5 text-muted hover:text-highlight cursor-pointer transition-colors">
          <Share2 size={18} />
          <span className="text-[13px] font-bold">{t('common.share')}</span>
        </div>
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

        <button
          onClick={() => navigate('/create', { state: { templateName: post.title } })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-glass border border-line-soft text-ink-soft text-xs font-bold rounded-full transition-all shadow-sm hover:bg-surface hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <Copy size={12} strokeWidth={2.5} />
          <span>{t('feed.useTemplate', { title: post.title })}</span>
        </button>
      </div>

      {/* Hashtags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {hashtags.slice(0, 4).map((tag, idx) => {
          const cleanTag = tag.trim().replace('#', '');
          return (
            <span
              key={idx}
              onClick={(e) => { e.stopPropagation(); navigate(`/discover/hashtag/${encodeURIComponent(cleanTag)}`); }}
              className="px-3 py-1 rounded-md bg-surface-glass text-ink-soft text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:bg-surface transition-colors"
            >
              #{cleanTag}
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

      {/* Tier List Preview Blocks */}
      <div className="space-y-2 mb-6">
        {tierRows.map((row) => (
          <div key={row.tier} className="flex bg-tag rounded-xl border border-line-soft overflow-hidden min-h-[50px] shadow-sm items-stretch">
            <TierLabel label={row.tier} color={row.color} index={row.index} className="w-14 font-black text-lg" />
            <div className="p-2.5 flex gap-2 overflow-hidden items-center flex-grow flex-wrap bg-tag min-w-0">
              {row.items.map((ri, idx) => (
                <div
                  key={ri.id ?? idx}
                  className="flex h-20 w-20 shrink-0 items-center justify-center bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg p-2 text-center text-xs break-words"
                >
                  <span className="w-full line-clamp-2 text-[11px] leading-normal">{ri.item?.name || ri.item_id || t('common.unknownItem')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
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
              items: row.items.map((ri) => ri.item?.name || ri.item_id || t('common.unknownItem')),
            }))}
          />
        }
        filename={`feed-${post.id}.png`}
      />
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
  const loadingRef = useRef(false) // กันยิงซ้ำตอนเลื่อนเร็วๆ หรือ observer ยิงซ้อนตอนกำลังโหลดอยู่
  const observerRef = useRef(null) // instance ของ IntersectionObserver ตัวปัจจุบัน (ผูกกับ sentinel node ล่าสุด)
  const pageRef = useRef(1) // หน้าล่าสุดที่ fetch ไป — loadMore อ่านที่นี่ ไม่ใช่ closure `page` ที่ค้าง

  // 📍 per-tab cache — ดู docs/row-read-optimization-plan.md §6/§8: สลับ General↔Kindred
  // เดิมยิง fetchRankings ใหม่ทุกครั้ง ทั้งที่ backend ยังไม่รองรับ feedType จริง (ดูหมายเหตุ
  // ด้านล่าง) แคชผลของแต่ละแท็บ+ผู้ใช้ไว้ใน ref นี้ — สลับแท็บที่เคยโหลดแล้วไม่ต้องยิงซ้ำอีก
  // (รวมหน้าที่ scroll ต่อไว้ด้วย ไม่ใช่แค่หน้าแรก)
  const feedCacheRef = useRef({})
  const cacheKey = `${activeTab}:${currentUser?.id ?? 'anon'}`

  // ⚠️ known gap (ตั้งใจไม่แก้ในรอบนี้ — ดูแผนใน docs/row-read-optimization-plan.md §5/§8):
  // fetchRankings() ส่ง feedType ไปจริง แต่ src/lib/api.js ไม่เคยแปลงมันเป็น query param และ
  // functions/api/rankings.js ก็ไม่เคยอ่านค่านี้เลย — General กับ Kindred เลยยิง query เดียวกัน
  // เป๊ะ ได้ผลลัพธ์เดียวกัน (TC-08 ต้องการให้ Kindred โชว์เฉพาะ template ที่เคยสร้าง/เคยเล่น/
  // ใกล้เคียง ซึ่งยังไม่ implement) การแก้ตอนนี้แค่ "หยุดยิงซ้ำโดยไม่จำเป็น" ไม่ใช่ทำให้ผลต่างกัน
  const feedType = activeTab;

  // สลับแท็บ/ล็อกอิน ต้องเริ่มฟีดใหม่ตั้งแต่หน้า 1 เสมอ ไม่งั้นข้อมูลแท็บเก่าจะค้าง
  // ปนกับแท็บใหม่ตอน infinite scroll ต่อท้าย — เว้นแต่มี cache ของ key นี้อยู่แล้ว
  useEffect(() => {
    let cancelled = false
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
      const { data } = await fetchRankings({
        userId: currentUser?.id,
        feedType,
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
  }, [currentUser, activeTab, cacheKey, feedType]);

  // ไม่มี total จาก API สำหรับฟีดทั่วไป (เฉพาะ template_id เท่านั้นที่ API คำนวณ total ให้ —
  // ดู functions/api/rankings.js) เลยเช็คจบฟีดจากจำนวนที่ได้กลับมาน้อยกว่า PAGE_SIZE แทน
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    // 📍 ใช้ pageRef ไม่ใช่ closure `page` — ถ้า observer เก่ายิงค้างมาก่อน React commit
    // re-render (ที่จะ re-attach observer ใหม่) จะได้ร่างหน้าถัดไปที่ถูกต้อง ไม่ fetch ซ้ำหน้าเดิม
    const nextPage = pageRef.current + 1
    pageRef.current = nextPage
    setIsLoadingMore(true)
    const { data } = await fetchRankings({
      userId: currentUser?.id,
      feedType,
      page: nextPage,
      limit: PAGE_SIZE
    })
    setPosts(prev => {
      const merged = [...prev, ...(data || [])]
      const nextHasMore = (data?.length || 0) === PAGE_SIZE
      feedCacheRef.current[cacheKey] = { posts: merged, page: nextPage, hasMore: nextHasMore }
      return merged
    })
    setHasMore((data?.length || 0) === PAGE_SIZE)
    setIsLoadingMore(false)
    loadingRef.current = false
  }, [hasMore, currentUser, activeTab, cacheKey, feedType]);

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
      {/* Tab Navigation */}
      <div className="sticky top-[73px] z-10 glass-nav border-b border-line-soft backdrop-blur-xl py-3">
        <div className="mx-auto flex max-w-fit rounded-full bg-surface border border-line-soft p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`rounded-full px-8 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'general'
                ? 'bg-brand text-canvas shadow-md scale-100'
                : 'text-muted hover:text-ink scale-95 hover:bg-surface-glass'
            }`}
          >
            {t('feed.general')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kindred')}
            className={`rounded-full px-8 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'kindred'
                ? 'bg-brand text-canvas shadow-md scale-100'
                : 'text-muted hover:text-ink scale-95 hover:bg-surface-glass'
            }`}
          >
            {t('feed.kindred')}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 flex gap-8 py-8 items-start justify-center"><aside className="hidden lg:block w-[240px] shrink-0 sticky top-[140px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar pb-6"><HomeLeftSidebar /></aside><main className="w-full max-w-2xl shrink">
        <div className="space-y-6 mt-4">
          {isLoading && (
            <SkeletonFeedList />
          )}

          {!isLoading && displayData.length === 0 && (
            <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft shadow-sm">
              <p className="text-muted font-medium">{t('feed.empty')}</p>
              <button onClick={() => navigate('/create')} className="mt-4 text-sm font-bold text-brand hover:underline">
                {t('feed.emptyCta')}
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
      </main><aside className="hidden xl:block w-[300px] shrink-0 sticky top-[140px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar pb-6"><HomeRightSidebar /></aside></div>
    </div>
  );
}





















