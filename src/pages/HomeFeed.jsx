import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings, voteRanking } from '../lib/api'; // 📍 นำเข้า voteRanking สำหรับบันทึกโหวตลง Cloudflare
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

// 📍 [ลบ mockKindredData ทิ้งไปเรียบร้อย บอทจะไม่มากวนใจอีก!]

function FeedCardActionBar({ id, initialLikes = 0, initialDislikes = 0, initialComments = 0, initialUserVote = null }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // seed จาก post.user_vote ที่ API ส่งมาเท่านั้น — ห้าม useState(null) เฉยๆ
  // (ดู docs/feature-like-dislike-voting.md §8)
  const [userVote, setUserVote] = useState(initialUserVote);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);

  // state machine เดียวรับทั้ง like/dislike: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action
  const handleVote = async (type) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนกดไลก์ครับ!');
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
      alert('บันทึกการโหวตไม่สำเร็จ: ' + (result.error || 'เกิดข้อผิดพลาด'));
    }
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <div className="flex items-center gap-6">
        <div onClick={() => handleVote('like')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'like' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-900'}`}>
          <ThumbsUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[13px] font-bold">{likes}</span>
        </div>

        <div onClick={() => handleVote('dislike')} className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${userVote === 'dislike' ? 'text-red-500' : 'text-gray-500 hover:text-gray-900'}`}>
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

  useEffect(() => {
    async function loadPosts() {
      setIsLoading(true);
      // ดึงข้อมูลจริงจากฐานข้อมูล (แยกตามแท็บ General หรือ Kindred ถ้ามีระบบหลังบ้านรองรับ)
      const { data } = await fetchRankings({
        userId: currentUser?.id,
        feedType: activeTab
      });

      if (data) {
        setPosts(data);
      } else {
        setPosts([]);
      }
      setIsLoading(false);
    }
    loadPosts();
  }, [currentUser, activeTab]);

  const displayData = posts;

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
          {isLoading && (
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
                  initialUserVote={post.user_vote ?? null}
                />

              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}