import React, { useState, useEffect } from 'react';
import { Share2, Plus, Shuffle, ArrowDownAZ } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplate, createRanking } from '../lib/api';

const DEFAULT_TIERS = [
  { id: 't1', label: 'S', color: 'bg-[#ff7f7f]' },
  { id: 't2', label: 'A', color: 'bg-[#ffbf7f]' },
  { id: 't3', label: 'B', color: 'bg-[#ffff7f]' },
  { id: 't4', label: 'C', color: 'bg-[#7fff7f]' },
  { id: 't5', label: 'D', color: 'bg-[#7fbfff]' },
];

const DEFAULT_ITEMS = [
  { id: '1', content: 'The Witcher 3', tierId: null },
  { id: '2', content: 'Skyrim', tierId: null },
  { id: '3', content: 'Elden Ring', tierId: null },
  { id: '4', content: "Baldur's Gate 3", tierId: null },
  { id: '5', content: 'Mass Effect 2', tierId: null },
  { id: '6', content: 'Persona 5', tierId: null },
  { id: '7', content: 'Disco Elysium', tierId: null },
  { id: '8', content: 'Dragon Age', tierId: null },
  { id: '9', content: 'Cyberpunk 2077', tierId: null },
  { id: '10', content: 'Final Fantasy VII Remake', tierId: null },
];

const STANDARD_HASHTAGS = ['#Gaming', '#Anime', '#Movie', '#Food', '#Sports', '#Music'];

