import { parseHashtags } from '../lib/hashtags';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { returnPath } from '../lib/navigation';
import { ThumbsUp, MessageSquare, Crown, Pin, Fingerprint, Award, BarChart3, LayoutGrid, Swords } from 'lucide-react';
import BadgeGallery from '../components/user/BadgeGallery';
import { useUser } from '../context/UserContext';
import { fetchRankings, updateProfile, fetchUserProfile, fetchSimilarUsers, toggleFollow, fetchFollowList, uploadImage, setProfilePin, fetchUserDuels } from '../lib/api';
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
      className="relative flex aspect-square h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-line-soft/80 shadow-2xs overflow-hidden select-none p-0.5 text-center"
      title={itemName}
    >
      {itemImg && !imgError ? (
        <img
          src={itemImg}
          alt={itemName}
          className="w-full h-full object-cover rounded-md pointer-events-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="w-full line-clamp-2 text-[8px] sm:text-[9px] font-bold leading-[1.1] text-ink text-center break-words px-0.5">
          {itemName}
        </span>
      )}
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
      className="group relative flex flex-col rounded-2xl overflow-hidden glass border border-line-soft hover:border-brand/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer text-left select-none bg-surface/60 min-w-0"
    >
      {/* Top Visual Thumbnail Area — pt-13 reserves a CONSTANT slot for the pinned + type
          badges so tier rows never shift whether the list is pinned or not */}
      <div className="h-36 sm:h-40 relative bg-canvas/40 pt-13 pb-2 px-2 sm:px-2.5 flex flex-col justify-center gap-1.5 overflow-hidden border-b border-line-soft/50">
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
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-full backdrop-blur-md border border-line-soft transition-all shadow-sm ${
              isPinned
                ? 'bg-brand text-canvas'
                : 'bg-surface/90 text-muted sm:opacity-0 sm:group-hover:opacity-100 hover:text-brand hover:bg-brand/10'
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
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs font-black shrink-0 shadow-xs"
              />
              <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                {row.items.slice(0, 3).map((ri, iIdx) => (
                  <MiniTierItem key={ri.id ?? iIdx} item={ri} t={t} />
                ))}
                {row.items.length > 3 && (
                  <span className="text-[9px] font-bold text-muted shrink-0 px-1">
                    +{row.items.length - 3}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Metadata & Stats */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-2 min-w-0">
        <div className="space-y-1.5 min-w-0">
          <h4
            className="font-bold text-xs sm:text-sm text-ink line-clamp-2 leading-snug group-hover:text-brand transition-colors"
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
  const admissionYears = useMemo(() => getAdmissionYears(), []);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [followListModal, setFollowListModal] = useState(null); // 'followers' | 'following' | null
  const [followListData, setFollowListData] = useState([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);
  const [pinBusyId, setPinBusyId] = useState(null);
  const [isTasteDetailsOpen, setIsTasteDetailsOpen] = useState(false);
  const [isBadgesOpen, setIsBadgesOpen] = useState(false);
  const [postTab, setPostTab] = useState('all'); // 'all' | 'pinned' | 'duels'
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

  // Taste Details modal content (similar users + viewer match) loads on explicit
  // open only — never on mount. Core profile request no longer computes it.
  // fetchSimilarUsers caches per viewer+profile for 60s and dedups in-flight
  // identical URLs, so reopen/remount costs 0-1 requests. On failure the modal
  // simply shows no similar section (same as the empty state) — core intact.
  useEffect(() => {
    if (!isTasteDetailsOpen || !profileUserId) return;
    let cancelled = false;
    fetchSimilarUsers(profileUserId, currentUser?.id).then((res) => {
      if (cancelled) return;
      if (res?.success !== false && res?.data) {
        setProfileUser((prev) => prev
          ? {
              ...prev,
              taste_identity: {
                ...(prev.taste_identity || {}),
                similar_users: res.data.similar_users ?? [],
                taste_match: res.data.taste_match ?? null,
              },
            }
          : prev);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isTasteDetailsOpen, profileUserId, currentUser?.id]);

  const handleOpenFollowList = async (type) => {
    setFollowListModal(type);
    setIsFollowListLoading(true);
    setFollowListData([]);
    const { data, error } = await fetchFollowList(profileUserId, type);
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

      const { data: postData } = await fetchRankings({
        authorId: profileUserId,
        sort: 'recent',
        limit: 50,
      });
      if (!cancelled) {
        setPosts(postData || []);
        setIsLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true };
  }, [profileUserId, currentUser?.id]);

  // ฟอร์มแก้ไข (เฉพาะโปรไฟล์ตัวเอง) sync กับ user ล่าสุดใน context —
  // ใช้ profileUserId เป็น dep หลัก (เปลี่ยนเฉพาะตอนสลับหน้าใหม่) ไม่ใช่ currentUser
  // ที่ context เปลี่ยนบ่อยๆ ไม่งั้นจะล้างฟอร์มที่กำลังพิมพ์ทิ้งทุกครั้งที่ state เปลี่ยน
  const initialUserIdRef = useRef(profileUserId);
  useEffect(() => {
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
  }, [profileUserId, isOwnProfile, currentUser, admissionYears, isEducationSetup]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (!savingRef.current) {
          setIsEditOpen(false);
          if (isEducationSetup && isOwnProfile && isEditOpen) navigate(returnPath(location.search), { replace: true });
        }
        setFollowListModal(null);
        setIsTasteDetailsOpen(false);
      }
    };
    if (isEditOpen || followListModal || isTasteDetailsOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isEditOpen, followListModal, isTasteDetailsOpen, isEducationSetup, isOwnProfile, location.search, navigate]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      toast.error(t('profile.errLoginFollow'));
      navigate('/login');
      return;
    }
    
    // Optimistic UI update
    const previousFollowing = isFollowing;
    const previousCount = followersCount;
    
    setIsFollowing(!previousFollowing);
    setFollowersCount(previousCount + (previousFollowing ? -1 : 1));
    
    const { error } = await toggleFollow(currentUser.id, displayUser.id, previousFollowing);
    
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
  // "Oct 2024" จาก created_at ที่ได้จาก API — parse ผ่าน formatDbDate() เสมอ (ดู src/lib/format.js)
  const joinedLabel = formatDbDate(displayUser?.created_at, i18n.language === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' }) ?? '—';
  const totalLikes = posts.reduce((n, p) => n + (p.stats?.likes || 0), 0);
  const tasteIdentity = displayUser?.taste_identity || {};
  const pinnedRankings = Array.isArray(tasteIdentity.pinned_rankings) ? tasteIdentity.pinned_rankings : [];
  const hashtagDistribution = Array.isArray(tasteIdentity.hashtag_distribution) ? tasteIdentity.hashtag_distribution : [];
  const topItems = Array.isArray(tasteIdentity.top_items) ? tasteIdentity.top_items : [];
  const badges = Array.isArray(tasteIdentity.badges) ? tasteIdentity.badges : [];
  // A4: สถานะ badge ทั้ง 10 (ปลด/ล็อก + progress) จากตัวเลขที่มีอยู่แล้ว — ไม่เพิ่ม request
  const badgeValue = (id) => badges.find((b) => b.id === id)?.value ?? null;
  const badgeStates = getBadgeStates({
    rankingCount: displayUser?.posts_count ?? posts.length,
    templateCount: tasteIdentity.template_count ?? badgeValue('template_builder') ?? badgeValue('template_creator') ?? 0,
    followerCount: displayUser?.followers_count ?? 0,
    maxTemplateUses: tasteIdentity.max_template_uses ?? badgeValue('trending_template') ?? badgeValue('template_hit'),
    unlockedIds: badges.map((b) => b.id),
  });
  const tasteMatch = tasteIdentity.taste_match;
  const similarUsers = Array.isArray(tasteIdentity.similar_users) ? tasteIdentity.similar_users : [];

  const pinnedSet = new Set(pinnedRankings.map((item) => item.ranking_id || item.id));
  const isPinnedPost = (postId) => pinnedSet.has(postId);

  const sortedPosts = [...posts].sort((a, b) => {
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
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Sidebar: User Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass p-6 rounded-2xl shadow-sm text-center text-ink">
              <div className="w-24 h-24 mx-auto mb-4 relative">
                <div className="w-full h-full rounded-full overflow-hidden bg-surface border-2 border-line">
                  {displayUser?.avatar_url ? (
                    <img src={displayUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-brand">
                      {displayUser?.username ? displayUser.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                {displayUser?.role === 'admin' && (
                  <div className="absolute -top-3 -right-2 text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] rotate-[15deg]">
                    <Crown size={32} fill="currentColor" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-ink mb-1">{displayUser?.username}</h2>
              <div className="flex justify-center gap-4 text-sm text-muted mb-3">
                <span className="cursor-pointer hover:underline hover:text-ink" onClick={() => handleOpenFollowList('followers')}><strong>{followersCount}</strong> {t('profile.followers')}</span>
                <span className="cursor-pointer hover:underline hover:text-ink" onClick={() => handleOpenFollowList('following')}><strong>{followingCount}</strong> {t('profile.following')}</span>
              </div>
              {!isOwnProfile && (
                <button
                  onClick={handleToggleFollow}
                  className={`w-full py-2 mb-4 font-bold rounded-xl text-sm transition-all shadow-sm active:scale-[0.97] ${
                    isFollowing 
                      ? 'bg-surface-glass text-muted hover:bg-surface '
                      : 'bg-ink text-canvas hover:bg-brand-accent'
                  }`}
                >
                  {isFollowing ? t('profile.unfollow') : t('profile.follow')}
                </button>
              )}
              {/* 📍 bio จาก DB จริงแล้ว (migrations/0003_profile_bio.sql) — โชว์ได้ทั้งโปรไฟล์ตัวเองและคนอื่น */}
              {displayUser?.bio ? (
                <p className="text-xs text-muted mb-4 leading-relaxed">{displayUser.bio}</p>
              ) : (
                <p className="text-xs text-muted italic mb-4 leading-relaxed">{t('profile.noBio')}</p>
              )}

              {/* Education Info */}
              {(displayUser?.university || displayUser?.faculty || displayUser?.major || displayUser?.year) && (
                <div className="mt-4 mb-4 text-xs text-ink-soft text-left bg-surface p-3 rounded-xl space-y-1">
                  {displayUser?.university && <p><strong className="text-ink">{t('profile.university')}</strong> {displayUser.university}</p>}
                  {displayUser?.faculty && <p><strong className="text-ink">{t('profile.faculty')}</strong> {displayUser.faculty}</p>}
                  {displayUser?.major && <p><strong className="text-ink">{t('profile.major')}</strong> {displayUser.major}</p>}
                  {displayUser?.year && <p><strong className="text-ink">{t('profile.admissionYear')}</strong> {displayUser.year}</p>}
                </div>
              )}

              {isOwnProfile && (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="w-full py-2.5 bg-brand hover:bg-brand-accent text-canvas font-bold rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
                >
                  {t('profile.editProfile')}
                </button>
              )}

              <div className="mt-6 pt-6 border-t border-line-soft flex justify-around text-center text-xs text-muted">
                <div>
                  <p className="font-bold text-ink">{joinedLabel}</p>
                  <p>{t('profile.joined')}</p>
                </div>
                {/* ยอดไลก์รวมจากโพสต์จริง (แทนสูตร views ปลอมเดิม) */}
                <div>
                  <p className="font-bold text-ink">{totalLikes}</p>
                  <p>{t('profile.totalLikes')}</p>
                </div>
              </div>
            </div>

            {/* Keep the summary under the profile; the full identity opens on demand. */}
            <section className="glass rounded-2xl p-5 shadow-sm" aria-label={t('profile.tasteIdentity')}>
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint size={16} className="text-brand" />
                <h3 className="font-bold text-ink">{t('profile.tasteIdentity')}</h3>
              </div>
              <p className="text-[11px] text-muted mb-4">{t('profile.tasteSnapshotHelp')}</p>

              {hashtagDistribution.length === 0 && topItems.length === 0 ? (
                <p className="text-xs text-muted bg-surface rounded-xl px-3 py-3">{t('profile.noTasteData')}</p>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {hashtagDistribution.slice(0, 3).map((item) => (
                      <div key={item.hashtag}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-ink capitalize truncate pr-2">#{item.hashtag}</span>
                          <span className="text-muted shrink-0">{item.percentage}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Math.min(100, item.percentage || 0))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {topItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-line-soft">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-2">{t('profile.favoriteItems')}</p>
                      <div className="space-y-1.5">
                        {topItems.slice(0, 3).map((item) => (
                          <div key={item.id || item.name} className="flex items-center gap-2 text-xs text-ink min-w-0">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-tier-s text-[9px] font-black text-ink shrink-0">S</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {badges.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-line-soft flex items-center gap-2 text-xs text-ink">
                      <Award size={14} className="text-amber-500 shrink-0" />
                      <span>{t('profile.badges')}: {badges.length}</span>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setIsTasteDetailsOpen(true)}
                className="w-full mt-4 pt-3 border-t border-line-soft text-xs font-bold text-brand hover:underline text-left"
              >
                {t('profile.viewTasteDetails')} →
              </button>
            </section>
            <section className="glass rounded-2xl p-5 shadow-sm" aria-label={t('profile.badges')}>
              <div className="flex items-center gap-2">
                <Award size={18} className="text-brand" aria-hidden="true" />
                <h3 className="font-bold text-ink">{t('profile.badges')}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{t('profile.badgesUnlockedCount', { count: badgeStates.filter(badge => badge.unlocked).length, total: badgeStates.length })}</p>
              <button type="button" onClick={() => setIsBadgesOpen(true)} aria-haspopup="dialog"
                className="mt-4 w-full rounded-xl border border-brand/30 px-3 py-2.5 text-sm font-bold text-brand hover:bg-brand/10 transition-colors">
                {t('profile.viewAllBadges')}
              </button>
            </section>
          </div>

          <Modal open={isBadgesOpen} onClose={() => setIsBadgesOpen(false)} title={t('profile.badges')} maxWidth="max-w-2xl">
            <p className="text-sm text-muted mb-4">{t('profile.badgesFor', { name: displayUser?.username })}</p>
            <BadgeGallery badges={badgeStates} />
          </Modal>

          {/* Right Content: Create Template Button & List of User Posts */}
          <div className="lg:col-span-3 space-y-6">

            {/* Create New Template Banner (เฉพาะโปรไฟล์ตัวเอง) */}
            {isOwnProfile && (
              <div
                onClick={() => navigate('/create')}
                className="glass border-2 border-dashed border-line hover:border-highlight rounded-2xl p-6 text-center cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-canvas flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
                  +
                </div>
                <h3 className="font-bold text-ink">{t('profile.createNewTemplate')}</h3>
                <p className="text-xs text-muted">{t('profile.createNewTemplateHelp')}</p>
              </div>
            )}

            {!isOwnProfile && (
              <div className="glass rounded-2xl p-6 ">
                <h3 className="text-lg font-bold text-ink">{t('profile.tierListsBy', { name: displayUser?.username })}</h3>
                <p className="text-xs text-muted mt-1">{t('profile.tierListsByHelp', { name: displayUser?.username })}</p>
              </div>
            )}

            {/* Full Taste Identity opens on demand from the compact card under the profile. */}
            {isTasteDetailsOpen && (
              <Modal open={isTasteDetailsOpen} onClose={() => setIsTasteDetailsOpen(false)} title={t('profile.tasteIdentity')} maxWidth="max-w-4xl">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-xs text-muted -mt-1">
                    <Fingerprint size={16} className="text-brand" />
                    <span>{t('profile.tasteIdentityHelp')}</span>
                    <BarChart3 size={16} className="ml-auto shrink-0" />
                  </div>

              {hashtagDistribution.length === 0 && topItems.length === 0 ? (
                <p className="text-sm text-muted bg-surface rounded-xl px-4 py-5 text-center">{t('profile.noTasteData')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">{t('profile.hashtags')}</h4>
                    <div className="space-y-3">
                      {hashtagDistribution.map((item) => (
                        <div key={item.hashtag}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-ink capitalize">#{item.hashtag}</span>
                            <span className="text-muted">{item.percentage}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand transition-all"
                              style={{ width: `${Math.max(2, Math.min(100, item.percentage || 0))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">{t('profile.favoriteItems')}</h4>
                    {topItems.length === 0 ? (
                      <p className="text-sm text-muted">{t('profile.noFavoriteItems')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {topItems.slice(0, 6).map((item) => (
                          <span key={item.id || item.name} className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-3 py-1.5 text-xs font-semibold text-ink">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-tier-s text-[10px] font-black text-ink">S</span>
                            {item.name}
                            {item.count > 1 && <span className="text-muted">×{item.count}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tasteMatch && (
                <div className="rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand">{t('profile.tasteMatch')}</p>
                    <p className="text-sm text-ink mt-1">{t('profile.tasteMatchYou', { score: tasteMatch.score })}</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    {tasteMatch.shared_hashtags?.length > 0 && <p>#{tasteMatch.shared_hashtags.slice(0, 3).join(' #')}</p>}
                  </div>
                </div>
              )}

              {similarUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">{t('profile.tasteNeighbors')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {similarUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setIsTasteDetailsOpen(false);
                          navigate(`/profile/${user.id}`);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:border-highlight transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-canvas shrink-0">
                          {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-brand">{user.username?.charAt(0)?.toUpperCase() || 'U'}</span>}
                        </div>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-ink truncate">{user.username}</span>
                          <span className="block text-[10px] text-muted">{t('profile.similarPercent', { score: user.score })}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">{t('profile.badges')}</h4>
                {badgeStates.filter((b) => b.unlocked).length > 0 ? (
                  <BadgeGallery badges={badgeStates.filter((b) => b.unlocked)} />
                ) : (
                  <p className="text-sm text-muted">{t('profile.noBadgesUnlocked')}</p>
                )}
              </div>
                </div>
              </Modal>
            )}

            {/* TikTok-style Posts Section Header / Tabs */}
            <div className="flex items-center justify-between border-b border-line-soft pb-3 pt-2">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setPostTab('all')}
                  className={`inline-flex items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
                    postTab === 'all'
                      ? 'border-brand text-ink'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <LayoutGrid size={16} />
                  <span>{t('profile.allPosts')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">{posts.length}</span>
                </button>
                {pinnedRankings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPostTab('pinned')}
                    className={`inline-flex items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
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
                  className={`inline-flex items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-colors ${
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
              </div>
              {isOwnProfile && (
                <span className="text-xs text-muted">
                  {t('profile.pinnedCount', { count: pinnedRankings.length, max: 3 })}
                </span>
              )}
            </div>

            {postTab === 'duels' ? (
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
                      currentPage={duelPage}
                      totalPages={Math.ceil(duelTotal / 10)}
                      onPageChange={setDuelPage}
                    />
                  )}
                </div>
              )
            ) : visiblePosts.length === 0 ? (
              <div className="text-center text-sm text-muted py-12 glass rounded-2xl">
                {postTab === 'pinned'
                  ? (isOwnProfile ? t('profile.pinnedHint') : t('profile.noPinned'))
                  : (isOwnProfile ? t('profile.emptyOwn') : t('profile.emptyOther', { name: displayUser?.username || t('common.unknownUser') }))
                }
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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

          </div>

        </div>

      </main>

      {/* Edit Profile Modal (เฉพาะโปรไฟล์ตัวเอง) */}
      {isOwnProfile && isEditOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeProfileEditor();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" className="glass w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-6 shadow-xl relative">
            <button
              onClick={closeProfileEditor}
              aria-label={t('profile.cancel')}
              className="absolute top-4 right-4 text-muted hover:text-ink-soft font-bold"
            >
              ✕
            </button>

            <h3 id="profile-editor-title" className="text-xl font-bold text-ink mb-4">{t(isEducationSetup ? 'profile.setupTitle' : 'profile.editProfile')}</h3>
            {isEducationSetup && <p className="text-sm text-muted mb-4">{t('profile.setupHelp')}</p>}

            <form onSubmit={handleSaveChanges} className="space-y-4">
              <fieldset disabled={isSaving || isUploading} className="space-y-4">
              {!isEducationSetup && <>
              <div className="text-center mb-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-surface overflow-hidden mb-2 relative">
                  {isUploading ? (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-muted glass/50 absolute inset-0">
                      {t('profile.uploading')}
                    </div>
                  ) : null}
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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
                <span 
                  onClick={() => !isUploading && fileInputRef.current?.click()} 
                  className={`text-xs text-brand font-bold ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:underline'}`}
                >
                  {isUploading ? t('profile.uploading') : t('profile.changePhoto')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.displayName')}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.bio')}</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand h-24 resize-none"
                ></textarea>
              </div>

              </>}
              <div className="bg-surface/50 border border-line-soft rounded-xl p-4 space-y-3">
                <fieldset>
                  <legend className="text-sm font-bold text-ink mb-3">{t('profile.membershipQuestion')}</legend>
                  <div className="flex flex-wrap gap-4">
                    {[true, false].map(value => (
                      <label key={String(value)} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.faculty')}</label>
                      <select
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.major')}</label>
                      <select
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.admissionYear')}</label>
                      <select
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

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeProfileEditor}
                  className="px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-glass rounded-xl"
                >
                  {t(isEducationSetup ? 'profile.setupLater' : 'profile.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-brand hover:bg-brand-accent text-canvas rounded-xl shadow-sm"
                >
                  {t(isSaving ? 'profile.saving' : (isEducationSetup ? 'profile.setupContinue' : 'profile.saveChanges'))}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Follow List Modal */}
      {followListModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFollowListModal(null);
          }}
        >
          <div className="glass w-full max-w-lg rounded-3xl p-8 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setFollowListModal(null)}
              className="absolute top-4 right-4 text-muted hover:text-ink-soft font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-ink mb-4 capitalize">
              {followListModal === 'followers' ? t('profile.followers') : t('profile.following')}
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {isFollowListLoading ? (
                <p className="text-center text-muted py-6">{t('profile.loading')}</p>
              ) : followListData.length === 0 ? (
                <p className="text-center text-muted py-6">{t('profile.noUsers')}</p>
              ) : (
                followListData.map(user => (
                  <div key={user.id} 
                    className="flex items-center gap-4 cursor-pointer hover:bg-surface p-3 rounded-xl transition-colors"
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}














