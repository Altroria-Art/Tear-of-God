import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { fetchRankings, updateProfile, fetchUserProfile, toggleFollow, fetchFollowList, uploadImage } from '../lib/api';
import { timeAgo, formatDbDate } from '../lib/format';
import { buildTierRows } from '../lib/tiers';
import TierLabel from '../components/tier/TierLabel';
import { useToast } from '../components/ui/Toast';
import { SkeletonCircle, SkeletonRow, FeedCardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const navigate = useNavigate();
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
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [followListModal, setFollowListModal] = useState(null); // 'followers' | 'following' | null
  const [followListData, setFollowListData] = useState([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);

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
      setBio(currentUser.bio || 'Master of tier lists. Categorizing the virtual world one tier at a time.');
      setUniversity(currentUser.university || '');
      setFaculty(currentUser.faculty || '');
      setMajor(currentUser.major || '');
      setYear(currentUser.year || '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [profileUserId, isOwnProfile, currentUser?.id]);

  // 📍 [แก้ไขแล้ว]: ยิง API บันทึกข้อมูลโปรไฟล์ของจริง (เฉพาะเมื่อดูโปรไฟล์ตัวเอง)
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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.errImageOnly'));
      return;
    }

    setIsUploading(true);
    const { url, error } = await uploadImage(file);
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

    const { error } = await updateProfile(currentUser.id, {
      username: displayName,
      bio: bio,
      university,
      faculty,
      major,
      year,
      avatar_url: avatarUrl
    });

    if (error) {
      toast.error(t('profile.errUpdate', { msg: error }));
      return;
    }

    const updatedUser = { ...currentUser, username: displayName, bio, university, faculty, major, year, avatar_url: avatarUrl };
    login(updatedUser); // อัปเดตข้อมูลใน Context / LocalStorage
    setIsEditOpen(false);
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
      <main className="min-h-screen flex items-start justify-center px-4 py-10">
        <div className="mx-auto max-w-7xl flex gap-8 items-start justify-center w-full">
          <aside className="hidden lg:block w-[300px] shrink-0">
            <div className="glass p-6 rounded-3xl flex flex-col items-center gap-3">
              <SkeletonCircle className="w-24 h-24" />
              <SkeletonRow className="w-28 h-5" />
              <SkeletonRow className="w-20 h-3" />
              <div className="flex gap-8 my-2">
                <SkeletonRow className="w-12 h-4" />
                <SkeletonRow className="w-12 h-4" />
              </div>
              <SkeletonRow className="w-full h-3" />
              <SkeletonRow className="w-3/4 h-3" />
              <SkeletonRow className="w-24 h-9 rounded-full mt-2" />
            </div>
          </aside>
          <main className="w-full max-w-2xl shrink">
            <div className="space-y-6 mt-4">
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          </main>
        </div>
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

  return (
    <div className="text-ink antialiased min-h-screen flex flex-col font-sans">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Sidebar: User Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass p-6 rounded-2xl shadow-sm text-center text-ink">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-surface border-2 border-line">
                {displayUser?.avatar_url ? (
                  <img src={displayUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-brand">
                    {displayUser?.username ? displayUser.username.charAt(0).toUpperCase() : 'U'}
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
                  {displayUser?.year && <p><strong className="text-ink">{t('profile.year')}</strong> {displayUser.year}</p>}
                </div>
              )}

              {isOwnProfile && (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="w-full py-2 bg-brand-accent hover:bg-surface border border-line text-ink font-bold rounded-xl text-sm transition-colors shadow-xs"
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
          </div>

          {/* Right Content: Create Template Button & List of User Posts */}
          <div className="lg:col-span-3 space-y-6">

            {/* Create New Template Banner (เฉพาะโปรไฟล์ตัวเอง) */}
            {isOwnProfile && (
              <div
                onClick={() => navigate('/create')}
                className="glass border-2 border-dashed border-line hover:border-[#7c5d22] rounded-2xl p-6 text-center cursor-pointer transition-colors group"
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

            {/* User's Created Templates */}
            {posts.length === 0 ? (
              <EmptyState
                title={isOwnProfile
                  ? t('profile.emptyOwn')
                  : t('profile.emptyOther', { name: displayUser?.username || t('common.unknownUser') })}
              />
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="glass rounded-2xl p-5 shadow-sm cursor-pointer hover:border-line transition-colors"
                >
                  <div className="text-xs font-bold text-brand uppercase tracking-wider mb-1">{t('profile.createdTemplate')}</div>
                  <h3 className="text-lg font-bold text-ink mb-2">{post.title}</h3>

                  {/* Preview Tiers */}
                  <div className="bg-canvas rounded-xl p-3 space-y-2 mb-4">
                    {(() => {
                      const rows = buildTierRows(post.ranking_items, post.tiers);
                      const shown = rows.slice(0, 2);
                      return shown.map((row, rowIdx) => (
                        <div key={row.tier + String(rowIdx)} className="flex glass rounded-lg overflow-hidden min-h-[38px]">
                          <TierLabel
                            label={row.tier}
                            color={row.color}
                            index={row.index}
                            className={`w-12 text-xs font-bold ${row.tier.length > 2 ? 'text-[9px]' : 'text-sm'}`}
                          />
                          <div className="p-2 flex gap-2 overflow-x-auto items-center flex-grow">
                            {(row.items || []).slice(0, 2).map((ri, idx) => (
                              <span key={idx} className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg px-3 py-1 text-xs whitespace-nowrap">
                                {ri.item?.name || ri.item_name || ri.item_id}
                              </span>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted">
                    <span>{timeAgo(post.created_at)}</span>
                    <div className="flex items-center gap-4 text-muted">
                      <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> {post.stats?.likes || 0}</span>
                      <span className="flex items-center gap-1.5"><ThumbsDown size={14} /> {post.stats?.dislikes || 0}</span>
                      <span className="flex items-center gap-1.5"><MessageSquare size={14} /> {post.stats?.comments || 0}</span>
                    </div>
                  </div>
                </article>
              ))
            )}

          </div>

        </div>

      </main>

      {/* Edit Profile Modal (เฉพาะโปรไฟล์ตัวเอง) */}
      {isOwnProfile && isEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-xl relative">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-ink-soft font-bold"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-ink mb-4">{t('profile.editProfile')}</h3>

            <form onSubmit={handleSaveChanges} className="space-y-4">
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
                      {displayName.charAt(0).toUpperCase()}
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
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand h-24"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.university')}</label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.faculty')}</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.major')}</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">{t('profile.year')}</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-glass rounded-xl"
                >
                  {t('profile.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-brand hover:bg-brand-accent text-canvas rounded-xl shadow-sm"
                >
                  {t('profile.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow List Modal */}
      {followListModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-lg rounded-3xl p-8 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setFollowListModal(null)}
              className="absolute top-4 right-4 text-muted hover:text-ink-soft font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-ink mb-4 capitalize">{followListModal}</h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {isFollowListLoading ? (
                <p className="text-center text-muted py-6">{t('profile.loading')}</p>
              ) : followListData.length === 0 ? (
                <EmptyState title={t('profile.noUsers')} />
              ) : (
                followListData.map(user => (
                  <div key={user.id} 
                    className="flex items-center gap-4 cursor-pointer hover:bg-surface p-3 rounded-xl transition-colors"
                    onClick={() => {
                      setFollowListModal(null);
                      navigate(`/profile/${user.id}`);
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-surface overflow-hidden flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-lg text-brand">
                          {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
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
















