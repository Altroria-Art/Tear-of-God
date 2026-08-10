import React, { useState } from 'react';

// --- Mock Data จัดเต็มทุกหมวดหมู่ ---
const feedData = [
  {
    id: 1,
    user: { name: 'Alex Mercer', avatar: 'https://i.pravatar.cc/150?u=alex', time: '2 hours ago' },
    template: 'RPGs of the Decade',
    category: 'Sports',
    title: 'GOAT NBA Players of All Time',
    type: 'tier',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Michael Jordan', 'LeBron James'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Kobe Bryant', 'Magic Johnson'] },
    ],
    stats: { likes: '1.2k', comments: '342' }
  },
  {
    id: 2,
    user: { name: 'Sarah Chen', avatar: 'SC', time: '5 hours ago', isInitials: true },
    template: 'Sci-Fi Movies',
    category: 'Movies',
    title: 'Best Sci-Fi Movies of the 2010s',
    type: 'tier',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Inception', 'Arrival'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Blade Runner 2049'] },
    ],
    stats: { likes: '3.4k', comments: '512' }
  },
  {
    id: 3,
    user: { name: 'Chef Mike', avatar: 'https://i.pravatar.cc/150?u=mike', time: 'Yesterday' },
    template: 'Burger Rankings',
    category: 'Food',
    title: 'Ultimate Fast Food Burgers Tier List',
    type: 'tier',
    items: [
      { tier: 'S', tierColor: 'bg-[#F87171] text-white', contents: ['Burger 1'] },
      { tier: 'A', tierColor: 'bg-[#FDBA74] text-white', contents: ['Burger 2'] },
      { tier: 'B', tierColor: 'bg-[#D1D5DB] text-gray-600', contents: ['Burger 3'] },
    ],
    stats: { likes: '12k', comments: '2.1k' }
  },
  {
    id: 4,
    user: { name: 'Kenji Sato', avatar: 'https://i.pravatar.cc/150?u=kenji', time: '1 day ago' },
    template: 'Shonen Jump',
    category: 'Anime',
    title: 'Top Shonen Anime of All Time',
    type: 'ranking',
    items: [
      { rank: 1, content: 'Fullmetal Alchemist: Brotherhood' },
      { rank: 2, content: 'Hunter x Hunter' },
      { rank: 3, content: 'One Piece' },
    ],
    hasMore: true,
    stats: { likes: '8.5k', comments: '1.2k' }
  }
];

export default function HomeFeed() {
  const [activeTab, setActiveTab] = useState('For You');
  const tabs = ['For You', 'Trending', 'Movies', 'Anime', 'Food', 'Sports'];

  // --- พระเอกของเรา: ฟังก์ชันกรองข้อมูลตาม Tab ที่กด ---
  const filteredFeed = feedData.filter((post) => {
    // ถ้าเป็นหน้า For You หรือ Trending ให้โชว์ทั้งหมดไปก่อน (เพราะเราจำลองข้อมูล)
    if (activeTab === 'For You' || activeTab === 'Trending') {
      return true;
    }
    // ถ้ากดหมวดหมู่อื่น ให้เช็คว่า category ของโพสต์ ตรงกับ tab ที่กดไหม
    return post.category.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-[#FDFCF8] font-sans text-gray-900">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#FDFCF8] sticky top-0 z-10">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-[#6B5300]">Tear of God</h1>
          <nav className="hidden md:flex gap-6 text-sm font-bold text-gray-700">
            <a href="#" className="border-b-2 border-[#6B5300] text-black pb-1">Home</a>
            <a href="#" className="hover:text-black pb-1">Create</a>
            <a href="#" className="hover:text-black pb-1">Discover</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search Tear of God..." 
              className="pl-10 pr-4 py-2 bg-[#F6F4ED] border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 w-64"
            />
          </div>
          <button className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Dynamic Category Tabs */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-2">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-bold rounded-full shadow-sm whitespace-nowrap transition-colors ${
                activeTab === tab 
                  ? 'bg-[#FACC15] text-[#4A3800] border border-transparent' 
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div className="space-y-6">
          {filteredFeed.length > 0 ? (
            filteredFeed.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))
          ) : (
            // แสดงข้อความนี้ถ้ากดแท็บที่ไม่มีข้อมูล
            <div className="text-center py-12 text-gray-400 font-medium">
              No lists in this category yet. Be the first to create one!
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

// --- Component สำหรับแสดง Card แต่ละอัน ---
function FeedCard({ post }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {post.user.isInitials ? (
            <div className="w-10 h-10 rounded-full bg-[#E0E7FF] text-[#1E40AF] flex items-center justify-center font-bold text-sm">
              {post.user.avatar}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {post.user.avatar.includes('http') ? (
                    <img src={post.user.avatar} alt={post.user.name} className="w-full h-full object-cover" />
                ) : (
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                )}
            </div>
          )}
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{post.user.name}</h3>
            <p className="text-[12px] text-gray-400">{post.user.time}</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-[11px] font-bold text-[#8A6A00] bg-[#FFFBEB] px-3 py-1.5 rounded-full border border-[#FDE68A] hover:bg-[#FEF3C7] transition-colors">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/></svg>
          Use Template{post.template !== 'Use Template' ? `: ${post.template}` : ''}
        </button>
      </div>

      <div className="mb-4">
        <span className="inline-block px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold rounded uppercase tracking-wider mb-2">
          {post.category}
        </span>
        <h2 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h2>

        <div className="border border-gray-100 rounded-lg overflow-hidden bg-[#FDFCF8] flex flex-col gap-1 p-1">
          {post.type === 'tier' && post.items.map((row, idx) => (
            <div key={idx} className="flex bg-white border border-gray-100 rounded-md overflow-hidden min-h-[40px]">
              <div className={`w-12 flex-shrink-0 flex items-center justify-center font-black text-lg ${row.tierColor}`}>
                {row.tier}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-2 w-full">
                {row.contents.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-[#F9F9F9] border border-gray-200 text-xs font-medium rounded shadow-sm text-gray-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {post.type === 'ranking' && post.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 bg-white border border-gray-100 rounded-md p-2">
              <div className="w-6 h-6 flex-shrink-0 bg-[#6B5300] text-white rounded flex items-center justify-center text-xs font-bold shadow-sm">
                {item.rank}
              </div>
              <span className="text-sm font-medium text-gray-800">{item.content}</span>
            </div>
          ))}
          
          {post.hasMore && (
            <div className="text-center py-2">
              <a href="#" className="text-[11px] font-bold text-gray-500 hover:text-gray-800 transition-colors">See full top 10</a>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-gray-500">
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514"/></svg>
            <span className="text-xs font-bold">{post.stats.likes}</span>
          </button>
          <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.514"/></svg>
          </button>
          <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <span className="text-xs font-bold">{post.stats.comments}</span>
          </button>
        </div>
        <button className="hover:text-gray-900 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
        </button>
      </div>
    </div>
  );
}