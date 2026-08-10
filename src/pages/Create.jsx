import React, { useState } from 'react';
import { Settings, Upload, X } from 'lucide-react';

const CreateTierList = () => {
  // State สำหรับจัดการโหมดและฟอร์ม
  const [mode, setMode] = useState('normal'); // 'normal' | 'top10'
  const [quickAddText, setQuickAddText] = useState('');
  const [unrankedItems, setUnrankedItems] = useState([]);

  // ฟังก์ชันหั่นข้อความคั่นด้วยคอมมาเป็น Item Cards
  const handleGenerateCards = () => {
    if (!quickAddText.trim()) return;
    const newItems = quickAddText
      .split(',')
      .map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        content: item.trim(),
      }))
      .filter((item) => item.content !== '');
    
    setUnrankedItems([...unrankedItems, ...newItems]);
    setQuickAddText(''); // เคลียร์ช่องพิมพ์
  };

  // ฟังก์ชันลบ Item
  const handleDeleteItem = (idToRemove) => {
    setUnrankedItems(unrankedItems.filter(item => item.id !== idToRemove));
  };

  // ค่าสีสำหรับโหมด Normal (S, A, B, C, D)
  const normalTiers = [
    { label: 'S', color: 'bg-red-400' },
    { label: 'A', color: 'bg-orange-300' },
    { label: 'B', color: 'bg-yellow-300' },
    { label: 'C', color: 'bg-green-400' },
    { label: 'D', color: 'bg-blue-400' },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] p-8 font-sans text-gray-800">
      {/* Header ของเพจ */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Tier List</h1>
        <p className="text-gray-500">Define your categories and rank items seamlessly.</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* ================= LEFT SIDEBAR ================= */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          
          {/* Mode Toggle */}
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
            <button 
              onClick={() => setMode('normal')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${mode === 'normal' ? 'bg-[#f4efe8] shadow-sm text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Normal Mode
            </button>
            <button 
              onClick={() => setMode('top10')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${mode === 'top10' ? 'bg-[#f4efe8] shadow-sm text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Top 10 Mode
            </button>
          </div>

          {/* Form Settings */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Template Name</label>
              <input 
                type="text" 
                placeholder="Search Tear of God..." 
                className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Category</label>
              <select className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E] appearance-none cursor-pointer">
                <option>Anime</option>
                <option>Gaming</option>
                <option>Movies</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea 
                placeholder="What is this tier list about?" 
                rows="3"
                className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E] resize-none"
              ></textarea>
            </div>
          </div>

          {/* Quick Add Items */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-xl">✨</span> Quick Add Items
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Type item names separated by commas to instantly generate text cards.
              {mode === 'top10' && " Exactly 10 items required for Top 10 Mode."}
            </p>
            <textarea 
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              placeholder="The Witcher 3, Skyrim, Elden Ring, Baldur's Gate 3..." 
              rows="4"
              className="w-full bg-[#f4efe8] border-none rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#8B6F4E] resize-none mb-4"
            ></textarea>
            <div className="flex justify-end">
              <button 
                onClick={handleGenerateCards}
                className="bg-[#7c5b36] hover:bg-[#63482a] text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
              >
                <span className="text-lg">⊕</span> Generate Cards
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT CANVAS ================= */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          
          {/* Main Tier Canvas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Ranking Canvas</h2>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Settings size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {/* เรนเดอร์ Tiers ตามโหมดที่เลือก */}
              {mode === 'normal' ? (
                // Normal Mode (S, A, B, C, D)
                normalTiers.map((tier) => (
                  <div key={tier.label} className="flex min-h-[80px] bg-[#f9f8f6] rounded-lg overflow-hidden border border-gray-100">
                    <div className={`${tier.color} w-24 flex items-center justify-center text-white text-2xl font-bold shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]`}>
                      {tier.label}
                    </div>
                    <div className="flex-1 p-2 flex flex-wrap gap-2 items-center">
                      {/* พื้นที่สำหรับ Drop Item (รอต่อกับ Drag and Drop Library) */}
                    </div>
                  </div>
                ))
              ) : (
                // Top 10 Mode (1 - 10)
                Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="flex min-h-[60px] bg-white rounded-lg overflow-hidden items-center gap-3">
                    <div className="bg-[#6b5542] w-12 h-12 flex items-center justify-center text-white text-lg font-bold rounded-lg shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center px-4 text-gray-400 text-sm bg-[#faf9f8]">
                      Drop item here...
                    </div>
                  </div>
                ))
              )}
            </div>

            <hr className="my-6 border-gray-100" />

            {/* Unranked Items Pool (แสดงเฉพาะเมื่อ Mode Normal หรือจัดหน้าให้อยู่กล่องเดียวกันตามภาพ) */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Unranked Items Pool</h3>
              <div className="bg-[#f4efe8] min-h-[120px] rounded-lg p-4 flex flex-wrap gap-3 border border-[#e8dfd3]">
                {unrankedItems.length === 0 ? (
                  <span className="text-gray-400 text-sm italic w-full text-center mt-8">No items yet. Generate them from the left panel.</span>
                ) : (
                  unrankedItems.map((item) => (
                    <div key={item.id} className="group relative bg-white px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-gray-100 flex items-center cursor-grab hover:shadow-md transition-shadow">
                      {item.content}
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end items-center gap-4 mt-8 pt-4">
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Save Draft
              </button>
              <button className="bg-[#7c5b36] hover:bg-[#63482a] text-white text-sm font-medium py-2.5 px-6 rounded-lg flex items-center gap-2 transition-colors">
                <Upload size={16} /> Publish List
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CreateTierList;