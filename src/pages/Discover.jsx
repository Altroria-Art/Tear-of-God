import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState('');

  // ฟังก์ชันป้องกันการกดใช้งาน (เช่น ปุ่ม Use) ถ้ายังไม่ล็อกอินจะเด้งไปหน้า login
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
      // พาไปหน้าสร้างหรือหน้าจัดอันดับพร้อม Template นั้นๆ
      navigate('/create', { state: { templateName } });
    });
  };

  return (
    <div className="bg-[#fef9f2] text-[#1d1c18] font-sans min-h-screen flex flex-col">
      
      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12">
        
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1d1c18] mb-2">Discover</h1>
          <p className="text-base text-[#4b4639]">Explore top tier lists and templates from the community.</p>
        </div>

        {/* Popular Templates Section */}
        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Templates</h2>
            <button className="text-sm font-bold text-[#564600] hover:text-[#795900] transition-colors">View All</button>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            
            {/* Template Card 1 */}
            <div className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">group</span> 15.2k
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ff7f7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">S</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">One Piece</span>
                  </div>
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ffbf7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">A</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Naruto</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                <div>
                  <h3 className="text-lg font-bold text-[#1d1c18] mb-2">Top Shonen Anime</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#556074] text-white text-xs flex items-center justify-center font-bold">AL</div>
                    <span className="text-sm text-[#4b4639]">@animelover</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUseTemplate('Top Shonen Anime')}
                  className="w-full py-2.5 bg-[#ffc329] hover:bg-[#f9bd22] text-[#261a00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Use Template
                </button>
              </div>
            </div>

            {/* Template Card 2 */}
            <div className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">group</span> 8.4k
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ff7f7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">S</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Se7en</span>
                  </div>
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ffbf7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">A</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Fargo</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                <div>
                  <h3 className="text-lg font-bold text-[#1d1c18] mb-2">Best 90s Thrillers</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#705e16] text-white text-xs flex items-center justify-center font-bold">CP</div>
                    <span className="text-sm text-[#4b4639]">@cinephile</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUseTemplate('Best 90s Thrillers')}
                  className="w-full py-2.5 bg-[#ffc329] hover:bg-[#f9bd22] text-[#261a00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Use Template
                </button>
              </div>
            </div>

            {/* Template Card 3 */}
            <div className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">group</span> 22.1k
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ff7f7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">S</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Tacos</span>
                  </div>
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ffbf7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">A</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Crepes</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                <div>
                  <h3 className="text-lg font-bold text-[#1d1c18] mb-2">Street Food Classics</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#795900] text-white text-xs flex items-center justify-center font-bold">FD</div>
                    <span className="text-sm text-[#4b4639]">@foodie_dave</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUseTemplate('Street Food Classics')}
                  className="w-full py-2.5 bg-[#ffc329] hover:bg-[#f9bd22] text-[#261a00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Use Template
                </button>
              </div>
            </div>

            {/* Template Card 4 */}
            <div className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">group</span> 18.5k
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ff7f7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">S</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Zelda: BotW</span>
                  </div>
                </div>
                <div className="flex gap-2 h-1/2">
                  <div className="bg-[#ffbf7f] w-12 flex items-center justify-center rounded-l text-white font-bold text-sm">A</div>
                  <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639]">Mario Odyssey</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between bg-white">
                <div>
                  <h3 className="text-lg font-bold text-[#1d1c18] mb-2">Switch Games</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#ba1a1a] text-white text-xs flex items-center justify-center font-bold">NG</div>
                    <span className="text-sm text-[#4b4639]">@nintendoguy</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUseTemplate('Switch Games')}
                  className="w-full py-2.5 bg-[#ffc329] hover:bg-[#f9bd22] text-[#261a00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Use Template
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Popular Hashtags Section */}
        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Hashtags</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {['#anime', '#movies', '#gaming', '#food', '#sports', '#music', '#tierlist'].map((tag, idx) => (
              <button 
                key={idx}
                onClick={() => alert(`Selected hashtag: ${tag}`)}
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