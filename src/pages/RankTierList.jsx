import React, { useState, useEffect } from 'react';
import { Share2, Shuffle, ArrowDownAZ, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { fetchTemplate, createRanking } from '../lib/api';
import { markLastPublished } from '../lib/lastPublished';
import useDragAutoScroll from '../lib/useDragAutoScroll';
import TierLabel from '../components/tier/TierLabel';
import { useTranslation } from 'react-i18next';

const DEFAULT_TIERS = [
  { id: 't1', label: 'S', color: '#ff7f7f' },
  { id: 't2', label: 'A', color: '#ffbf7f' },
  { id: 't3', label: 'B', color: '#ffff7f' },
  { id: 't4', label: 'C', color: '#7fff7f' },
  { id: 't5', label: 'D', color: '#7fbfff' },
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
  const toast = useToast();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const { beginDrag, endDrag } = useDragAutoScroll();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const [title, setTitle] = useState('My Ultimate RPG Rankings');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [isSaving, setIsSaving] = useState(false);

  

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
          image_url: ti.item?.image_url || null,
          tierId: null
        }));
        setItems(templateItems);

        // 📍 hashtag ของ template ต้นทาง = ตัวที่เจ้าของ template เลือกไว้ (templates.hashtags)
        // — นำมาเป็น selectedHashtags เริ่มต้น (inherit) พร้อมเก็บไว้ใน suggested ด้วย เพื่อให้
        // ผู้ใช้เพิ่ม/ลบได้เหมือนเดิม และไม่มีทางได้รับแท็กที่คนอื่นเพิ่มไว้บน ranking ที่เกิดจาก
        // template นี้ (ดู docs/template-hashtag-inheritance-plan.md)
        const fromTemplate = (data.hashtags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
        const fromTemplateUnique = [...new Set(fromTemplate)];
        setSelectedHashtags(fromTemplateUnique);
        setSuggestedTags([...new Set([...fromTemplateUnique, ...STANDARD_HASHTAGS])]);
      } else {
        console.error('Failed to load template:', error);
      }
      setIsLoadingTemplate(false);
    }

    loadTemplate();
  }, [templateId]);

  const handleDragStart = (e, itemId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', itemId);
    beginDrag(); // 📍 auto-scroll ขอบจอระหว่างลาก (src/lib/useDragAutoScroll.js)
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // 📍 [ใหม่]: ย้าย item ไป tier ปลายทางโดย "แทรก" ที่ลำดับ insertIndex ภายใน tier นั้น
  // (order ใน tier = ลำดับการเรียงใน array — เดินเก็บทีละตัวแล้วแทรก dragged ตรงจุดที่ต้องการ)
  // พอร์ตจากหน้า Create (src/pages/Create.jsx) เพื่อให้หน้าใช้ template สลับหน้า/หลังได้
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

  const handleShare = () => {
    toast.info(t('rank.shareInfo'));
  };

  const handleSaveRanking = async () => {
    if (!currentUser) {
      alert(t('rank.warnLoginSave'));
      navigate('/login');
      return;
    }
    if (!title.trim()) return alert(t('rank.warnTitle'));
    if (selectedHashtags.length === 0) return alert(t('rank.warnHashtag'));

    // 📍 [ใหม่]: ห้าม publish ถ้ายังมีไอเทมค้างใน Unranked Pool — เดิมไอเทมที่ยังไม่จัด
    // tier จะโดน drop เงียบๆ ไม่ถูกบันทึกลง ranking_items (ดู docs/tier-list-empty-tier-and-publish-validation-plan.md)
    const unrankedItems = items.filter(item => item.tierId === null);
    if (unrankedItems.length > 0) {
      const names = unrankedItems.slice(0, 3).map(i => i.content).join(', ');
      const more = unrankedItems.length > 3 ? t('rank.errUnrankedItemsMore', { n: unrankedItems.length - 3 }) : '';
      return alert(t('rank.errUnrankedItems', { count: unrankedItems.length, names, more }));
    }

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

    const { error, data } = await createRanking(rankingData);
    setIsSaving(false);

    if (error) {
      alert(t('rank.error', { msg: error }));
    } else {
      // 📍 จำโพสต์ที่เพิ่ง publish ไว้ ให้ Home Feed ดันขึ้นการ์ดแรก (transient — รีหน้าแล้วหาย)
      markLastPublished(data?.id, currentUser.id);
      navigate('/');
    }
  };

const renderCard = (item) => {
    const mates = items.filter(i => (i.tierId ?? null) === (item.tierId ?? null));
    const pos = mates.findIndex(i => i.id === item.id);

    return (
      <div
        key={item.id}
        data-item-id={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={endDrag}
        title={item.content}
        className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 rounded-xl w-18 h-18 sm:w-20 sm:h-20 aspect-square p-1.5 flex items-center justify-center text-center cursor-grab group relative active:cursor-grabbing transition-all overflow-hidden select-none"
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.content} className="w-full h-full object-cover rounded-lg pointer-events-none" />
        ) : (
          <span className="w-full line-clamp-3 text-[11px] sm:text-xs font-semibold leading-tight pointer-events-none break-words drop-shadow-xs px-0.5">
            {item.content}
          </span>
        )}

        {/* 📍 [ใหม่]: ปุ่มย้ายซ้าย/ขวา — สลับลำดับภายใน tier เดียวกัน (พอร์ตจากหน้า Create) */}
        <button
          type="button"
          onClick={() => shiftItem(item.id, -1)}
          disabled={pos === 0}
          aria-label={t('rank.moveLeft')}
          className="absolute bottom-0.5 left-1 rounded p-0.5 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronLeft size={14} strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => shiftItem(item.id, 1)}
          disabled={pos === mates.length - 1}
          aria-label={t('rank.moveRight')}
          className="absolute bottom-0.5 right-1 rounded p-0.5 text-muted hover:text-highlight hover:bg-surface-glass disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronRight size={14} strokeWidth={3} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans text-ink flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">

        {/* Top Info Card */}
        <div className="glass rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('rank.titlePh')}
              className="flex-1 text-[28px] font-bold text-ink bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-brand rounded px-1 -mx-1"
            />
            <div className="flex flex-col md:flex-row items-center gap-3 pt-1 shrink-0">
              <button onClick={handleShare} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors px-2">
                <Share2 size={16} /> {t('common.share')}
              </button>
              <button
                onClick={handleSaveRanking}
                disabled={isSaving}
                className="bg-brand hover:bg-brand-accent disabled:opacity-50 text-canvas text-sm font-bold py-2 px-6 rounded-md transition-colors shadow-sm"
              >
                {isSaving ? t('rank.saving') : t('rank.saveRanking')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">{t('rank.description')} <span className="font-normal text-muted">({t('rank.optional')})</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('rank.descriptionPh')}
              rows={2}
              className="w-full bg-surface-glass border border-line-soft rounded-md p-3 text-sm outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>
        </div>

        {/* Search & Add Hashtags */}
        <div className="glass rounded-xl shadow-sm p-6 flex flex-col gap-3">
          <label className="block text-sm font-semibold">{t('rank.searchAddHashtags')}</label>

          {selectedHashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedHashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand text-canvas text-xs font-medium rounded-md shadow-sm">
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
            placeholder={t('rank.addTagsPh')}
            className="w-full bg-surface-glass border border-line-soft rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
          />

          <div>
            <span className="text-xs font-semibold text-muted">{t('rank.suggestedTags')}</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestedTags.filter(t => !selectedHashtags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleHashtag(tag)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border bg-surface-glass border-line-soft text-ink-soft hover:bg-surface"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier List Canvas */}
        <div className="bg-surface-glass rounded-xl overflow-hidden flex flex-col">
          {isLoadingTemplate ? (
            <p className="text-muted animate-pulse text-center py-10">{t('rank.loadingTemplate')}</p>
          ) : (
            tiers.map((tier, index) => (
              <div
                key={tier.id}
                className={`flex min-h-[90px] bg-tag ${index !== tiers.length - 1 ? 'border-b border-line-soft' : ''}`}
              >
                <TierLabel
                  label={tier.label}
                  color={tier.color}
                  className={`w-24 font-bold border-r border-line-soft px-2 ${tier.label.length > 2 ? 'text-sm' : 'text-xl'}`}
                />

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

        {/* Action Bar (Shuffle / Sort) */}
        <div className="bg-surface-glass rounded-xl p-4 flex flex-col md:flex-row justify-end items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleShuffle}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-surface hover:bg-surface-glass text-ink-soft text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <Shuffle size={16} /> {t('rank.shuffleItems')}
            </button>
            <button
              onClick={handleSortAZ}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-surface hover:bg-surface-glass text-ink-soft text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <ArrowDownAZ size={16} /> {t('rank.sortAZ')}
            </button>
          </div>
        </div>

        {/* Unranked Pool (กล่องเก็บไอเทมที่ยังไม่ได้จัดอันดับ) */}
        <div className="bg-surface-glass rounded-xl p-6 border border-line">
          <h2 className="text-[17px] font-bold text-ink mb-4">{t('rank.unrankedPool')}</h2>
          <div
            className="min-h-[120px] flex flex-wrap gap-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            {items.filter(item => item.tierId === null).length === 0 ? (
              <span className="text-muted text-sm italic py-4 pointer-events-none">
                {t('rank.allRanked')}
              </span>
            ) : (
              items.filter(item => item.tierId === null).map(renderCard)
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-6 border-t border-line-soft flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted">
          <p>{t('rank.footerTagline')}</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-ink-soft hover:underline">{t('rank.about')}</a>
            <a href="#" className="hover:text-ink-soft hover:underline">{t('rank.guidelines')}</a>
            <a href="#" className="hover:text-ink-soft hover:underline">{t('rank.privacy')}</a>
            <a href="#" className="hover:text-ink-soft hover:underline">{t('rank.terms')}</a>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default RankTierList;



















