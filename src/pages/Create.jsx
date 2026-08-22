import React, { useState } from 'react';
import { Settings, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { createRanking } from '../lib/api';
import { useToast } from '../components/ui/Toast';

const CreateTierList = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const toast = useToast();

  const [mode, setMode] = useState('normal');
  const [quickAddText, setQuickAddText] = useState('');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [items, setItems] = useState([]);
  const [tiers, setTiers] = useState([
    { id: 't1', label: 'S', color: 'bg-red-400' },
    { id: 't2', label: 'A', color: 'bg-orange-300' },
    { id: 't3', label: 'B', color: 'bg-yellow-300' },
    { id: 't4', label: 'C', color: 'bg-green-400' },
    { id: 't5', label: 'D', color: 'bg-blue-400' },
  ]);

  const [activeSettingsTier, setActiveSettingsTier] = useState(null);

  // 📍 ระบบ Hashtag (มาแทนที่ Category)
  const [hashtags, setHashtags] = useState(['#Gaming', '#Anime', '#Movie', '#Food', '#Sports', '#Music']);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const availableColors = [
    'bg-red-400', 'bg-orange-300', 'bg-amber-300', 'bg-yellow-300', 
    'bg-lime-400', 'bg-green-400', 'bg-emerald-400', 'bg-teal-400', 
    'bg-cyan-400', 'bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 
    'bg-fuchsia-400', 'bg-pink-400', 'bg-gray-400', 'bg-gray-200'
  ];

  const handleGenerateCards = () => {
    if (!quickAddText.trim()) return;
    const newItems = quickAddText.split(',').map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        content: item.trim(),
        tierId: null
      })).filter((item) => item.content !== '');
    setItems([...items, ...newItems]);
    setQuickAddText('');
  };

  const handleDeleteItem = (idToRemove) => setItems(items.filter(item => item.id !== idToRemove));
  const updateTierData = (id, field, value) => setTiers(tiers.map(tier => tier.id === id ? { ...tier, [field]: value } : tier));

  // ฟังก์ชัน Hashtag
  const handleToggleHashtag = (tag) => selectedHashtags.includes(tag) ? setSelectedHashtags(selectedHashtags.filter(t => t !== tag)) : setSelectedHashtags([...selectedHashtags, tag]);
  const handleRemoveSelectedTag = (tagToRemove) => setSelectedHashtags(selectedHashtags.filter(t => t !== tagToRemove));
  
  const handleAddHashtag = (e) => {
    if (e.key === 'Enter' && newTagText.trim()) {
      e.preventDefault();
      const formattedTag = newTagText.startsWith('#') ? newTagText.trim() : `#${newTagText.trim()}`;
      if (!hashtags.includes(formattedTag)) setHashtags([...hashtags, formattedTag]);
      if (!selectedHashtags.includes(formattedTag)) setSelectedHashtags([...selectedHashtags, formattedTag]);
      setNewTagText('');
      setShowNewTagInput(false);
    }
  };

  const handleDragStart = (e, itemId) => e.dataTransfer.setData('itemId', itemId);
  const handleDragOver = (e) => e.preventDefault(); 
  const handleDrop = (e, targetTierId) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('itemId');
    setItems(items.map(item => item.id === draggedItemId ? { ...item, tierId: targetTierId } : item));
  };

  const renderItemCard = (item) => (
    <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item.id)} className="group relative bg-white w-20 h-20 rounded-md shadow-sm flex items-center justify-center p-2 text-center text-xs font-medium text-[#334155] border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all z-10">
      <span className="break-words line-clamp-3 leading-tight pointer-events-none">{item.content}</span>
      <button onClick={() => handleDeleteItem(item.id)} className="absolute -top-1.5 -right-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-20"><X size={10} /></button>
    </div>
  );

  const handlePublish = async () => {
    if (!currentUser) return toast.warning('กรุณาเข้าสู่ระบบก่อน Publish Tier List');
    if (!title.trim()) return toast.warning('กรุณาตั้งชื่อ Template Name ก่อนครับ');
    if (selectedHashtags.length === 0) return toast.warning('กรุณาเลือก Hashtag อย่างน้อย 1 อันครับ');

    // 📍 [เพิ่มใหม่]: ต้องมี item และจัด tier แล้วเท่านั้น — ไม่งั้นจะได้โพสต์เปล่า
    const rankedItems = items.filter(item => item.tierId !== null);
    if (items.length === 0) {
      return toast.error('Please add an item and make your tier list.');
    }
    if (rankedItems.length === 0) {
      return toast.error('Please make your tier list.');
    }

    setIsPublishing(true);
    const rankingData = {
      payload: {
        title: title,
        description: description,
        // ใช้ Hashtag อันแรกเป็น Category หลักไปเลยแบบเนียนๆ
        category: selectedHashtags[0].replace('#', '').toLowerCase(),
        hashtags: selectedHashtags.join(','),
        user_id: currentUser.id,
        // ส่งข้อมูลโปรไฟล์ไปด้วย เผื่อ DB เอาไปใช้บันทึก
        username: currentUser.username,
        avatar_url: currentUser.avatar_url
      },
      items: rankedItems.map((item, index) => {
        const tierObj = tiers.find(t => t.id === item.tierId);
        return { item_id: item.content, tier: tierObj ? tierObj.label : 'S', position: index };
      })
    };

    const { data, error } = await createRanking(rankingData);
    setIsPublishing(false);

    if (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error);
    } else {
      toast.success('Publish เรียบร้อย!');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] p-8 font-sans text-gray-800 relative">
      
      {/* POPUP SETTINGS MODAL */}
      {activeSettingsTier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#3b322c] text-white w-full max-w-md rounded-lg shadow-2xl relative border border-[#52463e]">
            <button onClick={() => setActiveSettingsTier(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            <div className="p-8">
              <h3 className="text-center font-bold text-base mb-6">Choose a Label Background Color:</h3>
              <div className="flex flex-wrap justify-center gap-2.5 mb-8 px-4">
                {availableColors.map(color => (
                  <button key={color} onClick={() => updateTierData(activeSettingsTier.id, 'color', color)}
                    className={`w-8 h-8 rounded-full ${color} cursor-pointer border-2 transition-transform hover:scale-110 ${tiers.find(t => t.id === activeSettingsTier.id)?.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  />
                ))}
              </div>
              <h3 className="text-center font-bold text-base mb-4">Edit Label Text Below:</h3>
              <input type="text" value={tiers.find(t => t.id === activeSettingsTier.id)?.label || ''} onChange={(e) => updateTierData(activeSettingsTier.id, 'label', e.target.value)} className="w-full bg-white text-black p-3.5 rounded-md outline-none focus:ring-2 focus:ring-[#8B6F4E] mb-6 font-medium shadow-inner" />
              <div className="flex justify-center">
                <button onClick={() => setActiveSettingsTier(null)} className="bg-[#5c4e45] hover:bg-[#4a3e37] text-white py-3 px-6 rounded-md font-bold transition-colors w-full shadow-sm">Save</button>
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
        
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
            <button onClick={() => setMode('normal')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${mode === 'normal' ? 'bg-[#f4efe8] shadow-sm text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>Normal Mode</button>
            <button onClick={() => setMode('top10')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${mode === 'top10' ? 'bg-[#f4efe8] shadow-sm text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>Top 10 Mode</button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold mb-1">Template Name</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. Best 90s Movies..." className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E]" />
            </div>
            
            {/* 📍 Hashtags Section (มาแทนที่ Category) */}
            <div>
              <label className="block text-sm font-semibold mb-1">Hashtags / Category</label>
              <p className="text-xs text-gray-500 mb-2">Select or create tags to categorize your list.</p>
              
              {selectedHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedHashtags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#7c5b36] text-white text-xs font-medium rounded-md shadow-sm">
                      {tag} <button type="button" onClick={() => handleRemoveSelectedTag(tag)} className="hover:text-red-200 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mb-3">
                {hashtags.filter(t => !selectedHashtags.includes(t)).map((tag, idx) => (
                  <button key={idx} type="button" onClick={() => handleToggleHashtag(tag)} className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border bg-[#f4efe8] border-gray-200 text-gray-700 hover:bg-[#e8e2d8]">
                    + {tag}
                  </button>
                ))}
              </div>
              
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <button type="button" onClick={() => setShowNewTagInput(!showNewTagInput)} className="text-xs font-bold text-[#7c5b36] hover:underline flex items-center gap-1 w-max">
                  <Upload size={12} className="rotate-45" /> Create Custom Hashtag
                </button>
                {showNewTagInput && (
                  <input type="text" value={newTagText} onChange={(e) => setNewTagText(e.target.value)} onKeyDown={handleAddHashtag} placeholder="Type tag & press enter (e.g. #Horror)" className="w-full bg-[#f4efe8] border-none rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#8B6F4E]" autoFocus />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this tier list about?" rows="3" className="w-full bg-[#f4efe8] border-none rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#8B6F4E] resize-none"></textarea>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><span className="text-xl">✨</span> Quick Add Items</h3>
            <p className="text-xs text-gray-500 mb-4">Type item names separated by commas.</p>
            <textarea value={quickAddText} onChange={(e) => setQuickAddText(e.target.value)} placeholder="Item 1, Item 2, Item 3..." rows="4" className="w-full bg-[#f4efe8] border-none rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#8B6F4E] resize-none mb-4"></textarea>
            <div className="flex justify-end">
              <button onClick={handleGenerateCards} className="bg-[#7c5b36] hover:bg-[#63482a] text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
                <span className="text-lg">⊕</span> Generate
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT CANVAS */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">

            <div className="flex flex-col gap-2">
              {mode === 'normal' ? (
                tiers.map((tier) => (
                  <div key={tier.id} className="flex min-h-[80px] bg-[#f9f8f6] rounded-lg overflow-hidden border border-gray-100">
                    <div className={`${tier.color} w-24 flex items-center justify-center text-white text-2xl font-bold shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)] p-2 text-center break-words`}>{tier.label}</div>
                    <div className="flex-1 p-2 flex flex-wrap gap-2 items-center" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tier.id)}>
                      {items.filter(item => item.tierId === tier.id).map(renderItemCard)}
                    </div>
                    <div className="w-12 bg-transparent flex items-center justify-center border-l border-gray-200">
                      <button onClick={() => setActiveSettingsTier(tier)} className="text-gray-400 hover:text-[#7c5b36] hover:bg-[#f4efe8] transition-all p-2 rounded-full" title="Settings"><Settings size={18} /></button>
                    </div>
                  </div>
                ))
              ) : (
                Array.from({ length: 10 }).map((_, idx) => (
                   <div key={idx} className="flex min-h-[60px] bg-white overflow-hidden items-center gap-3 p-2 border border-gray-100 rounded-lg">
                    <div className="bg-[#6b5542] w-12 h-12 flex items-center justify-center text-white text-lg font-bold rounded-lg shrink-0">{idx + 1}</div>
                    <div className="flex-1 h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center px-4 text-gray-400 text-sm bg-[#faf9f8]">Drop item here...</div>
                  </div>
                ))
              )}
            </div>

            <hr className="my-6 border-gray-100" />

            {/* UNRANKED ITEMS POOL */}
            <div>
              <h3 className="text-sm font-bold text-[#64748b] uppercase tracking-wider mb-3">Unranked Items Pool</h3>
              <div className="bg-[#f5f1ea] min-h-[140px] rounded-lg p-5 flex flex-wrap gap-3 border border-[#e8dfd3]" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null)}>
                {items.filter(item => item.tierId === null).length === 0 ? (
                  <span className="text-gray-400 text-sm italic w-full text-center mt-8 pointer-events-none">No items yet. Generate them from the left panel.</span>
                ) : (
                  items.filter(item => item.tierId === null).map(renderItemCard)
                )}
              </div>
            </div>

            <div className="flex justify-end items-center mt-8 pt-4">
              <button onClick={handlePublish} disabled={isPublishing} className="bg-[#7c5b36] hover:bg-[#63482a] disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-6 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
                {isPublishing ? 'Publishing...' : <><Upload size={16} /> Publish List</>}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CreateTierList;