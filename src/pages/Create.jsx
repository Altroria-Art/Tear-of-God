import React, { useState } from 'react';
import { Settings, Upload, X, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateTierList = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState('normal');
  const [quickAddText, setQuickAddText] = useState('');
  
  // State สำหรับจัดการการ์ดไอเทมทั้งหมด
  const [items, setItems] = useState([]);
  
  // State สำหรับจัดการแถว (Tiers)
  const [tiers, setTiers] = useState([
    { id: 't1', label: 'S', color: 'bg-red-400' },
    { id: 't2', label: 'A', color: 'bg-orange-300' },
    { id: 't3', label: 'B', color: 'bg-yellow-300' },
    { id: 't4', label: 'C', color: 'bg-green-400' },
    { id: 't5', label: 'D', color: 'bg-blue-400' },
  ]);

  const [activeSettingsTier, setActiveSettingsTier] = useState(null);

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState('General');
  const categories = ['General', 'Movie', 'Food', 'Sports'];

  const availableColors = [
    'bg-red-400', 'bg-orange-300', 'bg-amber-300', 'bg-yellow-300', 
    'bg-lime-400', 'bg-green-400', 'bg-emerald-400', 'bg-teal-400', 
    'bg-cyan-400', 'bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 
    'bg-fuchsia-400', 'bg-pink-400', 'bg-gray-400', 'bg-gray-200'
  ];

  const handleGenerateCards = () => {
    if (!quickAddText.trim()) return;
    const newItems = quickAddText
      .split(',')
      .map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        content: item.trim(),
        tierId: null
      }))
      .filter((item) => item.content !== '');
    
    setItems([...items, ...newItems]);
    setQuickAddText('');
  };

  const handleDeleteItem = (idToRemove) => {
    setItems(items.filter(item => item.id !== idToRemove));
  };

  const updateTierData = (id, field, value) => {
    setTiers(tiers.map(tier => tier.id === id ? { ...tier, [field]: value } : tier));
  };

  // ================= ระบบ Drag and Drop =================
  const handleDragStart = (e, itemId) => {
    e.dataTransfer.setData('itemId', itemId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  const handleDrop = (e, targetTierId) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('itemId');
    
    setItems(items.map(item => 
      item.id === draggedItemId ? { ...item, tierId: targetTierId } : item
    ));
  };

  // ฟังก์ชันช่วย Render การ์ด
  const renderItemCard = (item) => (
    <div 
      key={item.id} 
      draggable
      onDragStart={(e) => handleDragStart(e, item.id)}
      className="group relative bg-white w-20 h-20 rounded-md shadow-sm flex items-center justify-center p-2 text-center text-xs font-medium text-[#334155] border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all z-10"
    >
      <span className="break-words line-clamp-3 leading-tight pointer-events-none">{item.content}</span>
      
      <button 
        onClick={() => handleDeleteItem(item.id)}
        className="absolute -top-1.5 -right-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-20"
      >
        <X size={10} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf8f5] p-8 font-sans text-gray-800 relative">
      
      {/* ================= POPUP SETTINGS MODAL ================= */}
      {activeSettingsTier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#3b322c] text-white w-full max-w-md rounded-lg shadow-2xl relative border border-[#52463e]">
            <button 
              onClick={() => setActiveSettingsTier(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <h3 className="text-center font-bold text-base mb-6">Choose a Label Background Color:</h3>
              <div className="flex flex-wrap justify-center gap-2.5 mb-8 px-4">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => updateTierData(activeSettingsTier.id, 'color', color)}
                    className={`w-8 h-8 rounded-full ${color} cursor-pointer border-2 transition-transform hover:scale-110 ${
                      tiers.find(t => t.id === activeSettingsTier.id)?.color === color 
                        ? 'border-white scale-110' 
                        : 'border-transparent'
                    }`}
                  />
                ))}
              </div>

              <h3 className="text-center font-bold text-base mb-4">Edit Label Text Below:</h3>
              <input
                type="text"
                value={tiers.find(t => t.id === activeSettingsTier.id)?.label || ''}
                onChange={(e) => updateTierData(activeSettingsTier.id, 'label', e.target.value)}
                className="w-full bg-white text-black p-3.5 rounded-md outline-none focus:ring-2 focus:ring-[#8B6F4E] mb-6 font-medium shadow-inner"
              />

              <div className="flex justify-center">
                <button 
                  onClick={() => setActiveSettingsTier(null)}
                  className="bg-[#5c4e45] hover:bg-[#4a3e37] text-white py-3 px-6 rounded-md font-bold transition-colors w-full shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Tier List</h1>
        <p className="text-gray-500">Define your categories and rank items seamlessly.</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* ================= LEFT SIDEBAR ================= */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Template Name</label>
              <input 
                type="text" 
                placeholder="Search Tear of God..." 
                className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E]"
              />
            </div>
            
            {/* ================= Custom Dropdown สุดเท่ ================= */}
            <div className="relative">
              <label className="block text-sm font-semibold mb-1">Category</label>
              <div 
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className={`w-full bg-[#f4efe8] rounded-lg p-3 flex justify-between items-center cursor-pointer transition-all duration-200 border-2 ${isCategoryOpen ? 'border-[#8B6F4E] shadow-sm' : 'border-transparent hover:bg-[#e8e2d8]'}`}
              >
                <span className="text-gray-700 font-medium">{selectedCategory}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180 text-[#8B6F4E]' : ''}`} />
              </div>

              {isCategoryOpen && (
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsCategoryOpen(false)}
                />
              )}

              {isCategoryOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-lg shadow-xl z-20 overflow-hidden">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setIsCategoryOpen(false);
                      }}
                      className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-colors ${
                        selectedCategory === cat 
                          ? 'bg-[#f4efe8] font-bold text-[#8B6F4E]' 
                          : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {cat}
                      {selectedCategory === cat && <Check size={18} strokeWidth={2.5} className="text-[#8B6F4E]" />}
                    </div>
                  ))}
                </div>
              )}
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-xl">✨</span> Quick Add Items
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Type item names separated by commas to instantly generate text cards.
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">

            <div className="flex flex-col gap-2">
              {mode === 'normal' ? (
                tiers.map((tier) => (
                  <div key={tier.id} className="flex min-h-[80px] bg-[#f9f8f6] rounded-lg overflow-hidden border border-gray-100">
                    
                    <div className={`${tier.color} w-24 flex items-center justify-center text-white text-2xl font-bold shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)] p-2 text-center break-words`}>
                      {tier.label}
                    </div>

                    {/* พื้นที่ Drop Item */}
                    <div 
                      className="flex-1 p-2 flex flex-wrap gap-2 items-center"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, tier.id)}
                    >
                      {items.filter(item => item.tierId === tier.id).map(renderItemCard)}
                    </div>

                    <div className="w-12 bg-transparent flex items-center justify-center border-l border-gray-200">
                      <button 
                        onClick={() => setActiveSettingsTier(tier)}
                        className="text-gray-400 hover:text-[#7c5b36] hover:bg-[#f4efe8] transition-all p-2 rounded-full"
                        title="Settings"
                      >
                        <Settings size={18} />
                      </button>
                    </div>

                  </div>
                ))
              ) : (
                Array.from({ length: 10 }).map((_, idx) => (
                   <div key={idx} className="flex min-h-[60px] bg-white overflow-hidden items-center gap-3 p-2 border border-gray-100 rounded-lg">
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

            {/* ================= UNRANKED ITEMS POOL ================= */}
            <div>
              <h3 className="text-sm font-bold text-[#64748b] uppercase tracking-wider mb-3">Unranked Items Pool</h3>
              
              <div 
                className="bg-[#f5f1ea] min-h-[140px] rounded-lg p-5 flex flex-wrap gap-3 border border-[#e8dfd3]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
              >
                {items.filter(item => item.tierId === null).length === 0 ? (
                  <span className="text-gray-400 text-sm italic w-full text-center mt-8 pointer-events-none">
                    No items yet. Generate them from the left panel.
                  </span>
                ) : (
                  items.filter(item => item.tierId === null).map(renderItemCard)
                )}
              </div>
            </div>

            <div className="flex justify-end items-center mt-8 pt-4">
              <button 
                onClick={() => navigate('/rank')}
                className="bg-[#7c5b36] hover:bg-[#63482a] text-white text-sm font-medium py-2.5 px-6 rounded-lg flex items-center gap-2 transition-colors"
              >
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