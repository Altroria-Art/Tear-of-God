import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchRankings } from '../lib/api'; // 📍 นำเข้า API

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [popularTemplates, setPopularTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📍 ดึงข้อมูลจากฐานข้อมูลจริง
  useEffect(() => {
    async function loadDiscover() {
      setIsLoading(true);
      // สมมติว่าส่ง parameter ไปบอก API ว่าให้ดึงตัวยอดฮิต (Trending)
      const { data } = await fetchRankings({ category: 'Trending' });
      if (data) {
        setPopularTemplates(data);
      }
      setIsLoading(false);
    }
    loadDiscover();
  }, []);

  const handleProtectedAction = (callback) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้ครับ!');
      navigate('/login');
      return;
    }
    if (callback) callback();
  };

  const handleUseTemplate = (templateName) => {
    handleProtectedAction(() => {
      navigate('/create', { state: { templateName } });
    });
  };

  return (
    <div className="bg-[#fef9f2] text-[#1d1c18] font-sans min-h-screen flex flex-col">
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12">
        
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1d1c18] mb-2">Discover</h1>
          <p className="text-base text-[#4b4639]">Explore top tier lists and templates from the community.</p>
        </div>

        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Templates</h2>
          </div>

          {/* 📍 ใช้ Map ดึงข้อมูลของจริงแทนการ์ดที่เขียนหลอกไว้ */}
          {isLoading ? (
            <p className="text-gray-500 animate-pulse text-center py-10">กำลังโหลดเทมเพลตยอดนิยม...</p>
          ) : popularTemplates.length === 0 ? (
            <p className="text-gray-500 text-center py-10">ยังไม่มีเทมเพลตในระบบ</p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              {popularTemplates.slice(0, 8).map((template) => {
                // จัดกลุ่ม Tier แบบย่อสำหรับ Preview
                const tiersMap = {};
                template.ranking_items?.forEach(ri => {
                  if (!tiersMap[ri.tier]) tiersMap[ri.tier] = [];
                  tiersMap[ri.tier].push(ri.item?.name || ri.item_id);
                });

                return (
                  <div key={template.id} className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                    <div className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
                      <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
                        <span className="material-symbols-outlined text-[14px]">group</span> {template.stats?.views || 0}
                      </div>
                      
                      {/* Preview S Tier */}
                      {tiersMap['S'] && (
                        <div className="flex gap-2 h-1/2">
                          <div className="bg-[#ff7f7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">S</div>
                          <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                            {tiersMap['S'].slice(0, 2).map((item, idx) => (
                              <span key={idx} className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639] whitespace-nowrap">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Preview A Tier */}
                      {tiersMap['A'] && (
                        <div className="flex gap-2 h-1/2">
                          <div className="bg-[#ffbf7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">A</div>
                          <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                            {tiersMap['A'].slice(0, 2).map((item, idx) => (
                              <span key={idx} className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639] whitespace-nowrap">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                      <div>
                        <h3 className="text-lg font-bold text-[#1d1c18] mb-2 line-clamp-1">{template.title}</h3>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200">
                             {template.profile?.avatar_url ? (
                               <img src={template.profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-[#556074] text-white text-xs font-bold">
                                 {template.profile?.username?.substring(0, 2).toUpperCase() || 'U'}
                               </div>
                             )}
                          </div>
                          <span className="text-sm text-[#4b4639]">@{template.profile?.username || 'User'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUseTemplate(template.title)}
                        className="w-full py-2.5 bg-[#ffc329] hover:bg-[#f9bd22] text-[#261a00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Hashtags</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {['#anime', '#movies', '#gaming', '#food', '#sports', '#music', '#tierlist'].map((tag, idx) => (
              <button 
                key={idx}
                onClick={() => navigate(`/?hashtag=${tag.replace('#', '')}`)}
                className="px-4 py-2 bg-[#f2ede6] border border-[#cec6b4] rounded-full text-[#4b4639] hover:bg-[#ece7e1] transition-colors font-bold text-sm shadow-xs"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}