import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { fetchRankings, updateProfile, fetchUserProfile, toggleFollow } from '../lib/api'; // 📍 เพิ่ม fetchUserProfile สำหรับดูโปรไฟล์คนอื่น
import { timeAgo } from '../lib/format';
import { useToast } from '../components/ui/Toast';

// "Oct 2024" จาก created_at ที่ได้จาก API (แทนที่ข้อความ hardcode เดิม)
function formatJoined(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function Profile() {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams(); // 📍 /profile/:userId = ดูโปรไฟล์คนอื่น, /profile = ของตัวเอง
  const { currentUser, login } = useUser();
  const toast = useToast();

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

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
  }, [profileUserId]);

  // ฟอร์มแก้ไข (เฉพาะโปรไฟล์ตัวเอง) sync กับ user ล่าสุดใน context
  useEffect(() => {
    if (isOwnProfile && currentUser) {
      setDisplayName(currentUser.username || '');
      setBio(currentUser.bio || 'Master of tier lists. Categorizing the virtual world one tier at a time.');
      setUniversity(currentUser.university || '');
      setFaculty(currentUser.faculty || '');
      setMajor(currentUser.major || '');
      setYear(currentUser.year || '');
    }
  }, [isOwnProfile, currentUser]);

  // 📍 [แก้ไขแล้ว]: ยิง API บันทึกข้อมูลโปรไฟล์ของจริง (เฉพาะเมื่อดูโปรไฟล์ตัวเอง)
  const handleToggleFollow = async () => {
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบเพื่อติดตามผู้ใช้นี้');
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
      toast.error('ไม่สามารถทำรายการได้');
      setIsFollowing(previousFollowing);
      setFollowersCount(previousCount);
    }
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();

    const { error } = await updateProfile(currentUser.id, {
      username: displayName,
      bio: bio,
      university,
      faculty,
      major,
      year
    });

    if (error) {
      toast.error('อัปเดตโปรไฟล์ไม่สำเร็จ: ' + error);
      return;
    }

    const updatedUser = { ...currentUser, username: displayName, bio, university, faculty, major, year };
    login(updatedUser); // อัปเดตข้อมูลใน Context / LocalStorage
    setIsEditOpen(false);
    toast.success('อัปเดตโปรไฟล์สำเร็จ!');
  };

  if (!currentUser && !routeUserId) return null;

  if (notFound) {
    return (
      <main className="bg-[#fdf8f4] min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">ไม่พบผู้ใช้นี้ในระบบ</p>
          <button onClick={() => navigate('/')} className="mt-2 text-sm font-bold text-[#7c5d22] hover:underline">
            กลับสู่หน้าหลัก
          </button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="bg-[#fdf8f4] min-h-screen flex items-center justify-center px-4">
        <p className="text-sm font-medium text-gray-400 animate-pulse">กำลังโหลดโปรไฟล์...</p>
      </main>
    );
  }

  // โปรไฟล์ตัวเอง: ค่าจาก context (สดหลังแก้ไข) ทับค่าจาก API — แต่ created_at/posts_count มีแค่ใน API
  // โปรไฟล์คนอื่น: ใช้ค่าจาก API เท่านั้น (context เป็นข้อมูลของเราเอง ห้ามเอามาแสดง)
  const displayUser = isOwnProfile
    ? { ...(profileUser || {}), ...(currentUser || {}) }
    : profileUser;
  const joinedLabel = formatJoined(displayUser?.created_at) ?? '—';
  const totalLikes = posts.reduce((n, p) => n + (p.stats?.likes || 0), 0);

  return (
    <div className="bg-[#fdf8f4] text-gray-900 antialiased min-h-screen flex flex-col font-sans">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Sidebar: User Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#f3e8df] shadow-sm text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-[#f3e8df] border-2 border-[#7c5d22]">
                {displayUser?.avatar_url ? (
                  <img src={displayUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[#7c5d22]">
                    {displayUser?.username ? displayUser.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-1">{displayUser?.username}</h2>
              <div className="flex justify-center gap-4 text-sm text-gray-500 mb-3">
                <span><strong>{followersCount}</strong> Followers</span>
                <span><strong>{followingCount}</strong> Following</span>
              </div>
              {!isOwnProfile && (
                <button
                  onClick={handleToggleFollow}
                  className={`w-full py-2 mb-4 font-bold rounded-xl text-sm transition-all shadow-sm active:scale-[0.97] ${
                    isFollowing 
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {/* 📍 bio จาก DB จริงแล้ว (migrations/0003_profile_bio.sql) — โชว์ได้ทั้งโปรไฟล์ตัวเองและคนอื่น */}
              {displayUser?.bio ? (
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{displayUser.bio}</p>
              ) : (
                <p className="text-xs text-gray-400 italic mb-4 leading-relaxed">ยังไม่ได้เขียน Bio</p>
              )}

              {/* Education Info */}
              {(displayUser?.university || displayUser?.faculty || displayUser?.major || displayUser?.year) && (
                <div className="mt-4 mb-4 text-xs text-gray-600 text-left bg-zinc-50 p-3 rounded-xl border border-zinc-100 space-y-1">
                  {displayUser?.university && <p><strong className="text-zinc-800">มหาวิทยาลัย:</strong> {displayUser.university}</p>}
                  {displayUser?.faculty && <p><strong className="text-zinc-800">คณะ:</strong> {displayUser.faculty}</p>}
                  {displayUser?.major && <p><strong className="text-zinc-800">สาขา:</strong> {displayUser.major}</p>}
                  {displayUser?.year && <p><strong className="text-zinc-800">ชั้นปี:</strong> {displayUser.year}</p>}
                </div>
              )}

              {isOwnProfile && (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="w-full py-2 bg-[#fdf8f4] hover:bg-[#f3e8df] border border-[#f3e8df] text-[#7c5d22] font-bold rounded-xl text-sm transition-colors shadow-xs"
                >
                  Edit Profile
                </button>
              )}

              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-around text-center text-xs text-gray-500">
                <div>
                  <p className="font-bold text-gray-900">{joinedLabel}</p>
                  <p>Joined</p>
                </div>
                {/* ยอดไลก์รวมจากโพสต์จริง (แทนสูตร views ปลอมเดิม) */}
                <div>
                  <p className="font-bold text-gray-900">{totalLikes}</p>
                  <p>Total Likes</p>
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
                className="bg-white border-2 border-dashed border-[#cec6b4] hover:border-[#7c5d22] rounded-2xl p-6 text-center cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#fdf8f4] border border-[#f3e8df] flex items-center justify-center text-[#7c5d22] group-hover:scale-105 transition-transform">
                  +
                </div>
                <h3 className="font-bold text-gray-900">Create New Template</h3>
                <p className="text-xs text-gray-500">Start a new tier list from scratch</p>
              </div>
            )}

            {!isOwnProfile && (
              <div className="bg-white rounded-2xl p-6 border border-[#f3e8df]">
                <h3 className="text-lg font-bold text-gray-900">Tier Lists by {displayUser?.username}</h3>
                <p className="text-xs text-gray-500 mt-1">Tier List ทั้งหมดที่ {displayUser?.username} สร้างไว้</p>
              </div>
            )}

            {/* User's Created Templates */}
            {posts.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8 bg-white rounded-2xl border border-[#f3e8df]">
                {isOwnProfile
                  ? 'คุณยังไม่ได้สร้าง Tier List ใดๆ ลองกดสร้างด้านบนได้เลย!'
                  : `${displayUser?.username || 'ผู้ใช้นี้'} ยังไม่มี Tier List ที่โพสต์ไว้`}
              </p>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-[#f3e8df] cursor-pointer hover:border-[#cec6b4] transition-colors"
                >
                  <div className="text-xs font-bold text-[#7c5d22] uppercase tracking-wider mb-1">Created a Template</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h3>

                  {/* Preview Tiers */}
                  <div className="bg-[#fdf8f4] rounded-xl p-3 border border-[#f3e8df] space-y-2 mb-4">
                    <div className="flex bg-white rounded-lg border border-[#f3e8df] overflow-hidden min-h-[50px]">
                      <div className="bg-[#ff7f7f] text-white w-12 flex-shrink-0 flex items-center justify-center font-bold">S</div>
                      <div className="p-2 flex gap-2 overflow-x-auto items-center flex-grow">
                        {post.ranking_items && post.ranking_items.slice(0, 2).map((ri, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-50 border rounded-md text-xs">{ri.item?.name || ri.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>{timeAgo(post.created_at)}</span>
                    <div className="flex items-center gap-4 text-gray-500">
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
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-[#f3e8df] relative">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 font-bold"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Profile</h3>

            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#f3e8df] overflow-hidden mb-2">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#7c5d22]">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[#7c5d22] font-bold cursor-pointer hover:underline">Change Photo</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5d22]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900 h-24"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">มหาวิทยาลัย</label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">คณะ</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">สาขา</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">ชั้นปี</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-[#7c5d22] hover:bg-[#63491b] text-white rounded-xl shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

