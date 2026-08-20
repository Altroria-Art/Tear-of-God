import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, updateProfile } from '../lib/api'; // 📍 นำเข้า updateProfile

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, login } = useUser();

  const [myPosts, setMyPosts] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setDisplayName(currentUser.username || '');
    setBio(currentUser.bio || 'Master of tier lists. Categorizing the virtual world one tier at a time.');

    async function loadUserPosts() {
      const { data } = await fetchRankings();
      if (data) {
        const filtered = data.filter(p => p.profile?.username === currentUser.username);
        setMyPosts(filtered);
      }
    }
    loadUserPosts();
  }, [currentUser, navigate]);

  // 📍 [แก้ไขแล้ว]: ยิง API บันทึกข้อมูลโปรไฟล์ของจริง
  const handleSaveChanges = async (e) => {
    e.preventDefault();
    
    const { error } = await updateProfile(currentUser.id, { 
      username: displayName, 
      bio: bio 
    });

    if (error) {
      alert('อัปเดตโปรไฟล์ไม่สำเร็จ: ' + error);
      return;
    }

    const updatedUser = { ...currentUser, username: displayName, bio };
    login(updatedUser); // อัปเดตข้อมูลใน Context / LocalStorage
    setIsEditOpen(false);
    alert('อัปเดตโปรไฟล์สำเร็จ!');
  };

  if (!currentUser) return null;

  return (
    <div className="bg-[#fdf8f4] text-gray-900 antialiased min-h-screen flex flex-col font-sans">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left Sidebar: User Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#f3e8df] shadow-sm text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-[#f3e8df] border-2 border-[#7c5d22]">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[#7c5d22]">
                    {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-1">{currentUser.username}</h2>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">{bio}</p>

              <button 
                onClick={() => setIsEditOpen(true)}
                className="w-full py-2 bg-[#fdf8f4] hover:bg-[#f3e8df] border border-[#f3e8df] text-[#7c5d22] font-bold rounded-xl text-sm transition-colors shadow-xs"
              >
                Edit Profile
              </button>

              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-around text-center text-xs text-gray-500">
                <div>
                  <p className="font-bold text-gray-900">Oct 2024</p>
                  <p>Joined</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{myPosts.length * 150 + 45}</p>
                  <p>List Views</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Create Template Button & List of User Posts */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Create New Template Banner */}
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

            {/* User's Created Templates */}
            {myPosts.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8 bg-white rounded-2xl border border-[#f3e8df]">คุณยังไม่ได้สร้าง Tier List ใดๆ ลองกดสร้างด้านบนได้เลย!</p>
            ) : (
              myPosts.map((post) => (
                <article key={post.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#f3e8df]">
                  <div className="text-xs font-bold text-[#7c5d22] uppercase tracking-wider mb-1">Created a Template</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h3>
                  
                  {/* Mock Preview Tiers */}
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
                    <span>Recently added</span>
                    <div className="flex gap-4">
                      <span>👍 {post.stats?.likes || 0}</span>
                      <span>💬 {post.stats?.comments || 0}</span>
                    </div>
                  </div>
                </article>
              ))
            )}

          </div>

        </div>

      </main>

      {/* Edit Profile Modal */}
      {isEditOpen && (
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
                  className="w-full bg-[#faf8f5] border border-[#e8dfd3] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5d22]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Bio</label>
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  className="w-full bg-[#faf8f5] border border-[#e8dfd3] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5d22] h-24"
                ></textarea>
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