import BackButton from '../components/ui/BackButton';
import { ArrowLeft as BackArrow } from 'lucide-react';
import { parseHashtags } from '../lib/hashtags';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { returnPath } from '../lib/navigation';
import { ThumbsUp, MessageSquare, Crown, Pin, Award, LayoutGrid, Swords, Bookmark, Plus } from 'lucide-react';
import BadgeGallery from '../components/user/BadgeGallery';
import SavedTopics from '../components/template/SavedTopics';
import { useUser } from '../context/UserContext';
import { fetchRankings, fetchRanking, updateProfile, equipBadge, fetchUserProfile, toggleFollow, fetchFollowList, uploadImage, setProfilePin, fetchUserDuels } from '../lib/api';
import { timeAgo, formatDbDate } from '../lib/format';
import { buildTierRows } from '../lib/tiers';
import { normalizeImageUrl } from '../lib/images';
import { getBadgeStates } from '../lib/badges';
import { FACULTIES, UP_UNIVERSITY_NAME, getMajorsForFaculty, getAdmissionYears } from '../lib/university';
import TierLabel from '../components/tier/TierLabel';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Avatar from '../components/ui/Avatar';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

function MiniTierItem({ item, t }) {
  const [imgError, setImgError] = useState(false);

  const rawName = item?.item?.name || item?.item?.title || item?.name || item?.title || item?.item_id || t('common.unknownItem');
  const itemName = typeof rawName === 'object' ? t('common.unknownItem') : String(rawName || '');

  const itemImg = normalizeImageUrl(item?.item?.image_url || item?.image_url || item?.image);

  return (
    <div
      className="flex flex-col items-center justify-center w-9 h-9 shrink-0 overflow-hidden rounded-md border border-line-soft bg-surface p-1 text-[9px] font-semibold text-ink text-center"
      title={itemName}
    >
      {itemImg && !imgError ? (
        <img
          src={itemImg}
          alt=""
          className="w-full h-full object-cover rounded-sm pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : null}
      {(!itemImg || imgError) && <span className="profile-preview-item-name w-full min-w-0 break-words line-clamp-2 leading-tight">{itemName}</span>}
    </div>
  );
}

function MiniTierTile({ post, isPinned, isOwnProfile, pinBusy, onTogglePin, onSelect, t }) {
  const rows = buildTierRows(post.ranking_items, post.tiers);
  const previewRows = rows.slice(0, 2);
  const hashtags = parseHashtags(post.hashtags);

  return (
    <article
      onClick={onSelect}
      role="button"
      aria-label={post.title}
      tabIndex={0}
      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(); } }}
      className={`profile-ranking-tile group relative flex flex-col overflow-hidden border border-line-soft hover:border-brand/40 transition-colors cursor-pointer text-left select-none bg-surface/60 min-w-0`}
    >
      {/* Top Visual Thumbnail Area — pt-13 reserves a CONSTANT slot for the pinned + type
          badges so tier rows never shift whether the list is pinned or not */}
      <div className="relative bg-canvas/40 pt-13 pb-2 px-2 sm:px-2.5 flex flex-col justify-center gap-1.5 border-b border-line-soft/50">
        {/* Pinned badge — own absolute layer at top-left, never pushes the other badges */}
        {isPinned && (
          <span className="absolute top-2 left-2 z-20 inline-flex items-center gap-1 bg-brand text-canvas text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-xs shrink-0">
            <Pin size={10} fill="currentColor" />
            <span>{t('profile.pinnedTag')}</span>
          </span>
        )}

        {/* TikTok-style Type badge (Original / From Template) — separate from hashtag row */}
        <div className="absolute left-2 top-8 z-10 flex items-center">
          {post.is_original !== false ? (
            <span
              title={t('profile.badgeOriginal')}
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-line-soft/80 bg-surface/90 text-ink-soft shadow-2xs backdrop-blur-xs shrink-0"
            >
              {t('profile.badgeOriginal')}
            </span>
          ) : (
            <span
              title={t('profile.usedTemplateTooltip', { title: post.template_title || post.title })}
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-highlight/40 bg-highlight/15 text-highlight shadow-2xs backdrop-blur-xs shrink-0"
            >
              {t('profile.badgeTemplate')}
            </span>
          )}
        </div>

        {/* Pin action toggle button (Owner only) */}
        {isOwnProfile && (
          <button
            type="button"
            onClick={(e) => onTogglePin(e, post)}
            disabled={pinBusy}
            title={isPinned ? t('profile.unpinList') : t('profile.pinList')}
            aria-label={isPinned ? t('profile.unpinList') : t('profile.pinList')}
            className={`absolute top-2 right-2 z-10 min-h-11 min-w-11 grid place-items-center rounded-full backdrop-blur-md border border-line-soft transition-all shadow-sm ${
              isPinned
                ? 'bg-brand text-canvas'
                : 'bg-surface/90 text-muted sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 hover:text-brand hover:bg-brand/10'
            }`}
          >
            <Pin size={11} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Miniature Tier Preview Rows */}
        {previewRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted font-medium">
            {t('profile.createdTemplate')}
          </div>
        ) : (
          previewRows.map((row, rIdx) => (
            <div
              key={row.tier + String(rIdx)}
              className="flex items-center gap-1.5 rounded-xl bg-surface/75 backdrop-blur-xs border border-line-soft/60 px-1.5 py-1 min-h-[38px] sm:min-h-[42px] overflow-hidden"
            >
              <TierLabel
                label={row.tier}
                color={row.color}
                index={row.index}
                className="w-9 min-h-9 rounded-lg text-[10px] font-black shrink-0 shadow-xs"
              />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {row.items.slice(0, 2).map((ri, iIdx) => (
                  <MiniTierItem key={ri.id ?? iIdx} item={ri} t={t} />
                ))}
                {row.items.length > 2 && (
                  <span className="text-[9px] font-bold text-muted shrink-0 px-1">
                    +{row.items.length - 2}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Metadata & Stats */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-2 min-w-0">
        <div className="profile-ranking-caption space-y-1.5 min-w-0">
          <h4
            className="font-bold text-sm text-ink line-clamp-2 leading-snug group-hover:text-brand transition-colors"
            title={post.title}
          >
            {post.title}
          </h4>

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  title={tag}
                  className="max-w-full truncate rounded border border-line-soft/80 bg-surface/90 text-muted px-2 py-0.5 text-xs font-semibold select-none"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted pt-1.5 border-t border-line-soft/40">
          <span>{timeAgo(post.created_at)}</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <ThumbsUp size={11} /> {post.stats?.likes || 0}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare size={11} /> {post.stats?.comments || 0}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEducationSetup = new URLSearchParams(location.search).get('setup') === 'education';
  const { userId: routeUserId } = useParams(); // 📍 /profile/:userId = ดูโปรไฟล์คนอื่น, /profile = ของตัวเอง
  const { currentUser, login } = useUser();
  const toast = useToast();
  const { t, i18n } = useTranslation();
  
  const profileUserId = routeUserId || currentUser?.id || null;
  const isOwnProfile = !routeUserId || routeUserId === currentUser?.id;

  const [posts, setPosts] = useState([]);
  const [extraPins, setExtraPins] = useState([]);
  const [postPage, setPostPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const loadingPostsRef = useRef(false);
  const profileScope = `${profileUserId}:${currentUser?.id || 'guest'}`;
  const profileScopeRef = useRef(profileScope);
  profileScopeRef.current = profileScope;
  const followPendingRef = useRef(false);
  const [followPending, setFollowPending] = useState(false);
  const followRequestRef = useRef(0);
  const [profileUser, setProfileUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const closeProfileEditor = () => {
    if (savingRef.current) return;
    setIsEditOpen(false);
    if (isEducationSetup) navigate(returnPath(location.search), { replace: true });
  };
  useEffect(() => {
    if (isEducationSetup && isOwnProfile && currentUser?.id) setIsEditOpen(true);
  }, [isEducationSetup, isOwnProfile, currentUser?.id]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [studiedAtUp, setStudiedAtUp] = useState(false);
  const [facultyValue, setFacultyValue] = useState('');
  const [majorValue, setMajorValue] = useState('');
  const [admissionYear, setAdmissionYear] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 📍 ปีที่เข้าศึกษา (รหัสรุ่น) สร้างจากวันที่ปัจจุบัน: 38 (=พ.ศ.2538) ถึงสองหลักปี พ.ศ. ปัจจุบัน
  // เดินเพิ่มเองทุกต้นปี ไม่ต้องแก้ไฟล์ — ดู src/lib/university.js
  const admissionYears = useMemo(() => getAdmissionYears().reverse(), []);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [followListModal, setFollowListModal] = useState(null); // 'followers' | 'following' | null
  const [followListData, setFollowListData] = useState([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);
  const [pinBusyId, setPinBusyId] = useState(null);
  const [isBadgesOpen, setIsBadgesOpen] = useState(false);
  const [isEquippingBadge, setIsEquippingBadge] = useState(false);
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const postTab = ['pinned', 'duels', 'saved'].includes(requestedTab) ? requestedTab : 'all';
  const setPostTab = (tab) => {
    const params = new URLSearchParams(location.search);
    if (tab === 'all') params.delete('tab');
    else params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true, state: location.state });
  };
  const [duels, setDuels] = useState([]);
  const [duelTotal, setDuelTotal] = useState(0);
  const [duelPage, setDuelPage] = useState(1);
  const [isDuelsLoading, setIsDuelsLoading] = useState(false);

  useEffect(() => {
    if (postTab !== 'duels' || !profileUserId) return;
    let cancelled = false;
    setIsDuelsLoading(true);
    fetchUserDuels({ userId: profileUserId, page: duelPage, limit: 10 }).then((res) => {
      if (cancelled) return;
      if (res?.success && Array.isArray(res.data)) {
        setDuels(res.data);
        setDuelTotal(res.total || 0);
      }
      setIsDuelsLoading(false);
    });
    return () => { cancelled = true; };
  }, [postTab, profileUserId, duelPage]);

  const handleOpenFollowList = async (type) => {
    const requestId = ++followRequestRef.current;
    const scope = profileScope;
    setFollowListModal(type);
    setIsFollowListLoading(true);
    setFollowListData([]);
    const { data, error } = await fetchFollowList(profileUserId, type);
    if (requestId !== followRequestRef.current || scope !== profileScopeRef.current) return;
    if (!error && data) {
      setFollowListData(data);
    } else {
      toast.error(t('profile.errFetch'));
    }
    setIsFollowListLoading(false);
  };

  // ยังไม่ล็อกอินและไม่ระบุ user ใน URL = ไม่รู้จะดูโปรไฟล์ใคร → พาไปหน้าล็อกอิน
  // (ส่วน /profile/:userId เปิดดูแบบไม่ล็อกอินได้ เพราะเป็นข้อมูลสาธารณะ)
  useEffect(() => {
    if (!currentUser && !routeUserId) navigate('/login');
  }, [currentUser, routeUserId, navigate]);

  // 📍 โหลดโปรไฟล์ + โพสต์ของเจ้าของโปรไฟล์ที่กำลังดู (ตัวเองหรือคนอื่นก็ใช้ flow เดียวกัน)
  // เดิมโหลด "ทุกโพสต์ในระบบ" แ้วมา filter ด้วย username ฝั่ง client — พังทันทีที่คน rename
  // และโหลดได้แค่ 50 โพสต์แรกเท่านั้น ตอนนี้กรองฝั่ง server ด้วย author_id แทน
  useEffect(() => {
    if (!profileUserId) return;
    let cancelled = false;
    setProfileUser(null);
    setPosts([]);
    setExtraPins([]);
    setPostPage(1);
    setHasMorePosts(false);
    setPostsError(false);
    setLoadingPosts(false);
    loadingPostsRef.current = false;
    setFollowPending(false);
    followPendingRef.current = false;
    setFollowListModal(null);
    setDuels([]);
    setDuelTotal(0);
    setDuelPage(1);
    setNotFound(false);
    setIsLoading(true);

    async function loadProfile() {
      const { data, error } = await fetchUserProfile(profileUserId, currentUser?.id);
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setProfileUser(data);
      setIsFollowing(data.is_following || false);
      setFollowersCount(data.followers_count || 0);
      setFollowingCount(data.following_count || 0);

      const { data: postData, error: postError } = await fetchRankings({
        authorId: profileUserId,
        sort: 'recent',
        limit: 50,
      });
      if (!cancelled) {
        setPostsError(!!postError);
        setHasMorePosts(!postError && (postData || []).length === 50);
        setPosts(postData || []);
        setIsLoading(false);
        const loadedIds = new Set((postData || []).map(post => post.id));
        const missingPins = (data.taste_identity?.pinned_rankings || [])
          .filter(pin => !loadedIds.has(pin.ranking_id || pin.id)).slice(0, 3);
        if (missingPins.length) {
          const pins = await Promise.all(missingPins.map(pin => fetchRanking(pin.ranking_id || pin.id)));
          if (!cancelled) setExtraPins(pins.map(result => result.data).filter(Boolean));
        }
      }
    }
    loadProfile();
    return () => { cancelled = true };
  }, [profileUserId, currentUser?.id, profileRetry]);

  const loadMorePosts = async () => {
    if (loadingPostsRef.current) return;
    const scope = profileScope;
    loadingPostsRef.current = true;
    setLoadingPosts(true);
    const result = await fetchRankings({ authorId: profileUserId, sort: 'recent', limit: 50, page: postPage + 1 });
    if (scope !== profileScopeRef.current) return;
    if (result.error || result.success === false) toast.error(result.error || t('profile.errFetch'));
    else {
      setPosts(previous => {
        const ids = new Set(previous.map(post => post.id));
        return [...previous, ...(result.data || []).filter(post => !ids.has(post.id))];
      });
      setPostPage(page => page + 1);
      setHasMorePosts((result.data || []).length === 50);
    }
    loadingPostsRef.current = false;
    setLoadingPosts(false);
  };

  // ฟอร์มแก้ไข (เฉพาะโปรไฟล์ตัวเอง) sync กับ user ล่าสุดใน context —
  // ใช้ profileUserId เป็น dep หลัก (เปลี่ยนเฉพาะตอนสลับหน้าใหม่) ไม่ใช่ currentUser
  // ที่ context เปลี่ยนบ่อยๆ ไม่งั้นจะล้างฟอร์มที่กำลังพิมพ์ทิ้งทุกครั้งที่ state เปลี่ยน
  const initialUserIdRef = useRef(null);
  useEffect(() => {
    if (isEditOpen && initialUserIdRef.current === profileUserId) return;
    if (initialUserIdRef.current !== profileUserId) {
      initialUserIdRef.current = profileUserId;
    }
    if (isOwnProfile && currentUser) {
      setDisplayName(currentUser.username || '');
      setBio(currentUser.bio || '');
      // 📍 ค่าจาก dropdown เท่านั้น: ถ้าข้อมูลเดิมไม่ตรงกับคณะ/สาขา/ปีที่รู้จัก ให้จับเป็นค่าว่าง
      // (ข้อมูลเก่าถูกล้างไปแล้วจาก migrations/0011_profile_education_reset.sql)
      const storedFaculty = currentUser.faculty || '';
      const matchedFaculty = FACULTIES.some((f) => f.name === storedFaculty) ? storedFaculty : '';
      const storedMajor = currentUser.major || '';
      const matchedMajor = matchedFaculty && getMajorsForFaculty(matchedFaculty).includes(storedMajor) ? storedMajor : '';
      const storedYear = String(currentUser.year || '');
      setStudiedAtUp(currentUser.university ? true : (isEducationSetup ? null : false));
      setFacultyValue(matchedFaculty);
      setMajorValue(matchedMajor);
      setAdmissionYear(admissionYears.includes(storedYear) ? storedYear : '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [profileUserId, isOwnProfile, currentUser, admissionYears, isEducationSetup, isEditOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (!savingRef.current) {
          setIsEditOpen(false);
          if (isEducationSetup && isOwnProfile && isEditOpen) navigate(returnPath(location.search), { replace: true });
        }
        setFollowListModal(null);
      }
    };
    if (isEditOpen || followListModal) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isEditOpen, followListModal, isEducationSetup, isOwnProfile, location.search, navigate]);

  const handleToggleFollow = async () => {
    if (followPendingRef.current) return;
    if (!currentUser) {
      toast.error(t('profile.errLoginFollow'));
      navigate('/login');
      return;
    }
    
    const scope = profileScope;
    followPendingRef.current = true;
    setFollowPending(true);
    // Optimistic UI update
    const previousFollowing = isFollowing;
    const previousCount = followersCount;
    
    setIsFollowing(!previousFollowing);
    setFollowersCount(previousCount + (previousFollowing ? -1 : 1));
    
    const { error } = await toggleFollow(currentUser.id, displayUser.id, previousFollowing);
    if (scope !== profileScopeRef.current) return;
    followPendingRef.current = false;
    setFollowPending(false);
    
    if (error) {
      toast.error(t('profile.errAction'));
      setIsFollowing(previousFollowing);
      setFollowersCount(previousCount);
    }
  };

  const handleTogglePin = async (event, post) => {
    event.stopPropagation();
    if (!isOwnProfile || !post?.id || pinBusyId) return;

    const currentPins = profileUser?.taste_identity?.pinned_rankings || [];
    const isPinned = currentPins.some((item) => item.ranking_id === post.id || item.id === post.id);

    if (!isPinned && currentPins.length >= 3) {
      toast.warning(t('profile.pinLimitReached'));
      return;
    }

    const position = isPinned ? 0 : Math.min(currentPins.length, 2);
    setPinBusyId(post.id);
    const result = await setProfilePin(post.id, !isPinned, position);

    if (!result?.success) {
      toast.error(result?.error || t('profile.pinFailed'));
      setPinBusyId(null);
      return;
    }

    const nextPins = isPinned
      ? currentPins.filter((item) => item.ranking_id !== post.id && item.id !== post.id)
      : [...currentPins, {
          id: post.id,
          ranking_id: post.id,
          position,
          title: post.title,
          description: post.description,
          hashtags: post.hashtags,
          template_id: post.template_id,
          stats: post.stats,
          created_at: post.created_at,
        }].slice(0, 3);

    setProfileUser((previous) => previous
      ? { ...previous, taste_identity: { ...(previous.taste_identity || {}), pinned_rankings: nextPins } }
      : previous);
    toast.success(t(isPinned ? 'profile.unpinSuccess' : 'profile.pinSuccess'));
    setPinBusyId(null);
  };

  const handleEquipBadge = async (badgeId, badgeMeta = null) => {
    if (!isOwnProfile || !currentUser || isEquippingBadge) return;
    const prevBadgeId = displayUser?.equipped_badge_id ?? null;
    const prevBadgeMeta = displayUser?.equipped_badge_meta ?? null;
    const nextBadgeObj = badgeId ? { id: badgeId, ...(badgeMeta || {}) } : null;

    setIsEquippingBadge(true);
    setProfileUser((prev) => prev ? {
      ...prev,
      equipped_badge_id: badgeId,
      equipped_badge_meta: badgeMeta,
      equipped_badge: nextBadgeObj,
    } : prev);
    login({
      ...currentUser,
      equipped_badge_id: badgeId,
      equipped_badge_meta: badgeMeta,
      equipped_badge: nextBadgeObj,
    });

    try {
      const res = await equipBadge(badgeId, badgeMeta);
      if (!res?.success) {
        setProfileUser((prev) => prev ? {
          ...prev,
          equipped_badge_id: prevBadgeId,
          equipped_badge_meta: prevBadgeMeta,
          equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
        } : prev);
        login({
          ...currentUser,
          equipped_badge_id: prevBadgeId,
          equipped_badge_meta: prevBadgeMeta,
          equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
        });
        if (res?.code === 'BADGE_NOT_UNLOCKED') {
          toast.error(t('profile.badgeNotUnlocked'));
        } else {
          toast.error(t('profile.badgeEquipFailed', { msg: res?.error || '' }));
        }
      } else {
        toast.success(t('profile.badgeEquippedSuccess'));
      }
    } catch (err) {
      setProfileUser((prev) => prev ? {
        ...prev,
        equipped_badge_id: prevBadgeId,
        equipped_badge_meta: prevBadgeMeta,
        equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
      } : prev);
      login({
        ...currentUser,
        equipped_badge_id: prevBadgeId,
        equipped_badge_meta: prevBadgeMeta,
        equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
      });
      toast.error(t('profile.badgeEquipFailed', { msg: err?.message || '' }));
    } finally {
      setIsEquippingBadge(false);
    }
  };

  const handleUnequipBadge = async () => {
    if (!isOwnProfile || !currentUser || isEquippingBadge) return;
    const prevBadgeId = displayUser?.equipped_badge_id ?? null;
    const prevBadgeMeta = displayUser?.equipped_badge_meta ?? null;

    setIsEquippingBadge(true);
    setProfileUser((prev) => prev ? {
      ...prev,
      equipped_badge_id: null,
      equipped_badge_meta: null,
      equipped_badge: null,
    } : prev);
    login({
      ...currentUser,
      equipped_badge_id: null,
      equipped_badge_meta: null,
      equipped_badge: null,
    });

    try {
      const res = await equipBadge(null);
      if (!res?.success) {
        setProfileUser((prev) => prev ? {
          ...prev,
          equipped_badge_id: prevBadgeId,
          equipped_badge_meta: prevBadgeMeta,
          equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
        } : prev);
        login({
          ...currentUser,
          equipped_badge_id: prevBadgeId,
          equipped_badge_meta: prevBadgeMeta,
          equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
        });
        toast.error(t('profile.badgeEquipFailed', { msg: res?.error || '' }));
      } else {
        toast.success(t('profile.badgeUnequippedSuccess'));
      }
    } catch (err) {
      setProfileUser((prev) => prev ? {
        ...prev,
        equipped_badge_id: prevBadgeId,
        equipped_badge_meta: prevBadgeMeta,
        equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
      } : prev);
      login({
        ...currentUser,
        equipped_badge_id: prevBadgeId,
        equipped_badge_meta: prevBadgeMeta,
        equipped_badge: prevBadgeId ? { id: prevBadgeId, ...(prevBadgeMeta || {}) } : null,
      });
      toast.error(t('profile.badgeEquipFailed', { msg: err?.message || '' }));
    } finally {
      setIsEquippingBadge(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.errImageOnly'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.errImageTooLarge', 'Image too large. Maximum 5MB.'));
      return;
    }

    setIsUploading(true);
    const { url, error } = await uploadImage(file, currentUser.id);
    if (error) {
      toast.error(error);
    } else if (url) {
      setAvatarUrl(url);
      toast.success(t('profile.successUpload'));
    }
    setIsUploading(false);
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (savingRef.current || isUploading) return;
    if (studiedAtUp === null) { toast.error(t('profile.chooseMembership')); return; }

    // 📍 Validation ฝั่ง client — ถ้าเลือก "เคยศึกษาที่มหาวิทยาลัยพะเยา" ต้องเลือกครบทั้ง 3 ฟิลด์
    // (ฝั่ง server ตรวจซ้ำอีกชั้นใน functions/api/auth.js)
    if (studiedAtUp) {
      if (!facultyValue) {
        toast.error(t('profile.errRequireFaculty'));
        return;
      }
      if (!majorValue) {
        toast.error(t('profile.errRequireMajor'));
        return;
      }
      if (!admissionYear) {
        toast.error(t('profile.errRequireAdmissionYear'));
        return;
      }
    }

    const educationPayload = studiedAtUp
      ? { university: UP_UNIVERSITY_NAME, faculty: facultyValue, major: majorValue, year: admissionYear }
      : { university: null, faculty: null, major: null, year: null };

    savingRef.current = true;
    setIsSaving(true);
    const { error } = await updateProfile(currentUser.id, {
      username: displayName,
      bio: bio,
      ...educationPayload,
      avatar_url: avatarUrl
    });

    savingRef.current = false;
    setIsSaving(false);
    if (error) {
      toast.error(t('profile.errUpdate', { msg: error }));
      return;
    }

    const updatedUser = {
      ...currentUser,
      username: displayName,
      bio,
      university: educationPayload.university,
      faculty: educationPayload.faculty,
      major: educationPayload.major,
      year: educationPayload.year,
      avatar_url: avatarUrl
    };
    login(updatedUser); // อัปเดตข้อมูลใน Context / LocalStorage
    closeProfileEditor();
    toast.success(t('profile.successUpdate'));
  };

  if (!currentUser && !routeUserId) return null;

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-bold text-ink">{t('profile.notFound')}</p>
          <button onClick={() => navigate('/')} className="mt-2 text-sm font-bold text-brand hover:underline">
            {t('common.backHome')}
          </button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm font-medium text-muted animate-pulse">{t('profile.loading')}</p>
      </main>
    );
  }

  // โปรไฟล์ตัวเอง: ค่าจาก context (สดหลังแก้ไข) ทับค่าจาก API — แต่ created_at/posts_count มีแค่ใน API
  // โปรไฟล์คนอื่น: ใช้ค่าจาก API เท่านั้น (context เป็นข้อมูลของเราเอง ห้ามเอามาแสดง)
  const displayUser = isOwnProfile
    ? { ...(profileUser || {}), ...(currentUser || {}) }
    : profileUser;
  // Parse the UTC database date before formatting the full join date.
  const joinedLabel = formatDbDate(displayUser?.created_at, i18n.language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';
  const totalLikes = displayUser?.likes_received ?? posts.reduce((n, p) => n + (p.stats?.likes || 0), 0);
  const educationFields = [
    ['University', displayUser?.university],
    ['Faculty', displayUser?.faculty],
    ['Major', displayUser?.major],
    ['Admission Year', displayUser?.year],
  ].map(([label, value]) => [label, String(value ?? '').trim()]);
  const tasteIdentity = displayUser?.taste_identity || {};
  const pinnedRankings = Array.isArray(tasteIdentity.pinned_rankings) ? tasteIdentity.pinned_rankings : [];
  const hashtagDistribution = Array.isArray(tasteIdentity.hashtag_distribution) ? tasteIdentity.hashtag_distribution : [];
  const badges = Array.isArray(tasteIdentity.badges) ? tasteIdentity.badges : [];
  // A4: สถานะ badge ทั้ง 10 (ปลด/ล็อก + progress) จากตัวเลขที่มีอยู่แล้ว — ไม่เพิ่ม request
  const badgeValue = (id) => badges.find((b) => b.id === id)?.value ?? null;
  const badgeStates = getBadgeStates({
    rankingCount: displayUser?.posts_count ?? posts.length,
    templateCount: tasteIdentity.template_count ?? badgeValue('template_builder') ?? badgeValue('template_creator') ?? 0,
    followerCount: displayUser?.followers_count ?? 0,
    maxTemplateUses: tasteIdentity.max_template_uses ?? badgeValue('template_legend') ?? badgeValue('trending_template') ?? badgeValue('template_hit'),
    topHashtag: tasteIdentity.top_hashtag ?? (hashtagDistribution.length > 0 ? hashtagDistribution[0] : null),
    unlockedBadges: badges,
    unlockedIds: badges.map((b) => b.id),
  });

  const pinnedSet = new Set(pinnedRankings.map((item) => item.ranking_id || item.id));
  const isPinnedPost = (postId) => pinnedSet.has(postId);

  const loadedIds = new Set(posts.map(post => post.id));
  const sortedPosts = [...posts, ...extraPins.filter(post => !loadedIds.has(post.id))].sort((a, b) => {
    const aPinned = isPinnedPost(a.id);
    const bPinned = isPinnedPost(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  const visiblePosts = postTab === 'pinned'
    ? sortedPosts.filter((p) => isPinnedPost(p.id))
    : sortedPosts;

  return (
    <div className="text-ink antialiased min-h-screen flex flex-col font-sans">
      <main className="profile-v2 social-profile flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 max-w-7xl">
<BackButton fallback="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-soft bg-surface px-3 text-sm text-ink-soft hover:text-ink mb-3"><BackArrow size={16} /><span>{t('common.back')}</span></BackButton>
        <div className="profile-layout grid gap-6">

            <header className="profile-header relative text-ink">
              <div className="profile-header-avatar relative shrink-0">
                <div className="passport-avatar w-full h-full rounded-full overflow-hidden bg-surface">
                  <Avatar name={displayUser?.username} src={displayUser?.avatar_url} size="lg" style={{ width: '100%', height: '100%' }} />
                </div>
                {displayUser?.role === 'admin' && (
                  <div className="absolute -top-3 -right-2 text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] rotate-[15deg]">
                    <Crown size={32} fill="currentColor" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="profile-header-info min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink break-words">{displayUser?.username}</h1>
              {displayUser?.equipped_badge_id && (() => {
                const meta = displayUser.equipped_badge_meta || displayUser.equipped_badge;
                const rawTag = meta?.hashtag;
                const cleanTag = rawTag ? String(rawTag).trim().replace(/^#+/, '').trim() : '';
                const tag = cleanTag ? `#${cleanTag}` : '';
                const badgeTitle = t(`profile.badge.${displayUser.equipped_badge_id}`);
                const fullLabel = tag ? `${badgeTitle} · ${tag}` : badgeTitle;

                return (
                  <div className="profile-equipped-badge flex max-w-full">
                    <div
                      title={fullLabel}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold max-w-full shadow-2xs"
                    >
                      <Award size={13} className="shrink-0 text-amber-500" />
                      <span className="truncate">{fullLabel}</span>
                    </div>
                  </div>
                );
              })()}
              {/* 📍 bio จาก DB จริงแล้ว (migrations/0003_profile_bio.sql) — โชว์ได้ทั้งโปรไฟล์ตัวเองและคนอื่น */}
              {displayUser?.bio ? (
                <p className="profile-bio text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{displayUser.bio}</p>
              ) : null}

              <div className="profile-header-actions flex flex-wrap items-center gap-3">
              {isOwnProfile && <button onClick={() => setIsEditOpen(true)} className="profile-edit-button play-button min-h-11 text-sm cursor-pointer">{t('profile.editProfile')}</button>}
              <button type="button" onClick={() => setIsBadgesOpen(true)} className="profile-badge-button inline-flex min-h-11 items-center gap-2 rounded-full border border-line-soft bg-surface px-3 text-sm font-bold text-ink-soft" aria-label={`${badges.length} / ${badgeStates.length} ${t('profile.badges')}`}><Award size={18} /><span>{t('profile.badges')}</span></button>
              {!isOwnProfile && (
                <button
                  onClick={handleToggleFollow}
                  disabled={followPending}
                  aria-pressed={isFollowing}
                  className={`profile-follow min-h-11 self-start ${isFollowing ? 'opinion-secondary' : 'play-button'}`}
                >
                  {isFollowing ? t('profile.unfollow') : t('profile.follow')}
                </button>
              )}
              </div>
              <div className="profile-header-counts flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                <button type="button" className="min-h-11 cursor-pointer hover:underline hover:text-ink" onClick={() => handleOpenFollowList('followers')}><strong>{followersCount}</strong> {t('profile.followers')}</button>
                <button type="button" className="min-h-11 cursor-pointer hover:underline hover:text-ink" onClick={() => handleOpenFollowList('following')}><strong>{followingCount}</strong> {t('profile.following')}</button>
                <span className="inline-flex min-h-11 items-center gap-1"><strong className="text-ink">{totalLikes}</strong> {t('profile.totalLikes')}</span>
              </div>
              {
                <section aria-label={t('profile.educationContext')} className="profile-education text-xs text-left text-ink-soft">
                  <div className="space-y-1.5">
                  {educationFields.map(([label, value]) => <p key={label}><strong className="text-ink">{label}:</strong> {value}</p>)}
                  </div>
                </section>
              }
              <p className="profile-header-joined text-xs text-muted">{t('profile.joined')} {joinedLabel}</p>
            </div>
            </header>
          <Modal open={isBadgesOpen} onClose={() => setIsBadgesOpen(false)} title={t('profile.badges')} maxWidth="max-w-2xl">
            <p className="text-sm text-muted mb-4">{t('profile.badgesFor', { name: displayUser?.username })}</p>
            <BadgeGallery
              badges={badgeStates}
              equippedBadgeId={displayUser?.equipped_badge_id}
              equippedBadgeMeta={displayUser?.equipped_badge_meta || displayUser?.equipped_badge}
              canEquip={isOwnProfile}
              onEquip={handleEquipBadge}
              onUnequip={handleUnequipBadge}
              isEquipping={isEquippingBadge}
            />
          </Modal>

          <div className="profile-community-content min-w-0 space-y-4">
            {/* TikTok-style Posts Section Header / Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setPostTab('all')}
                  aria-pressed={postTab === 'all'} className={`inline-flex min-h-11 items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
                    postTab === 'all'
                      ? 'border-brand text-ink'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <LayoutGrid size={16} />
                  <span>{t('profile.allPosts')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">{displayUser?.posts_count ?? posts.length}</span>
                </button>
                {pinnedRankings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPostTab('pinned')}
                    aria-pressed={postTab === 'pinned'}
                    className={`inline-flex min-h-11 items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
                      postTab === 'pinned'
                        ? 'border-brand text-ink'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    <Pin size={15} />
                    <span>{t('profile.pinnedTab')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">{pinnedRankings.length}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setPostTab('duels'); setDuelPage(1); }}
                  aria-pressed={postTab === 'duels'}
                  className={`inline-flex min-h-11 items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
                    postTab === 'duels'
                      ? 'border-brand text-ink'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Swords size={15} />
                  <span>{t('duel.duelsTab')}</span>
                  {duelTotal > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">{duelTotal}</span>
                  )}
                </button>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => setPostTab('saved')}
                    aria-pressed={postTab === 'saved'}
                    className={`inline-flex min-h-11 items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${postTab === 'saved' ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                  >
                    <Bookmark size={15} />
                    <span>{t('discover.savedTemplates')}</span>
                  </button>
                )}
              </div>
              {isOwnProfile && (
                <div className="flex items-center gap-3"><span className="text-xs text-muted">{t('profile.pinnedCount', { count: pinnedRankings.length, max: 3 })}</span><Link to="/create" className="play-button create-action"><span className="create-action-icon" aria-hidden="true"><Plus size={17} strokeWidth={2.5} /></span><span>{t('nav.create')}</span></Link></div>
              )}
            </div>
            {postTab === 'saved' && isOwnProfile ? (
              <SavedTopics key={currentUser.id} userId={currentUser.id} />
            ) : postTab === 'duels' ? (
              isDuelsLoading ? (
                <div className="text-center text-sm text-muted py-12 glass rounded-2xl animate-pulse">
                  {t('common.loading')}
                </div>
              ) : duels.length === 0 ? (
                <div className="text-center text-sm text-muted py-12 glass rounded-2xl">
                  {t('duel.noDuels')}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {duels.map((d) => (
                    <article
                      key={d.id}
                      onClick={() => navigate(`/duel/${encodeURIComponent(d.id)}`)}
                      className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl glass border border-line-soft hover:border-brand/40 hover:shadow-lg transition-all cursor-pointer bg-surface/60"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex -space-x-2 shrink-0">
                          <Avatar size="sm" name={d.challenger_username} src={d.challenger_avatar_url} />
                          <Avatar size="sm" name={d.owner_username} src={d.owner_avatar_url} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                            <span className="truncate">@{d.challenger_username}</span>
                            <span className="text-xs text-muted">vs</span>
                            <span className="truncate">@{d.owner_username}</span>
                          </div>
                          <span className="text-xs text-muted truncate">
                            {d.template_title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-line-soft/60 pt-2 sm:pt-0">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-highlight/15 text-highlight border border-highlight/30 text-xs font-bold shadow-2xs">
                          <Swords size={13} />
                          <span>{d.similarity_score}% Match</span>
                        </div>
                        {d.community_similarity_score !== null && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface border border-line-soft text-xs font-bold text-ink-soft">
                            <span>{d.community_similarity_score}% Community</span>
                          </div>
                        )}
                        <span className="text-xs text-muted">{timeAgo(d.created_at)}</span>
                      </div>
                    </article>
                  ))}

                  {duelTotal > 10 && (
                    <Pagination
                      page={duelPage}
                      totalPages={Math.ceil(duelTotal / 10)}
                      onChange={setDuelPage}
                    />
                  )}
                </div>
              )
            ) : visiblePosts.length === 0 ? (
              <div className="profile-rankings-empty text-center text-sm text-muted py-8 glass rounded-2xl">
                {postTab === 'pinned'
                  ? (isOwnProfile ? t('profile.pinnedHint') : t('profile.noPinned'))
                  : <><p className="font-bold text-ink">{t('profile.emptyRankingsTitle')}</p><p className="mt-2">{t(isOwnProfile ? 'profile.emptyOwn' : 'profile.emptyOther')}</p></>
                }
              </div>
            ) : (
              <div className="profile-ranking-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {visiblePosts.map((post) => (
                  <MiniTierTile
                    key={post.id}
                    post={post}
                    isPinned={isPinnedPost(post.id)}
                    isOwnProfile={isOwnProfile}
                    pinBusy={pinBusyId === post.id}
                    onTogglePin={handleTogglePin}
                    onSelect={() => navigate(`/post/${post.id}`)}
                    t={t}
                  />
                ))}
              </div>
            )}
            {postTab === 'all' && postsError && (
              <div role="alert" className="mt-5 text-center">
                <p>{t('profile.errFetch')}</p>
                <button type="button" onClick={() => setProfileRetry(value => value + 1)} className="mt-2 font-bold text-brand">{t('common.retry')}</button>
              </div>
            )}
            {postTab === 'all' && hasMorePosts && posts.length < (displayUser?.posts_count || 0) && (
              <button type="button" disabled={loadingPosts} onClick={loadMorePosts} className="mt-5 w-full rounded-xl border border-line-soft px-4 py-3 font-bold disabled:opacity-50">
                {t(loadingPosts ? 'common.loading' : 'common.next')}
              </button>
            )}




          </div>

        </div>

      
      
      
</main>

      {/* Edit Profile Modal (เฉพาะโปรไฟล์ตัวเอง) */}
      {isOwnProfile && isEditOpen && (
        <Modal open={isEditOpen} onClose={closeProfileEditor} variant="editor" maxWidth={isEducationSetup ? 'max-w-xl' : 'max-w-3xl'} title={t(isEducationSetup ? 'profile.tasteIdentity' : 'profile.editProfile')}>
          <div className="profile-editor-v2">
            <p className="club-serial mb-3">TEAR OF GOD / {t(isEducationSetup ? 'profile.setupTitle' : 'profile.editProfile')}</p>
            <h3 className="profile-editor-headline">{t(isEducationSetup ? 'profile.setupHeadline' : 'profile.editorHeadline')}</h3>
            {isEducationSetup && <p className="text-sm text-muted mb-4">{t('profile.setupHelp')}</p>}

            <form onSubmit={handleSaveChanges} className="space-y-4">
              <fieldset disabled={isSaving || isUploading} className="profile-editor-fields space-y-4 pb-24">
              {!isEducationSetup && <>
              <div className="text-center mb-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-surface overflow-hidden mb-2 relative">
                  {isUploading ? (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-muted glass/50 absolute inset-0">
                      {t('profile.uploading')}
                    </div>
                  ) : null}
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={t('common.avatarAlt')} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xl text-brand">
                      {displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button type="button"
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="min-h-11 text-xs font-bold text-ink underline underline-offset-4"
                >
                  {isUploading ? t('profile.uploading') : t('profile.changePhoto')}
                </button>
              </div>

              <div>
                <label htmlFor="profile-display-name" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.displayName')}</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>

              <div>
                <label htmlFor="profile-bio" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.bio')}</label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand h-24 resize-none"
                ></textarea>
              </div>

              </>}
              <div className="club-section profile-editor-university space-y-3">
                <fieldset>
                  <legend className="text-sm font-bold text-ink mb-3">{t('profile.membershipQuestion')}</legend>
                  <div className="flex flex-wrap gap-4">
                    {[true, false].map(value => (
                      <label key={String(value)} className="club-choice flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input type="radio" name="up-membership" checked={studiedAtUp === value}
                          onChange={() => {
                            setStudiedAtUp(value);
                            if (!value) { setFacultyValue(''); setMajorValue(''); setAdmissionYear(''); }
                          }} required />
                        {t(value ? 'profile.membershipYes' : 'profile.membershipNo')}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {studiedAtUp && (
                  <>
                    <div>
                      <label htmlFor="profile-faculty" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.faculty')}</label>
                      <select
                        id="profile-faculty"
                        value={facultyValue}
                        onChange={(e) => {
                          setFacultyValue(e.target.value);
                          setMajorValue('');
                        }}
                        className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="">{t('profile.selectFaculty')}</option>
                        {FACULTIES.map((f) => (
                          <option key={f.id} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="profile-major" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.major')}</label>
                      <select
                        id="profile-major"
                        value={majorValue}
                        onChange={(e) => setMajorValue(e.target.value)}
                        disabled={!facultyValue}
                        className={`w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand ${
                          facultyValue ? '' : 'cursor-not-allowed opacity-50'
                        }`}
                      >
                        <option value="">{t('profile.selectMajor')}</option>
                        {getMajorsForFaculty(facultyValue).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="profile-admission-year" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.admissionYear')}</label>
                      <select
                        id="profile-admission-year"
                        value={admissionYear}
                        onChange={(e) => setAdmissionYear(e.target.value)}
                        className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="">{t('profile.selectAdmissionYear')}</option>
                        {admissionYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="profile-editor-actions sticky bottom-0 flex justify-end gap-3 py-3 px-4 -mx-4 bg-surface/95 backdrop-blur-md border-t border-line-soft z-20">
                <button
                  type="button"
                  onClick={closeProfileEditor}
                  className="px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-glass rounded-xl"
                >
                  {t(isEducationSetup ? 'profile.setupLater' : 'profile.cancel')}
                </button>
                <button
                  type="submit"
                  className="club-primary min-h-11 px-5 text-sm"
                >
                  {t(isSaving ? 'profile.saving' : (isEducationSetup ? 'profile.setupContinue' : 'profile.saveChanges'))}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </Modal>
      )}

      {/* Follow List Modal */}
      {followListModal && (
        <Modal
          open
          onClose={() => setFollowListModal(null)}
          title={followListModal === 'followers' ? t('profile.followers') : t('profile.following')}
          maxWidth="max-w-lg"
        >
            <div className="space-y-2">
              {isFollowListLoading ? (
                <p className="text-center text-muted py-6">{t('profile.loading')}</p>
              ) : followListData.length === 0 ? (
                <p className="text-center text-muted py-6">{t('profile.noUsers')}</p>
              ) : (
                followListData.map(user => (
                  <button key={user.id} type="button"
                    className="flex min-h-11 w-full items-center gap-4 p-3 text-left transition-colors hover:bg-tag focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pop-violet"
                    onClick={() => {
                      setFollowListModal(null);
                      navigate(`/profile/${user.id}`);
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-surface overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-lg text-brand">
                            {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>
                      {user.role === 'admin' && (
                        <div className="absolute -top-2 -right-1 text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] rotate-[15deg]">
                          <Crown size={16} fill="currentColor" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-base text-ink">{user.username}</div>
                      {user.bio && <div className="text-sm text-muted line-clamp-1">{user.bio}</div>}
                    </div>
                  </button>
                ))
              )}
            </div>
        </Modal>
      )}

    </div>
  );
}














