import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
// Cloudflare backend logic — fetchRankings is the real API call
import { fetchRankings } from '../lib/api';
import { ThumbsUp, ThumbsDown, MessageSquare, Copy } from 'lucide-react';

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const seconds = Math.round((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

const groupItemsByTier = (rankingItems) => {
  if (!rankingItems || !Array.isArray(rankingItems)) return {};
  const map = {};
  rankingItems.forEach((ri) => {
    const tier = ri.tier || 'S';
    if (!map[tier]) map[tier] = [];
    map[tier].push(ri.item?.name || ri.item_id || 'Unknown Item');
  });
  return map;
};

const TIER_COLORS = {
  S: 'bg-[#ff7f7f] text-white',
  A: 'bg-[#ffbf7f] text-white',
  B: 'bg-[#e2e8f0] text-gray-700',
  C: 'bg-[#7fff7f] text-gray-800',
  D: 'bg-[#7faaff] text-white',
};

// Placeholder data for the Kindred tab (until backend supports followed users)
const mockKindredData = [
  {
    id: 'k-1',
    profile: { username: 'ProGamerTH', avatar_url: null },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    title: 'สุดยอดเกม RPG ในตำนาน',
    hashtags: '#RPG,#Gaming',
    stats: { likes: 3400, dislikes: 21, comments: 512 },
    ranking_items: [
      { item: { name: 'The Witcher 3' }, tier: 'S' },
      { item: { name: 'Elden Ring' }, tier: 'S' },
      { item: { name: 'Baldur\'s Gate 3' }, tier: 'A' },
      { item: { name: 'Dark Souls' }, tier: 'A' },
      { item: { name: 'Final Fantasy VII' }, tier: 'B' },
      { item: { name: 'Dragon Age' }, tier: 'C' },
      { item: { name: 'Skyrim' }, tier: 'D' },
    ],
  },
  {
    id: 'k-2',
    profile: { username: 'AniFanClub', avatar_url: null },
    created_at: new Date(Date.now() - 14400000).toISOString(),
    title: '酝 tier list ตัวละครมังงะ',
    hashtags: '#Shonen,#Anime',
    stats: { likes: 1700, dislikes: 8, comments: 289 },
    ranking_items: [
      { item: { name: 'Goku' }, tier: 'S' },
      { item: { name: 'Luffy' }, tier: 'S' },
      { item: { name: 'Naruto' }, tier: 'A' },
      { item: { name: 'Zoro' }, tier: 'A' },
      { item: { name: 'Deku' }, tier: 'B' },
      { item: { name: 'Tanjiro' }, tier: 'C' },
      { item: { name: 'Boruto' }, tier: 'D' },
    ],
  },
];

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0 }) {
  const navigate = useNavigate();
  const likesKey = `tog_likes_${id}`;
  const dislikesKey = `tog_dislikes_${id}`;
  const interactionKey = `tog_interaction_${id}`;

  const [userAction, setUserAction] = useState(() => {
    try { return localStorage.getItem(interactionKey) } catch { return null }
  });
  const [likes, setLikes] = useState(() => {
    const stored = parseInt(localStorage.getItem(likesKey));
    return !isNaN(stored) ? stored : initialLikes;
  });
  const [dislikes, setDislikes] = useState(() => {
    const stored = parseInt(localStorage.getItem(dislikesKey));
    return !isNaN(stored) ? stored : initialDislikes;
  });

  const persist = (next) => { try { localStorage.setItem(interactionKey, next) } catch {} };

  const handleLike = () => {
    if (userAction === 'liked') {
      const newLikes = Math.max(0, likes - 1);
      setLikes(newLikes);
      setUserAction(null);
      try { localStorage.setItem(likesKey, newLikes); } catch {}
      persist(null);
    } else if (userAction === 'disliked') {
      const newDislikes = Math.max(0, dislikes - 1);
      const newLikes = likes + 1;
      setDislikes(newDislikes);
      setLikes(newLikes);
      setUserAction('liked');
      try { localStorage.setItem(likesKey, newLikes); localStorage.setItem(dislikesKey, newDislikes); } catch {}
      persist('liked');
    } else {
      const newLikes = likes + 1;
      setLikes(newLikes);
      setUserAction('liked');
      try { localStorage.setItem(likesKey, newLikes); } catch {}
      persist('liked');
    }
  };

  const handleDislike = () => {
    if (userAction === 'disliked') {
      const newDislikes = Math.max(0, dislikes - 1);
      setDislikes(newDislikes);
      setUserAction(null);
      try { localStorage.setItem(dislikesKey, newDislikes); } catch {}
      persist(null);
    } else if (userAction === 'liked') {
      const newLikes = Math.max(0, likes - 1);
      const newDislikes = dislikes + 1;
      setLikes(newLikes);
      setDislikes(newDislikes);
      setUserAction('disliked');
      try { localStorage.setItem(likesKey, newLikes); localStorage.setItem(dislikesKey, newDislikes); } catch {}
      persist('disliked');
    } else {
      const newDislikes = dislikes + 1;
      setDislikes(newDislikes);
      setUserAction('disliked');
      try { localStorage.setItem(dislikesKey, newDislikes); } catch {}
      persist('disliked');
    }
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <div className="flex items-center gap-6">
        <div onClick={handleLike} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userAction === 'liked' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-900'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </div>

        <div onClick={handleDislike} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userAction === 'disliked' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}>
          <ThumbsDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{dislikes}</span>
        </div>

        <div onClick={() => navigate(`/post/${id}#comments`)} className="flex items-center gap-1.5 text-gray-500 hover:text-[#fbbf24] cursor-pointer transition-colors">
          <MessageSquare size={18} />
          <span className="text-[13px] font-bold">{initialComments}</span>
        </div>
      </div>
    </div>
  );
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  // Cloudflare backend data fetching — preserved as-is
  useEffect(() => {
    async function loadPosts() {
      setIsLoading(true);
      const { data } = await fetchRankings({
        userId: currentUser?.id
      });

      if (data) {
        setPosts(data);
      }
      setIsLoading(false);
    }
    loadPosts();
  }, [currentUser]);

  const displayData = activeTab === 'general' ? posts : mockKindredData;

  return (
    <div className="min-h-screen bg-[#fdfbf7] font-sans">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-[#fdfbf7]">
        <div className="mx-auto flex max-w-3xl justify-center gap-8 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'border-b-2 border-gray-900 font-bold text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kindred')}
            className={`py-3 text-sm font-medium transition-colors ${
              activeTab === 'kindred'
                ? 'border-b-2 border-gray-900 font-bold text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kindred
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6 mt-4">
          {isLoading && activeTab === 'general' && (
            <p className="text-center text-sm font-medium text-gray-400 animate-pulse py-10">
              กำลังโหลดฟีดของคุณ...
            </p>
          )}

          {!isLoading && displayData.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-500 font-medium">ยังไม่มีโพสต์ในระบบเลย</p>
              <button onClick={() => navigate('/create')} className="mt-4 text-sm font-bold text-[#fbbf24] hover:underline">
                สร้าง Tier List เป็นคนแรกเลย!
              </button>
            </div>
          )}

          {!isLoading && displayData.map((post) => {
            const hashtags = post.hashtags ? post.hashtags.split(',').filter(t => t.trim() !== '') : [];
            const tierMap = groupItemsByTier(post.ranking_items);
            const tiers = Object.keys(tierMap).length > 0 ? Object.keys(tierMap) : ['S', 'A'];

            return (
              <article key={post.id} className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100/80">
                
                {/* Header Profile & Use Template Button */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                      {post.profile?.avatar_url ? (
                        <img src={post.profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">
                          {post.profile?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900 leading-tight">
                        {post.profile?.username || 'Unknown User'}
                      </h3>
                      <p className="text-[13px] text-gray-500 font-medium">
                        {timeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate('/create', { state: { templateName: post.title } })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fdfaf3] hover:bg-[#faeec5] text-[#b48e35] text-xs font-bold rounded-full transition-colors border border-[#faeec5]"
                  >
                    <Copy size={12} strokeWidth={2.5} />
                    <span>Use Template: {post.title}</span>
                  </button>
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {hashtags.slice(0, 4).map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-md bg-[#f4f4f5] text-gray-600 text-[11px] font-bold uppercase tracking-wider">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="text-xl font-extrabold mb-5 text-gray-900 cursor-pointer hover:text-[#fbbf24] transition-colors"
                >
                  {post.title}
                </h2>

                {/* Tier List Preview Blocks */}
                <div className="space-y-2 mb-6">
                  {tiers.map((tier) => (
                    <div key={tier} className="flex bg-white rounded-xl border border-gray-100 overflow-hidden min-h-[50px] shadow-sm items-center">
                      <div className={`w-14 self-stretch flex items-center justify-center font-black text-lg ${TIER_COLORS[tier] || 'bg-gray-400 text-white'}`}>
                        {tier}
                      </div>
                      <div className="p-2.5 flex gap-2 overflow-hidden items-center flex-grow flex-wrap bg-white">
                        {tierMap[tier] && tierMap[tier].map((itemName, idx) => (
                          <div 
                            key={idx} 
                            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-center text-xs font-medium text-gray-700 shadow-sm"
                          >
                            <span className="w-full truncate text-[11px] leading-tight">{itemName}</span>
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
                />

              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
