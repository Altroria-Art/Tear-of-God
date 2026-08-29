import React, { useEffect, useState } from 'react';
import { Settings, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { createRanking } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { TIER_STYLES } from '../lib/tiers';

const DEFAULT_TIERS = [
  { id: 't1', label: 'S', color: 'bg-red-400' },
  { id: 't2', label: 'A', color: 'bg-orange-300' },
  { id: 't3', label: 'B', color: 'bg-yellow-300' },
  { id: 't4', label: 'C', color: 'bg-green-400' },
  { id: 't5', label: 'D', color: 'bg-blue-400' },
];

const DEFAULT_HASHTAGS = ['#Gaming', '#Anime', '#Movie', '#Food', '#Sports', '#Music'];

// 📍 [ใหม่]: Autosave draft — เก็บงานที่พิมพ์/จัดค้างไว้ใน localStorage เพื่อกู้คืนหลังรีเฟรช
const DRAFT_KEY = 'tog-create-draft';
const DRAFT_VERSION = 1;

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== DRAFT_VERSION) return null;
    return draft;
  } catch {
    return null; // JSON พัง / storage ถูกปิด — เริ่มใหม่แบบไม่มี draft
  }
}

function saveDraft(draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage เต็มหรือโหมด private — ไม่ autosave ก็ยังใช้หน้าได้ปกติ
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // เช่นเดียวกัน — ข้ามได้
  }
}