const RankTierList = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const [title, setTitle] = useState('My Ultimate RPG Rankings');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [isSaving, setIsSaving] = useState(false);

  const [customItem, setCustomItem] = useState('');

  // 📍 Hashtags
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState(STANDARD_HASHTAGS);
  const [tagInput, setTagInput] = useState('');

  // 📍 รับข้อมูลจาก template (ถ้ามาจากปุ่ม Use บนหน้า Discover) — ไอเทมทั้งหมดลงกอง Unranked Pool เสมอ
  useEffect(() => {
    if (!templateId) return;

    async function loadTemplate() {
      setIsLoadingTemplate(true);
      const { data, error } = await fetchTemplate(templateId, { light: true });

      if (data) {
        setTitle(data.title || 'Untitled Ranking');
        setDescription(data.description || '');

        const templateTiers = Array.isArray(data.tiers) && data.tiers.length > 0
          ? data.tiers.map((t, idx) => ({ id: `tier-${idx}`, label: t.label, color: t.color }))
          : DEFAULT_TIERS;
        setTiers(templateTiers);

        const templateItems = (data.template_items || []).map((ti, idx) => ({
          id: ti.id || `ti-${idx}`,
          content: ti.item?.name || ti.item_id,
          tierId: null
        }));
        setItems(templateItems);

        const fromTemplate = data.hashtags ? data.hashtags.split(',').filter(Boolean) : [];
        setSuggestedTags([...new Set([...fromTemplate, ...STANDARD_HASHTAGS])]);
      } else {
        console.error('Failed to load template:', error);
      }
      setIsLoadingTemplate(false);
    }

    loadTemplate();
  }, [templateId]);

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

  const handleAddCustomItem = () => {
    if (!customItem.trim()) return;

    const newItems = customItem
      .split(',')
      .map((item, index) => ({
        id: `custom-${Date.now()}-${index}`,
        content: item.trim(),
        tierId: null // ให้การ์ดใหม่ไปโผล่ที่กล่องข้างล่าง (Unranked Pool) เสมอ
      }))
      .filter((item) => item.content !== '');

    setItems([...items, ...newItems]);
    setCustomItem('');
  };

  const handleShuffle = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setItems(shuffled);
  };

  const handleSortAZ = () => {
    const sorted = [...items].sort((a, b) => a.content.localeCompare(b.content));
    setItems(sorted);
  };

  // 📍 Hashtags
  const toggleHashtag = (tag) => {
    setSelectedHashtags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const formatted = tagInput.startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`;
      if (!suggestedTags.includes(formatted)) setSuggestedTags([formatted, ...suggestedTags]);
      if (!selectedHashtags.includes(formatted)) setSelectedHashtags([...selectedHashtags, formatted]);
      setTagInput('');
    }
  };

  const handleSaveRanking = async () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อน Save Ranking');
      navigate('/login');
      return;
    }
    if (!title.trim()) return alert('กรุณาตั้งชื่อ Ranking ก่อนครับ');
    if (selectedHashtags.length === 0) return alert('กรุณาเลือก Hashtag อย่างน้อย 1 อันครับ');

    setIsSaving(true);
    const rankingData = {
      payload: {
        title,
        description,
        category: selectedHashtags[0].replace('#', '').toLowerCase(),
        hashtags: selectedHashtags.join(','),
        user_id: currentUser.id,
        username: currentUser.username,
        avatar_url: currentUser.avatar_url,
        template_id: templateId || null
      },
      items: items.filter(item => item.tierId !== null).map((item, index) => {
        const tierObj = tiers.find(t => t.id === item.tierId);
        return { item_id: item.content, tier: tierObj ? tierObj.label : (tiers[0]?.label || 'S'), position: index };
      })
    };

    const { error } = await createRanking(rankingData);
    setIsSaving(false);

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error);
    } else {
      navigate('/');
    }
  };

  const renderCard = (item) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e, item.id)}
      className="bg-white min-w-[110px] h-[52px] px-4 rounded shadow-sm flex items-center justify-center text-center text-sm font-medium text-gray-700 border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <span className="line-clamp-2 leading-tight pointer-events-none">{item.content}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800 flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">

        {/* Top Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ranking title..."
              className="flex-1 text-[28px] font-bold text-black bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-[#7c5b36] rounded px-1 -mx-1"
            />
            <div className="flex flex-col md:flex-row items-center gap-3 pt-1 shrink-0">
              <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors px-2">
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleSaveRanking}
                disabled={isSaving}
                className="bg-[#7c5b36] hover:bg-[#63482a] disabled:bg-gray-400 text-white text-sm font-bold py-2 px-6 rounded-md transition-colors shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Save Ranking'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Description <span className="font-normal text-gray-400">(Optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add your notes or context for this ranking..."
              rows={2}
              className="w-full bg-zinc-100 border border-zinc-200 rounded-md p-3 text-sm outline-none focus:ring-1 focus:ring-[#7c5b36] resize-none"
            />
          </div>
        </div>

        {/* Search & Add Hashtags */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex flex-col gap-3">
          <label className="block text-sm font-semibold">Search & Add Hashtags</label>

          {selectedHashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedHashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#7c5b36] text-white text-xs font-medium rounded-md shadow-sm">
                  {tag}
                  <button type="button" onClick={() => toggleHashtag(tag)} className="hover:text-red-200 font-bold ml-1">×</button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Add tags (e.g. #rpg, #2024)"
            className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#7c5b36]"
          />

          <div>
            <span className="text-xs font-semibold text-gray-500">Suggested Tags:</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestedTags.filter(t => !selectedHashtags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleHashtag(tag)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border bg-zinc-100 border-gray-200 text-gray-700 hover:bg-zinc-200"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier List Canvas */}
        <div className="bg-zinc-100 rounded-xl border border-zinc-200 overflow-hidden flex flex-col">
          {isLoadingTemplate ? (
            <p className="text-gray-500 animate-pulse text-center py-10">กำลังโหลดเทมเพลต...</p>
          ) : (
            tiers.map((tier, index) => (
              <div
                key={tier.id}
                className={`flex min-h-[90px] bg-[#fdfbf9] ${index !== tiers.length - 1 ? 'border-b border-zinc-200' : ''}`}
              >
                <div
                  className={`${tier.color} w-24 shrink-0 flex items-center justify-center text-black font-bold border-r border-zinc-200 px-2 text-center leading-tight ${tier.label.length > 2 ? 'text-sm' : 'text-xl'}`}
                >
                  {tier.label}
                </div>

                <div
                  className="flex-1 p-3 flex flex-wrap gap-3 items-center"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, tier.id)}
                >
                  {items.filter(item => item.tierId === tier.id).map(renderCard)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Bar (Add Custom / Shuffle / Sort) */}
        <div className="bg-zinc-100 rounded-xl border border-zinc-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-[300px]">
            <input
              type="text"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
              placeholder="Add custom item..."
              className="w-full bg-[#ebe4d8] border border-[#ded5c5] rounded-md py-2.5 pl-4 pr-10 text-sm outline-none focus:ring-1 focus:ring-[#7c5b36]"
            />
            <button
              onClick={handleAddCustomItem}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c5b36] hover:text-[#5c4226]"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleShuffle}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#ebe4d8] hover:bg-[#ded5c5] border border-[#ded5c5] text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <Shuffle size={16} /> Shuffle Items
            </button>
            <button
              onClick={handleSortAZ}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#ebe4d8] hover:bg-[#ded5c5] border border-[#ded5c5] text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <ArrowDownAZ size={16} /> Sort A-Z
            </button>
          </div>
        </div>

        {/* Unranked Pool (กล่องเก็บไอเทมที่ยังไม่ได้จัดอันดับ) */}
        <div className="bg-[#e4ddd0] rounded-xl p-6 border border-[#d6cebf]">
          <h2 className="text-[17px] font-bold text-gray-800 mb-4">Unranked Pool</h2>
          <div
            className="min-h-[120px] flex flex-wrap gap-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            {items.filter(item => item.tierId === null).length === 0 ? (
              <span className="text-gray-500 text-sm italic py-4 pointer-events-none">
                All items have been ranked!
              </span>
            ) : (
              items.filter(item => item.tierId === null).map(renderCard)
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-6 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>© 2026 Tear of God. Community Driven Ranking.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-700 hover:underline">About</a>
            <a href="#" className="hover:text-gray-700 hover:underline">Guidelines</a>
            <a href="#" className="hover:text-gray-700 hover:underline">Privacy</a>
            <a href="#" className="hover:text-gray-700 hover:underline">Terms</a>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default RankTierList;

