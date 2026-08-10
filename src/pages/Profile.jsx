import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // เพิ่มการนำเข้า useNavigate

// --- Mock Data ---
const userData = {
  name: 'AlexRanker',
  bio: 'Master of RPG lists. Categorizing the virtual world one tier at a time.',
  avatar: 'https://i.pravatar.cc/150?u=alexranker',
  joined: 'Oct 2023',
  views: '45.2k'
};

const profileFeedData = [
  {
    id: 1,
    action: 'CREATED A TEMPLATE',
    title: 'Best Sci-Fi Movies of the 2010s',
    author: 'AlexRanker',
    time: '3 days ago',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Inception', 'Arrival'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Interstellar'] },
    ],
    stats: { likes: '420', comments: '12' }
  },
  {
    id: 2,
    action: 'CREATED A TEMPLATE',
    title: 'Ultimate Fast Food Burgers Tier List',
    author: 'AlexRanker',
    time: '5 days ago',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Double-Double', 'ShackBurger'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Whopper'] },
    ],
    stats: { likes: '215', comments: '8' }
  },
  {
    id: 3,
    action: 'PARTICIPATED IN A LIST',
    title: 'Top JRPG Protagonists',
    author: 'JRPGFan',
    time: '1 week ago',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Cloud Strife', 'Joker'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Yuri Lowell'] },
    ],
    stats: { likes: '850', comments: '45' }
  }
];

export default function Profile() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const navigate = useNavigate(); // เรียกใช้งาน useNavigate

  return (
    <div className="bg-[#FDFCF8] min-h-screen font-sans text-gray-900 pb-12">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* --- Left Column: User Info --- */}
          <div className="md:col-span-4 lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center sticky top-24">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-md mb-4 bg-gray-100">
                <img src={userData.avatar} alt={userData.name} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{userData.name}</h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {userData.bio}
              </p>
              
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full bg-[#8A6A00] hover:bg-[#6B5300] text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm mb-8"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit Profile
              </button>

              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-gray-400 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Joined
                  </div>
                  <span className="font-bold text-gray-700">{userData.joined}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-gray-400 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    List Views
                  </div>
                  <span className="font-bold text-gray-700">{userData.views}</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Right Column: Activity Feed --- */}
          <div className="md:col-span-8 lg:col-span-9 space-y-6">
            
            {/* Create New Template Button */}
            <button 
              onClick={() => navigate('/create')} 
              className="w-full bg-[#FDFCF8] border-2 border-dashed border-gray-300 rounded-xl p-5 flex items-center justify-center gap-4 hover:bg-white hover:border-[#8A6A00] transition-colors group"
            >
              <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#FFFBEB] rounded-full flex items-center justify-center text-gray-500 group-hover:text-[#8A6A00] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-900 text-lg">Create New Template</h3>
                <p className="text-sm text-gray-500">Start a new tier list from scratch</p>
              </div>
            </button>

            {/* User Feed */}
            {profileFeedData.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      {post.action}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Originally by {post.author}</p>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </div>

                {/* Tier Rows */}
                <div className="border border-gray-100 rounded-lg overflow-hidden bg-[#FDFCF8] flex flex-col gap-1 p-1 mb-4">
                  {post.items.map((row, idx) => (
                    <div key={idx} className="flex bg-white border border-gray-100 rounded-md overflow-hidden min-h-[40px]">
                      <div className={`w-10 flex-shrink-0 flex items-center justify-center font-black text-lg ${row.tierColor}`}>
                        {row.tier}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 p-1.5 w-full">
                        {row.contents.map((item, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-gray-200 text-xs font-medium rounded shadow-sm text-gray-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-gray-400 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {post.time}
                  </div>
                  <div className="flex items-center gap-5">
                    <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514"/></svg>
                      {post.stats.likes}
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.514"/></svg>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                      Share
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                      {post.stats.comments}
                    </button>
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>
      </main>

      {/* --- Modal: Edit Profile --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-[#FDFCF8] rounded-2xl w-full max-w-md shadow-xl overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-gray-200 mb-3 cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <button className="text-xs font-bold text-[#8A6A00] hover:text-[#6B5300] uppercase tracking-wider">
                  Change Photo
                </button>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Display Name</label>
                <input 
                  type="text" 
                  defaultValue={userData.name}
                  className="w-full px-4 py-2.5 bg-[#F6F4ED] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Bio</label>
                <textarea 
                  rows="3"
                  defaultValue={userData.bio}
                  className="w-full px-4 py-2.5 bg-[#F6F4ED] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm text-gray-900 resize-none"
                ></textarea>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-gray-200">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 bg-[#8A6A00] hover:bg-[#6B5300] text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}