const CreateTierList = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const toast = useToast();

  // 📍 [ใหม่]: อ่าน draft ครั้งเดียวตอน mount แล้วเอามาเป็นค่า initial ของทุก state
  const [draft] = useState(loadDraft);

  const [quickAddText, setQuickAddText] = useState('');

  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [isPublishing, setIsPublishing] = useState(false);

  // ลำดับ item ใน array = ลำดับการแสดงผลภายใน tier → restore แล้วตำแหน่งเดิมทุกชิ้น
  const [items, setItems] = useState(
    Array.isArray(draft?.items)
      ? draft.items.filter(i => i && typeof i.content === 'string' && i.id != null)
      : []
  );
  const [tiers, setTiers] = useState(
    Array.isArray(draft?.tiers) && draft.tiers.length > 0 ? draft.tiers : DEFAULT_TIERS
  );

  const [activeSettingsTier, setActiveSettingsTier] = useState(null);

  // 📍 ระบบ Hashtag (มาแทนที่ Category)
  const [hashtags, setHashtags] = useState(() => [
    ...DEFAULT_HASHTAGS,
    ...(Array.isArray(draft?.customHashtags) ? draft.customHashtags : []),
  ]);
  const [selectedHashtags, setSelectedHashtags] = useState(
    Array.isArray(draft?.selectedHashtags) ? draft.selectedHashtags : []
  );
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [isSearchingTags, setIsSearchingTags] = useState(false);

  // 📍 [ใหม่]: autosave ทุกครั้งที่ข้อมูลที่ต้องจำเปลี่ยน (title/description/hashtags/items/tiers)
  useEffect(() => {
    saveDraft({
      version: DRAFT_VERSION,
      title,
      description,
      tiers,
      items,
      selectedHashtags,
      customHashtags: hashtags.filter(t => !DEFAULT_HASHTAGS.includes(t)),
    });
  }, [title, description, tiers, items, selectedHashtags, hashtags]);

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

  // 📍 [ใหม่]: debounced search hashtags ที่มีอยู่แล้วจาก API ทุกครั้งที่พิมพ์ query
  useEffect(() => {
    if (!tagQuery.trim()) { setTagResults([]); return; }
    let cancelled = false;
    setIsSearchingTags(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hashtags?q=${encodeURIComponent(tagQuery.replace(/^#/, '').trim())}&limit=6`);
        const json = await res.json();
        if (!cancelled && json.success) {
          const hits = (json.data || [])
            .map(h => `#${h.tag.replace(/^#/, '')}`)
            .filter(t => !selectedHashtags.includes(t));
          setTagResults(hits);
        }
      } catch {
        if (!cancelled) setTagResults([]);
      }
      if (!cancelled) setIsSearchingTags(false);
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tagQuery, selectedHashtags]);

  // เลือก tag จากผลลัพธ์ค้นหา → เพิ่มลง selected แล้วล้าง query
  const handleSelectSearchResult = (tag) => {
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    if (!hashtags.includes(formatted)) setHashtags(prev => [...prev, formatted]);
    if (!selectedHashtags.includes(formatted)) setSelectedHashtags(prev => [...prev, formatted]);
    setTagQuery('');
    setTagResults([]);
  };

  // Enter เพื่อสร้าง tag ใหม่ (ยังไม่มีในระบบ)
  const handleAddCustomTag = (e) => {
    if (e.key !== 'Enter' || !tagQuery.trim()) return;
    e.preventDefault();
    handleSelectSearchResult(tagQuery);
  };

  const handleDragStart = (e, itemId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', itemId);
  };
  const handleDragOver = (e) => e.preventDefault();

  // 📍 [ใหม่]: ย้าย item ไป tier ปลายทางโดย "แทรก" ที่ลำดับ insertIndex ภายใน tier นั้น
  // (order ใน tier = ลำดับการเรียงใน array — เดินเก็บทีละตัวแล้วแทรก dragged ตรงจุดที่ต้องการ)
  const repositionItem = (list, draggedId, targetTierId, insertIndex) => {
    const fromIndex = list.findIndex(i => i.id === draggedId);
    if (fromIndex === -1) return list;
    const dragged = { ...list[fromIndex], tierId: targetTierId };
    const remaining = list.filter((_, idx) => idx !== fromIndex);

    const sameTier = (i) => (i.tierId ?? null) === (targetTierId ?? null);
    const clamped = Math.max(0, Math.min(insertIndex, remaining.filter(sameTier).length));

    const result = [];
    let seen = 0;
    let placed = false;
    for (const it of remaining) {
      if (!placed && sameTier(it) && seen === clamped) {
        result.push(dragged);
        placed = true;
      }
      if (sameTier(it)) seen++;
      result.push(it);
    }
    if (!placed) result.push(dragged); // กรณีแทรกท้ายสุดของ tier
    return result;
  };

  // 📍 [ใหม่]: แปลงตำแหน่งเมาส์เป็นลำดับการแทรก — เทียบกับกึ่งกลางการ์ดแต่ละใบ (ไม่รวมใบที่กำลังลาก)
  const getInsertIndexFromZone = (zoneEl, clientX, draggedItemId) => {
    const cards = Array.from(zoneEl.querySelectorAll('[data-item-id]'))
      .filter(el => el.dataset.itemId !== draggedItemId);
    for (let i = 0; i < cards.length; i++) {
      const box = cards[i].getBoundingClientRect();
      if (clientX < box.left + box.width / 2) return i;
    }
    return cards.length;
  };

  const handleDrop = (e, targetTierId) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('itemId');
    if (!draggedItemId) return;
    const insertIndex = getInsertIndexFromZone(e.currentTarget, e.clientX, draggedItemId);
    setItems(prev => repositionItem(prev, draggedItemId, targetTierId, insertIndex));
  };

  // 📍 [ใหม่]: ปุ่ม ◀ ▶ — สลับตำแหน่งกับเพื่อนบ้านใน tier เดียวกัน
  const shiftItem = (itemId, direction) => {
    setItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      const mates = prev.filter(i => (i.tierId ?? null) === (item.tierId ?? null));
      const pos = mates.findIndex(i => i.id === itemId);
      const targetPos = pos + direction;
      if (targetPos < 0 || targetPos >= mates.length) return prev;
      return repositionItem(prev, itemId, item.tierId, targetPos);
    });
  };

  const renderItemCard = (item) => {
    const mates = items.filter(i => (i.tierId ?? null) === (item.tierId ?? null));
    const pos = mates.findIndex(i => i.id === item.id);

    return (
      <div
        key={item.id}
        data-item-id={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg group relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center px-2 pt-2 pb-4 text-center text-[10px] md:text-xs cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-xl hover:border-brand-accent transition-all z-10"
      >
        <span className="break-words line-clamp-3 leading-tight pointer-events-none drop-shadow-sm">{item.content}</span>

        {/* 📍 [ใหม่]: ปุ่มย้ายซ้าย/ขวา — สลับลำดับภายใน tier เดียวกัน */}
        <button
          type="button"
          onClick={() => shiftItem(item.id, -1)}
          disabled={pos === 0}
          aria-label="Move left"
          className="absolute bottom-1 left-1 rounded p-1 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronLeft size={14} strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => shiftItem(item.id, 1)}
          disabled={pos === mates.length - 1}
          aria-label="Move right"
          className="absolute bottom-1 right-1 rounded p-1 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronRight size={14} strokeWidth={3} />
        </button>

        <button onClick={() => handleDeleteItem(item.id)} className="absolute -top-2 -right-2 bg-surface text-muted hover:text-status-error hover:scale-110 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all z-20"><X size={12} strokeWidth={3} /></button>
      </div>
    );
  };

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
      // 📍 [ใหม่]: สร้าง Template ไปพร้อมกันตอน publish — ทำให้ tier list นี้มี template_id,
      // เข้าหน้า Discover และ hashtag ที่เลือก/สร้างใหม่ถูกนับบน PopularHashtags (API นับจาก templates.hashtags)
      template: {
        title: title.trim(),
        description: description,
        category: selectedHashtags[0].replace('#', '').toLowerCase(),
        hashtags: selectedHashtags.join(','),
        tiers: tiers.map(({ label, color }) => ({ label, color })),
        items: items.map((item, index) => ({ name: item.content, position: index }))
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
      clearDraft(); // 📍 [ใหม่]: publish สำเร็จ → ล้าง draft ใน localStorage
      toast.success('Publish เรียบร้อย!');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen font-sans p-4 md:p-8 relative">
      
      {/* POPUP SETTINGS MODAL */}
      {activeSettingsTier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line-soft text-ink w-full max-w-md rounded-lg shadow-2xl relative border border-[#52463e]">
            <button onClick={() => setActiveSettingsTier(null)} className="absolute top-4 right-4 text-gray-400 hover:text-ink transition-colors"><X size={20} /></button>
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
              <input type="text" value={tiers.find(t => t.id === activeSettingsTier.id)?.label || ''} onChange={(e) => updateTierData(activeSettingsTier.id, 'label', e.target.value)} className="w-full bg-canvas text-ink p-3.5 rounded-md outline-none focus:ring-2 focus:ring-brand mb-6 font-medium shadow-inner" />
              <div className="flex justify-center">
                <button onClick={() => setActiveSettingsTier(null)} className="bg-brand-accent hover:bg-surface text-canvas py-3 px-6 rounded-md font-bold transition-colors w-full shadow-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-black mb-2 text-brand">Create Tier List</h1>
        <p className="text-muted font-medium">Define your categories and rank items seamlessly.</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="glass p-6 rounded-3xl shadow-xl flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold mb-2 text-ink-soft uppercase tracking-wider">Template Name</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. Best 90s Movies..." className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all" />
            </div>
            
            {/* 📍 Hashtags Section */}
            <div>
              <label className="block text-sm font-bold mb-1 text-ink-soft uppercase tracking-wider">Hashtags / Category</label>
              <p className="text-xs text-muted mb-3 font-medium">Select or create tags to categorize your list.</p>
              
              {selectedHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedHashtags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand text-canvas text-xs font-bold rounded-lg shadow-sm drop-shadow-sm">
                      {tag} <button type="button" onClick={() => handleRemoveSelectedTag(tag)} className="hover:text-ink/70 ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mb-3">
                {hashtags.filter(t => !selectedHashtags.includes(t)).map((tag, idx) => (
                  <button key={idx} type="button" onClick={() => handleToggleHashtag(tag)} className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-surface text-ink-soft hover:bg-surface-glass hover:text-brand">
                    + {tag}
                  </button>
                ))}
              </div>
              
              {/* 📍 [ใหม่]: unified search/create input */}
              <div className="flex flex-col gap-2 border-t border-line-soft/50 pt-4 relative">
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="Search existing hashtags or type new one & press Enter..."
                  className="w-full bg-surface border border-line-soft text-ink rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all"
                  autoComplete="off"
                />

                {/* dropdown ผลลัพธ์ค้นหา */}
                {tagQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 glass rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {isSearchingTags && (
                      <div className="px-3 py-2 text-xs text-muted italic">Searching...</div>
                    )}
                    {!isSearchingTags && tagResults.length === 0 && tagQuery.trim().length >= 2 && (
                      <div className="px-3 py-2 text-xs text-muted">
                        No existing tags — press <kbd className="px-1 py-0.5 bg-surface rounded text-ink-soft font-mono text-[10px]">Enter</kbd> to create <span className="font-bold text-brand">#{tagQuery.replace(/^#/, '')}</span>
                      </div>
                    )}
                    {tagResults.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectSearchResult(tag)}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-surface-glass flex items-center gap-2 transition-colors border-b border-line-soft/30 last:border-0"
                      >
                        <span className="text-muted font-mono">#</span>
                        <span className="font-bold text-brand">{tag.replace(/^#/, '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-ink-soft uppercase tracking-wider">Description <span className="text-muted font-medium text-xs normal-case">(Optional)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this tier list about?" rows="3" className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all resize-none"></textarea>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl shadow-xl flex flex-col gap-4">
            <h3 className="font-black text-brand mb-1 flex items-center gap-2"><span className="text-xl">✨</span> Quick Add Items</h3>
            <p className="text-xs text-muted mb-2 font-medium">Type item names separated by commas.</p>
            <textarea value={quickAddText} onChange={(e) => setQuickAddText(e.target.value)} placeholder="Item 1, Item 2, Item 3..." rows="4" className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all resize-none mb-2"></textarea>
            <div className="flex justify-end">
              <button onClick={handleGenerateCards} className="bg-surface hover:bg-brand hover:text-canvas hover:border-transparent text-brand font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95">
                <span className="text-lg leading-none">⊕</span> Generate
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT CANVAS */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="glass p-6 rounded-3xl shadow-xl ">

            <div className="flex flex-col gap-3">
              {tiers.map((tier) => (
                <div key={tier.id} className="flex min-h-[90px] bg-tag border border-line-soft rounded-2xl overflow-hidden">
                  <div className={`${TIER_STYLES[tier.label]} w-24 flex items-center justify-center text-2xl font-black shadow-[inset_-2px_0_10px_rgba(0,0,0,0.2)] p-2 text-center break-words drop-shadow-md`}>{tier.label}</div>
                  <div className="flex-1 p-3 flex flex-wrap gap-3 items-center bg-transparent" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tier.id)}>
                    {items.filter(item => item.tierId === tier.id).map(renderItemCard)}
                  </div>
                  <div className="w-14 bg-black/10 flex items-center justify-center border-l border-line-soft/50 ">
                    <button onClick={() => setActiveSettingsTier(tier)} className="text-muted hover:text-highlight hover:bg-surface transition-all p-2.5 rounded-full" title="Settings"><Settings size={18} /></button>
                  </div>
                </div>
              ))}
            </div>

            <hr className="my-8 border-line-soft/50" />

            {/* UNRANKED ITEMS POOL */}
            <div>
              <h3 className="text-sm font-bold text-ink-soft uppercase tracking-widest mb-4">Unranked Items Pool</h3>
              <div className="bg-surface-glass border border-line-soft min-h-[160px] rounded-2xl p-6 flex flex-wrap gap-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null)}>
                {items.filter(item => item.tierId === null).length === 0 ? (
                  <span className="text-muted text-sm italic font-medium w-full text-center mt-12 pointer-events-none">No items yet. Generate them from the left panel.</span>
                ) : (
                  items.filter(item => item.tierId === null).map(renderItemCard)
                )}
              </div>
            </div>

            <div className="flex justify-end items-center mt-10">
              <button onClick={handlePublish} disabled={isPublishing} className="bg-brand hover:bg-brand-accent disabled:bg-surface disabled:text-muted text-canvas text-sm font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95">
                {isPublishing ? 'Publishing...' : <><Upload size={18} /> Publish List</>}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CreateTierList;















