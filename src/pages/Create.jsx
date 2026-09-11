import useHistoryState from '../lib/useHistoryState';
import EditorItem from '../components/tier/EditorItem';
import AssignTierModal from '../components/tier/AssignTierModal';
import EditorToolbar from '../components/tier/EditorToolbar';
import { loginPath } from '../lib/navigation';
import React, { useEffect, useState } from 'react';
import { Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { createRanking } from '../lib/api';
import { markLastPublished } from '../lib/lastPublished';
import useDragAutoScroll from '../lib/useDragAutoScroll';
import { useToast } from '../components/ui/Toast';
import TierLabel from '../components/tier/TierLabel';
import Modal from '../components/ui/Modal';
import { useTranslation, Trans } from 'react-i18next';

const DEFAULT_TIERS = [
  { id: 't1', label: 'S', color: '#f87171' },
  { id: 't2', label: 'A', color: '#fdba74' },
  { id: 't3', label: 'B', color: '#fcd34d' },
  { id: 't4', label: 'C', color: '#4ade80' },
  { id: 't5', label: 'D', color: '#60a5fa' },
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
  const { t } = useTranslation();
  const { beginDrag, endDrag } = useDragAutoScroll();

  // 📍 [ใหม่]: อ่าน draft ครั้งเดียวตอน mount แล้วเอามาเป็นค่า initial ของทุก state
  const [draft] = useState(loadDraft);

  const [quickAddText, setQuickAddText] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(!draft?.title);

  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [isPublishing, setIsPublishing] = useState(false);

  // ลำดับ item ใน array = ลำดับการแสดงผลภายใน tier → restore แล้วตำแหน่งเดิมทุกชิ้น
  const [items, setItems, itemHistory] = useHistoryState(
    Array.isArray(draft?.items)
      ? draft.items.filter(i => i && typeof i.content === 'string' && i.id != null)
      : []
  );
  const [tiers, setTiers] = useState(
    Array.isArray(draft?.tiers) && draft.tiers.length > 0 ? draft.tiers : DEFAULT_TIERS
  );

  const [activeSettingsTier, setActiveSettingsTier] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 📍 สีที่ยังไม่กด Save — preview เท่านั้น, ยืนยันที่ปุ่ม Save ถึงจะ commit
  const [pendingColor, setPendingColor] = useState(null);
  const closeSettings = () => {
    setActiveSettingsTier(null);
    setPendingColor(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeSettings();
        setSelectedItem(null);
      }
    };
    if (activeSettingsTier || selectedItem) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [activeSettingsTier, selectedItem]);

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
      customHashtags: hashtags.filter((tag) => !DEFAULT_HASHTAGS.includes(tag)),
    });
  }, [title, description, tiers, items, selectedHashtags, hashtags]);

  const BASE_COLORS = [
    '#f87171', '#fdba74', '#fcd34d', '#fde047',
    '#a3e635', '#4ade80', '#34d399', '#2dd4bf',
    '#22d3ee', '#60a5fa', '#818cf8', '#c084fc',
    '#e879f9', '#f472b6', '#9ca3af', '#e5e7eb'
  ];

  // 📍 palette รวม BASE_COLORS + ทุกสีที่แถวใช้อยู่ (จาก draft/เทมเพลต) — ทุกสีที่แสดงต้องมี swatch ตรงตัวเสมอ
  const palette = [...BASE_COLORS, ...tiers.map((tier) => tier.color)].filter((color, i, arr) => arr.findIndex((c) => c.toLowerCase() === color.toLowerCase()) === i);

  const handleGenerateCards = () => {
    if (!quickAddText.trim()) return;
    const newItems = quickAddText.split(/[,\n]+/).map(s => s.trim()).filter(Boolean).map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        content: item,
        tierId: null
      }));
    setItems([...items, ...newItems]);
    setQuickAddText('');
  };

  const handleDeleteItem = (idToRemove) => setItems(items.filter(item => item.id !== idToRemove));
  const updateTierData = (id, field, value) => setTiers(tiers.map(tier => tier.id === id ? { ...tier, [field]: value } : tier));

  // 📍 Preview สีที่ยังไม่กด Save — ถ้าไม่มี pending ใช้ tiers เดิม
  const effectiveTiers = (() => {
    if (!activeSettingsTier || !pendingColor) return tiers;
    const targetId = activeSettingsTier.id;
    const target = tiers.find((tier) => tier.id === targetId);
    if (!target || pendingColor.toLowerCase() === target.color.toLowerCase()) return tiers;
    // มีแถวอื่นถือสีนี้อยู่ → preview แบบสลับสีกัน
    const owner = tiers.find((tier) => tier.id !== targetId && tier.color.toLowerCase() === pendingColor.toLowerCase());
    if (!owner) return tiers.map((tier) => tier.id === targetId ? { ...tier, color: pendingColor } : tier);
    return tiers.map((tier) => {
      if (tier.id === targetId) return { ...tier, color: pendingColor };
      if (tier.id === owner.id) return { ...tier, color: target.color };
      return tier;
    });
  })();

  // 📍 เปิด settings — เริ่มด้วย preview ว่าง (ยังไม่เปลี่ยนสีจริง)
  const openTierSettings = (tier) => {
    setActiveSettingsTier(tier);
    setPendingColor(null);
  };

  // 📍 กดเลือกสีในตัวเลือก → แค่ stage ไว้ preview ยังไม่ commit
  const handlePickColor = (color) => setPendingColor(color);

  // 📍 กด Save → commit สีที่ staged ลง tiers จริง แล้วปิด
  const saveTierSettings = () => {
    if (activeSettingsTier) setTiers(effectiveTiers);
    closeSettings();
  };

  // 📍 เปิด dialog ยืนยันก่อนล้างทั้งกระดาน (แทน window.confirm ระบบ)
  const handleResetAll = () => setShowResetConfirm(true);

  // 📍 ล้างทั้งกระดานจริง: items, ชื่อ, คำอธิบาย, แฮชแท็กที่เลือก, ข้อความ Quick Add
  const performResetAll = () => {
    setItems([]);
    setTitle('');
    setDescription('');
    setSelectedHashtags([]);
    setQuickAddText('');
    setTiers(DEFAULT_TIERS);
    setShowResetConfirm(false);
  };

  // 📍 เด้ง item ที่จัดไว้ในตารางกลับลง Unranked Pool (ทุก tierId → null)
  const handleReturnToPool = () => {
    setItems(items.map(item => ({ ...item, tierId: null })));
  };

  // ฟังก์ชัน Hashtag
  const handleToggleHashtag = (tag) => selectedHashtags.includes(tag) ? setSelectedHashtags(selectedHashtags.filter((x) => x !== tag)) : setSelectedHashtags([...selectedHashtags, tag]);
  const handleRemoveSelectedTag = (tagToRemove) => setSelectedHashtags(selectedHashtags.filter((x) => x !== tagToRemove));

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
            .filter((h) => !selectedHashtags.includes(h));
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
    beginDrag(); // 📍 auto-scroll ขอบจอระหว่างลาก (src/lib/useDragAutoScroll.js)
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

  const renderItemCard = item => {
    const mates = items.filter(i => (i.tierId ?? null) === (item.tierId ?? null));

    return <EditorItem key={item.id} item={item} position={mates.findIndex(i => i.id === item.id)} count={mates.length}
      onMove={() => setSelectedItem(item)} onShift={direction => shiftItem(item.id, direction)} onDelete={() => handleDeleteItem(item.id)}
      onDragStart={e => handleDragStart(e, item.id)} onDragEnd={endDrag} />;

    const pos = mates.findIndex(i => i.id === item.id);

    return (
      <div
        key={item.id}
        data-item-id={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}

        onClick={() => item.tierId === null && setSelectedItem(item)}
        className={`bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg group relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center px-2 pt-2 pb-4 text-center text-[10px] md:text-xs cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-xl hover:border-brand-accent transition-all z-10 ${item.tierId === null ? 'cursor-pointer' : ''}`}

        onDragEnd={endDrag}

      >
        <span className="break-words line-clamp-3 leading-tight pointer-events-none drop-shadow-sm">{item.content}</span>

        {/* 📍 [ใหม่]: ปุ่มย้ายซ้าย/ขวา — สลับลำดับภายใน tier เดียวกัน */}
        <button
          type="button"
          onClick={() => shiftItem(item.id, -1)}
          disabled={pos === 0}
          aria-label={t('create.moveLeft')}
          className="absolute bottom-1 left-1 rounded p-1 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronLeft size={14} strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => shiftItem(item.id, 1)}
          disabled={pos === mates.length - 1}
          aria-label={t('create.moveRight')}
          className="absolute bottom-1 right-1 rounded p-1 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronRight size={14} strokeWidth={3} />
        </button>

        <button onClick={() => handleDeleteItem(item.id)} className="absolute -top-2 -right-2 bg-surface text-muted hover:text-status-error hover:scale-110 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all z-20"><X size={12} strokeWidth={3} /></button>
      </div>
    );
  };

  const handlePublish = async () => {
    if (!currentUser) { toast.warning(t('create.warnLoginPublish')); navigate(loginPath('/create')); return; }
    if (isPublishing) return;
    if (!title.trim()) { setDetailsOpen(true); return toast.warning(t('create.warnName')); }
    if (selectedHashtags.length === 0) { setDetailsOpen(true); return toast.warning(t('create.warnHashtag')); }

    // 📍 [เพิ่มใหม่]: ต้องมี item และจัด tier แล้วเท่านั้น — ไม่งั้นจะได้โพสต์เปล่า
    const rankedItems = items.filter(item => item.tierId !== null);
    if (items.length === 0) {
      return toast.error(t('create.errAddItem'));
    }
    if (rankedItems.length === 0) {
      return toast.error(t('create.errMakeTier'));
    }
    // 📍 [ใหม่]: ห้าม publish ถ้ายังมีไอเทมค้างใน Unranked Pool — เดิมไอเทมที่ยังไม่จัด
    // tier จะโดน drop เงียบๆ ไม่ถูกบันทึกลง ranking_items (ดู docs/tier-list-empty-tier-and-publish-validation-plan.md)
    const unrankedItems = items.filter(item => item.tierId === null);
    if (unrankedItems.length > 0) {
      const names = unrankedItems.slice(0, 3).map(i => i.content).join(', ');
      const more = unrankedItems.length > 3 ? t('create.errUnrankedItemsMore', { n: unrankedItems.length - 3 }) : '';
      return toast.error(t('create.errUnrankedItems', { count: unrankedItems.length, names, more }));
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
        tiers: tiers.map(({ id, label, color }) => ({ id, label, color })),
        items: items.map((item, index) => ({ name: item.content, position: index }))
      },
      items: rankedItems.map((item, index) => {
        const tierObj = tiers.find((tier) => tier.id === item.tierId);
        return { item_id: item.content, tier: tierObj ? tierObj.label : 'S', position: index };
      })
    };

    const { error, data } = await createRanking(rankingData);
    setIsPublishing(false);

    if (error) {
      toast.error(t('create.errGeneric', { msg: error }));
    } else {
      clearDraft(); // 📍 [ใหม่]: publish สำเร็จ → ล้าง draft ใน localStorage
      toast.success(t('create.successPublish'));
      // 📍 จำโพสต์ที่เพิ่ง publish ไว้ ให้ Home Feed ดันขึ้นการ์ดแรก (transient — รีหน้าแล้วหาย)
      markLastPublished(data?.id, currentUser.id);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen font-sans p-4 md:p-8 pb-28 relative">
      
{/* POPUP SETTINGS MODAL */}
      {activeSettingsTier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeSettings(); }}>
          <div className="bg-surface border border-line text-ink w-full max-w-md rounded-lg shadow-2xl relative">
            <button onClick={closeSettings} className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"><X size={20} /></button>
            <div className="p-8">
              <h3 className="text-center font-bold text-base mb-6">{t('create.chooseLabelBg')}</h3>
              <div className="flex flex-wrap justify-center gap-2.5 mb-8 px-4">
                {palette.map(color => (
                  <button key={color} onClick={() => handlePickColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${(pendingColor ?? tiers.find((tier) => tier.id === activeSettingsTier.id)?.color) === color ? 'border-white scale-110' : 'border-transparent'}`}                  />
                ))}
              </div>
              <h3 className="text-center font-bold text-base mb-4">{t('create.editLabelText')}</h3>
              <input type="text" value={tiers.find((tier) => tier.id === activeSettingsTier.id)?.label || ''} onChange={(e) => updateTierData(activeSettingsTier.id, 'label', e.target.value)} className="w-full bg-canvas text-ink p-3.5 rounded-md outline-none focus:ring-2 focus:ring-brand mb-6 font-medium shadow-inner" />
              <div className="flex justify-center">
                <button onClick={saveTierSettings} className="bg-brand-accent hover:bg-surface text-canvas py-3 px-6 rounded-md font-bold transition-colors w-full shadow-sm">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}


      <AssignTierModal item={selectedItem} tiers={tiers} onClose={() => setSelectedItem(null)} onAssign={tierId => { setItems(prev => repositionItem(prev, selectedItem.id, tierId, 9999)); setSelectedItem(null); }} />

      {/* 📍 Reset All — dialog ยืนยันแบบ UI (แทน window.confirm) */}
      <Modal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('create.resetConfirmTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="rounded-lg bg-surface-glass border border-line-soft px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={performResetAll}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-400"
            >
              {t('create.resetAll')}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-soft leading-relaxed">{t('create.resetConfirmMsg')}</p>
      </Modal>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
          <div className="bg-surface border border-line rounded-xl p-6 max-w-xs w-full shadow-2xl relative">
            <h3 className="font-bold text-center mb-4 text-ink">{t('create.assignTier', 'Assign to tier')}</h3>
            <div className="flex flex-col gap-2">
              {tiers.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => {
                    setItems(prev => repositionItem(prev, selectedItem.id, tier.id, 9999));
                    setSelectedItem(null);
                  }}
                  className="py-2 px-4 rounded-lg font-bold border border-line-soft hover:brightness-110 transition-all text-center text-tag shadow-sm"
                  style={{ backgroundColor: tier.color }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-black mb-2 text-brand">{t('create.title')}</h1>
        <p className="text-muted font-medium">{t('create.subtitle')}</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <details open={detailsOpen} onToggle={e => setDetailsOpen(e.currentTarget.open)} className="glass p-4 sm:p-6 rounded-2xl"><summary className="font-bold cursor-pointer">{t('editor.details')}</summary><div className="flex flex-col gap-5 mt-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-ink-soft uppercase tracking-wider">{t('create.templateName')}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('create.templateNamePh')} className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all" />
            </div>
            
            {/* 📍 Hashtags Section */}
            <div>
              <label className="block text-sm font-bold mb-1 text-ink-soft uppercase tracking-wider">{t('create.hashtags')}</label>
              <p className="text-xs text-muted mb-3 font-medium">{t('create.hashtagHelp')}</p>
              
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
                {hashtags.filter((tag) => !selectedHashtags.includes(tag)).map((tag, idx) => (
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
                  placeholder={t('create.tagSearchPh')}
                  className="w-full bg-surface border border-line-soft text-ink rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all"
                  autoComplete="off"
                />

                {/* dropdown ผลลัพธ์ค้นหา */}
                {tagQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 glass rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {isSearchingTags && (
                      <div className="px-3 py-2 text-xs text-muted italic">{t('create.searching')}</div>
                    )}
                    {!isSearchingTags && tagResults.length === 0 && tagQuery.trim().length >= 2 && (
                      <div className="px-3 py-2 text-xs text-muted">
                        <Trans
                          i18nKey="create.noExistingTags"
                          values={{ tag: tagQuery.replace(/^#/, '') }}
                          components={{
                            kbd: <kbd className="px-1 py-0.5 bg-surface rounded text-ink-soft font-mono text-[10px]" />,
                            b: <span className="font-bold text-brand" />,
                          }}
                        />
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
              <label className="block text-sm font-bold mb-2 text-ink-soft uppercase tracking-wider">{t('create.description')} <span className="text-muted font-medium text-xs normal-case">{t('create.optional')}</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('create.descriptionPh')} rows="3" className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all resize-none"></textarea>
            </div>
          </div></details>

          <div className="glass p-4 sm:p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="font-black text-brand mb-1 flex items-center gap-2"><span className="text-xl">✨</span> {t('create.quickAdd')}</h3>
            <p className="text-xs text-muted mb-2 font-medium">{t('create.quickAddHelp')}</p>
            <textarea value={quickAddText} onChange={(e) => setQuickAddText(e.target.value)} placeholder={t('create.quickAddPh')} rows="4" className="w-full bg-surface border border-line-soft text-ink rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-brand placeholder-muted transition-all resize-none mb-2"></textarea>
            <div className="flex justify-end">
              <button onClick={handleGenerateCards} className="bg-surface hover:bg-brand hover:text-canvas hover:border-transparent text-brand font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95">
                <span className="text-lg leading-none">⊕</span> {t('create.generate')}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT CANVAS */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="glass p-4 sm:p-6 rounded-2xl ">

            <div className="flex flex-col gap-3">
              {effectiveTiers.map((tier) => (
                <div key={tier.id} className="flex min-h-[90px] bg-tag border border-line-soft rounded-2xl overflow-hidden">
                  <TierLabel
                    label={tier.label}
                    color={tier.color}
                    style={{ boxShadow: 'inset -2px 0 10px rgba(0,0,0,0.2)' }}
                    className={`w-24 p-2 font-black ${tier.label.length > 2 ? 'text-sm' : 'text-2xl'}`}
                  />
                  <div className="min-w-0 flex-1 p-2 sm:p-3 flex flex-wrap gap-2 items-center bg-transparent" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tier.id)}>
                    {items.filter(item => item.tierId === tier.id).map(renderItemCard)}
                  </div>

                  <div className="w-14 bg-black/10 flex items-center justify-center border-l border-line-soft/50 ">
                    <button onClick={() => openTierSettings(tier)} className="text-muted hover:text-highlight hover:bg-surface transition-all p-2.5 rounded-full" title={t('create.settings')}><Settings size={18} /></button>
                  </div>
                </div>
              ))}
            </div>

            <hr className="my-8 border-line-soft/50" />

            {/* UNRANKED ITEMS POOL */}
            <div>
              <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                <h3 className="text-sm font-bold text-ink-soft uppercase tracking-widest">{t('create.unrankedPool')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReturnToPool}
                    title={t('create.backToPoolTip')}
                    className="flex items-center whitespace-nowrap gap-1.5 rounded-lg border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink-soft transition-all hover:bg-surface hover:text-ink hover:shadow-md active:scale-95"
                  >
                    <ChevronLeft size={14} /> {t('create.backToPool')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    title={t('create.resetAllTip')}
                    className="flex items-center whitespace-nowrap gap-1.5 rounded-lg border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300 hover:shadow-md active:scale-95"
                  >
                    <X size={14} /> {t('create.resetAll')}
                  </button>
                </div>
              </div>
              <div className="bg-surface-glass border border-line-soft min-h-24 rounded-xl p-3 flex flex-wrap gap-3" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null)}>
                {items.filter(item => item.tierId === null).length === 0 ? (
                  <span className="text-muted text-sm italic font-medium w-full text-center my-5 pointer-events-none">{t('create.noItems')}</span>
                ) : (
                  items.filter(item => item.tierId === null).map(renderItemCard)
                )}
              </div>
            </div>


          </div>
          
        </div>
      </div>
      <EditorToolbar history={itemHistory} ranked={items.filter(i => i.tierId !== null).length} total={items.length} onSave={handlePublish} saving={isPublishing} />
    </div>
  );
};

export default CreateTierList;















