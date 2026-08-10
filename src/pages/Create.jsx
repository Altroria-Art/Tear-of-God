import React, { useState, useEffect } from 'react';

export default function Create() {
  const [mode, setMode] = useState('normal'); // 'normal' | 'top10'
  const [quickAddText, setQuickAddText] = useState(
    "The Witcher 3, Skyrim, Elden Ring, Baldur's Gate 3, Mass Effect 2, Persona 5, Disco Elysium, Dragon Age, Cyberpunk 2077, Final Fantasy VII Remake"
  );
  const [poolItems, setPoolItems] = useState([]);

  // จำลองการ Generate Cards ตอนโหลดหน้าครั้งแรก
  useEffect(() => {
    handleGenerate();
  }, []);

  const handleGenerate = () => {
    const items = quickAddText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    setPoolItems(items);
  };

  const handleRemoveItem = (indexToRemove) => {
    setPoolItems(poolItems.filter((_, index) => index !== indexToRemove));
  };

  // ข้อมูลสีของแต่ละ Tier
  const tierColors = {
    S: 'bg-[#F87171] text-white',
    A: 'bg-[#FDBA74] text-white',
    B: 'bg-[#FEF08A] text-gray-800',
    C: 'bg-[#86EFAC] text-gray-800',
    D: 'bg-[#93C5FD] text-white',
  };

  return (
    <div className="font-sans text-gray-900 pb-20">
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Tier List</h2>
          <p className="text-gray-500">Define your categories and rank items seamlessly.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- Left Column: Controls & Settings --- */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Mode Toggle */}
            <div className="inline-flex bg-[#FDFCF8] p-1 rounded-lg border border-gray-200 shadow-sm">
              <button
                onClick={() => setMode('normal')}
                className={`px-5 py-2 text-sm font-bold rounded-md transition-colors ${
                  mode === 'normal'
                    ? 'bg-white shadow-sm text-gray-900 border border-gray-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Normal Mode
              </button>
              <button
                onClick={() => setMode('top10')}
                className={`px-5 py-2 text-sm font-bold rounded-md transition-colors ${
                  mode === 'top10'
                    ? 'bg-white shadow-sm text-gray-900 border border-gray-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Top 10 Mode
              </button>
            </div>

            {/* Form Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Template Name</label>
                <input
                  type="text"
                  placeholder="Search Tear of God..."
                  className="w-full px-4 py-2.5 bg-[#F6F4ED] border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Category</label>
                <div className="relative">
                  <select className="w-full px-4 py-2.5 bg-[#F6F4ED] border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm appearance-none cursor-pointer">
                    <option>Anime</option>
                    <option>Movies</option>
                    <option>Food</option>
                    <option>Sports</option>
                  </select>
                  <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="What is this tier list about?"
                  className="w-full px-4 py-2.5 bg-[#F6F4ED] border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm resize-none"
                ></textarea>
              </div>
            </div>

            {/* Quick Add Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#8A6A00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                <h3 className="font-bold text-gray-900">Quick Add Items</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Type item names separated by commas to instantly generate text cards. 
                {mode === 'top10' && " Exactly 10 items required for Top 10 Mode."}
              </p>
              <textarea
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                rows="5"
                className="w-full px-4 py-3 bg-[#F6F4ED] border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] text-sm resize-none mb-4 text-gray-700"
              ></textarea>
              <div className="flex justify-end">
                <button 
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#8A6A00] hover:bg-[#6B5300] text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Generate Cards
                </button>
              </div>
            </div>
            
          </div>

          {/* --- Right Column: Canvas & Pool --- */}
          <div className="lg:col-span-8 flex flex-col">
            
            {/* Canvas Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Ranking Canvas</h3>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>

            {/* Canvas Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 flex-grow">
              
              {/* Normal Mode Canvas */}
              {mode === 'normal' && (
                <div className="flex flex-col gap-2">
                  {Object.entries(tierColors).map(([tier, colorClass]) => (
                    <div key={tier} className="flex bg-[#FDFCF8] border border-gray-200 rounded-lg overflow-hidden min-h-[80px]">
                      <div className={`w-20 flex-shrink-0 flex items-center justify-center font-black text-3xl ${colorClass}`}>
                        {tier}
                      </div>
                      <div className="flex-grow p-2 flex flex-wrap gap-2">
                        {/* Placeholder for dragged items */}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top 10 Mode Canvas */}
              {mode === 'top10' && (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <div key={num} className="flex items-center gap-4 bg-white border border-dashed border-gray-300 rounded-lg p-2.5">
                      <div className="w-8 h-8 flex-shrink-0 bg-[#8A6A00] text-white rounded flex items-center justify-center font-bold text-sm shadow-sm">
                        {num}
                      </div>
                      <div className="text-gray-400 italic text-sm w-full">
                        Drop item here...
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Unranked Items Pool */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Unranked Items Pool</h4>
              <div className="bg-[#F6F4ED] border border-dashed border-gray-300 rounded-xl p-6 min-h-[150px] flex flex-wrap gap-3 items-start content-start">
                
                {poolItems.map((item, index) => (
                  <div key={index} className="relative group">
                    <div className="bg-white border border-gray-200 shadow-sm text-sm font-medium text-gray-700 px-4 py-2 rounded-md cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors">
                      {item}
                    </div>
                    <button 
                      onClick={() => handleRemoveItem(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                
                {poolItems.length === 0 && (
                  <div className="w-full text-center text-gray-400 text-sm italic py-8">
                    No items in the pool. Generate some from the left!
                  </div>
                )}

              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-6 border-t border-gray-200 pt-6">
              <button className="text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">
                Save Draft
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-[#8A6A00] hover:bg-[#6B5300] text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Publish List
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}