import useHistoryState from '../lib/useHistoryState';
import EditorItem from '../components/tier/EditorItem';
import AssignTierModal from '../components/tier/AssignTierModal';
import EditorToolbar from '../components/tier/EditorToolbar';
import { loginPath } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import { Share2, Shuffle, ArrowDownAZ } from 'lucide-react';
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


const STANDARD_HASHTAGS = ['#Gaming', '#Anime', '#Movie', '#Food', '#Sports', '#Music'];

const RankTierList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useUser();
  const { t } = useTranslation();
  const { beginDrag, endDrag } = useDragAutoScroll();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [items, setItems, itemHistory] = useHistoryState([]);
  const resetItems = itemHistory.reset;
  const [loadedKey, setLoadedKey] = useState(null);
  const [templateError, setTemplateError] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const draftKey = 'tog-rank-draft:' + (currentUser?.id || 'guest') + ':' + templateId;
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [isSaving, setIsSaving] = useState(false);

  

  // 📍 Hashtags
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState(STANDARD_HASHTAGS);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!templateId) { navigate('/discover', { replace: true }); return; }
    let cancelled = false;
    setLoadedKey(null);
    setIsLoadingTemplate(true);
    setTemplateError('');
    async function load() {
      const { data, error } = await fetchTemplate(templateId, { light: true });
      if (cancelled) return;
      if (!data) { setTemplateError(error || t('errors.templateFetchFailed')); setIsLoadingTemplate(false); return; }
      const definitions = data.tiers?.length ? data.tiers.map((tier, index) => ({ ...tier, id: 'tier-' + index })) : DEFAULT_TIERS;
      const pool = (data.template_items || []).map((ti, index) => ({ id: 'item-' + index, item_id: ti.item_id || ti.item?.name, content: ti.item?.name || ti.item_id, image_url: ti.item?.image_url || null, tierId: null }));
      const signature = JSON.stringify([definitions, pool.map(item => item.item_id)]);
      const inherited = [...new Set((data.hashtags || '').split(',').map(tag => tag.trim()).filter(Boolean).map(tag => tag.startsWith('#') ? tag : '#' + tag))];
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(draftKey) || localStorage.getItem('tog-rank-draft:guest:' + templateId) || 'null');
        const ids = new Set(pool.map(item => item.id));
        if (saved?.signature !== signature || !Array.isArray(saved.items) || saved.items.length !== pool.length || new Set(saved.items.map(item => item.id)).size !== pool.length || saved.items.some(item => !ids.has(item.id))) saved = null;
      } catch { saved = null; }
      setTiers(definitions);
      const byId = new Map(pool.map(item => [item.id, item]));
      resetItems(saved ? saved.items.map(item => ({ ...byId.get(item.id), tierId: definitions.some(tier => tier.id === item.tierId) ? item.tierId : null })) : pool);
      setTitle(typeof saved?.title === 'string' ? saved.title : data.title);
      setDescription(typeof saved?.description === 'string' ? saved.description : data.description || '');
      setSelectedHashtags(Array.isArray(saved?.hashtags) && saved.hashtags.every(tag => typeof tag === 'string') ? saved.hashtags : inherited);
      setSuggestedTags([...new Set([...inherited, ...STANDARD_HASHTAGS])]);
      setLoadedKey({ key: draftKey, signature });
      setDraftStatus(saved ? 'editor.draftRestored' : '');
      setIsLoadingTemplate(false);
    }
    load();
    return () => { cancelled = true; };
  }, [templateId, draftKey, navigate, resetItems, t]);

  useEffect(() => {
    if (loadedKey?.key !== draftKey) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ signature: loadedKey.signature, title, description, items, hashtags: selectedHashtags })); }
    catch { setDraftStatus('editor.draftUnavailable'); }
  }, [loadedKey, draftKey, title, description, items, selectedHashtags]);

  const [selectedItemForModal, setSelectedItemForModal] = useState(null);

  const handleItemClick = (item) => {
    setSelectedItemForModal(item);
  };

  const handleAssignTier = (tierId) => {
    if (selectedItemForModal) {
      setItems(items.map(item =>
        item.id === selectedItemForModal.id ? { ...item, tierId } : item
      ));
      setSelectedItemForModal(null);
    }
  };

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
      toast.warning(t('rank.warnLoginSave'));
      navigate(loginPath('/rank?template=' + encodeURIComponent(templateId)));
      return;
    }
    if (isSaving || isLoadingTemplate || templateError) return;
    if (!items.length) return toast.warning(t('create.errAddItem'));
    if (!title.trim()) return toast.warning(t('rank.warnTitle'));
    if (selectedHashtags.length === 0) return toast.warning(t('rank.warnHashtag'));

    // 📍 [ใหม่]: ห้าม publish ถ้ายังมีไอเทมค้างใน Unranked Pool — เดิมไอเทมที่ยังไม่จัด
    // tier จะโดน drop เงียบๆ ไม่ถูกบันทึกลง ranking_items (ดู docs/tier-list-empty-tier-and-publish-validation-plan.md)
    const unrankedItems = items.filter(item => item.tierId === null);
    if (unrankedItems.length > 0) {
      const names = unrankedItems.slice(0, 3).map(i => i.content).join(', ');
      const more = unrankedItems.length > 3 ? t('rank.errUnrankedItemsMore', { n: unrankedItems.length - 3 }) : '';
      return toast.warning(t('rank.errUnrankedItems', { count: unrankedItems.length, names, more }));
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
        return { item_id: item.item_id || item.content, tier: tierObj ? tierObj.label : (tiers[0]?.label || 'S'), position: index };
      })
    };

    const { error, data } = await createRanking(rankingData);
    setIsSaving(false);

    if (error) {
      toast.error(t('rank.error', { msg: error }));
    } else {
      // 📍 จำโพสต์ที่เพิ่ง publish ไว้ ให้ Home Feed ดันขึ้นการ์ดแรก (transient — รีหน้าแล้วหาย)
      setLoadedKey(null);
      try { localStorage.removeItem(draftKey); localStorage.removeItem('tog-rank-draft:guest:' + templateId); } catch { /* Storage may be disabled. */ }
      markLastPublished(data?.id, currentUser.id);
      navigate('/');
    }
  };

  const renderCard = item => {
    const mates = items.filter(i => (i.tierId ?? null) === (item.tierId ?? null));
    return <EditorItem key={item.id} item={item} position={mates.findIndex(i => i.id === item.id)} count={mates.length} onMove={() => handleItemClick(item)} onShift={direction => shiftItem(item.id, direction)} onDragStart={e => handleDragStart(e, item.id)} onDragEnd={endDrag} />;
  };

  return (
    <div className="min-h-screen font-sans text-ink flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8 pb-28 flex-1 flex flex-col gap-6">

        {/* Top Info Card */}
        <div className="glass rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('rank.titlePh')}
              className="flex-1 text-[28px] font-bold text-ink bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-brand rounded px-1 -mx-1"
            />
            <div className="hidden sm:flex items-center gap-3 pt-1 shrink-0">
              <button onClick={handleShare} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors px-2">
                <Share2 size={16} /> {t('common.share')}
              </button>

            </div>
          </div>

          <details><summary className="cursor-pointer text-sm text-muted">{t('rank.description')}</summary><div className="mt-2">
            <label className="block text-xs font-semibold text-muted mb-1">{t('rank.description')} <span className="font-normal text-muted">({t('rank.optional')})</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('rank.descriptionPh')}
              rows={2}
              className="w-full bg-surface-glass border border-line-soft rounded-md p-3 text-sm outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div></details>
          {draftStatus && <p role="status" className="text-xs text-muted">{t(draftStatus)}</p>}
          {templateError && <p role="alert" className="text-status-error">{templateError}</p>}
        </div>

        {/* Search & Add Hashtags */}
        <details className="glass rounded-2xl p-4 sm:p-6"><summary className="text-sm font-semibold cursor-pointer">{t('rank.searchAddHashtags')} · {selectedHashtags.join(' ')}</summary><div className="flex flex-col gap-3 mt-4">
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
        </div></details>

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
                  className={`w-14 sm:w-20 font-bold border-r border-line-soft px-2 ${tier.label.length > 2 ? 'text-sm' : 'text-xl'}`}
                />

                <div
                  className="min-w-0 flex-1 p-2 sm:p-3 flex flex-wrap gap-2 items-center"
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
              className="flex-1 md:flex-none flex items-center justify-center whitespace-nowrap gap-2 bg-surface hover:bg-surface-glass text-ink-soft text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
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
        <div className="bg-surface-glass rounded-xl p-4 border border-line">
          <h2 className="text-[17px] font-bold text-ink mb-4">{t('rank.unrankedPool')}</h2>
          <div
            className="min-h-24 flex flex-wrap gap-3"
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

      <AssignTierModal item={selectedItemForModal} tiers={tiers} onClose={() => setSelectedItemForModal(null)} onAssign={handleAssignTier} />
      <EditorToolbar history={itemHistory} ranked={items.filter(i => i.tierId !== null).length} total={items.length} onSave={handleSaveRanking} saving={isSaving} disabled={isLoadingTemplate || !!templateError} />
    </div>
  );
};

export default RankTierList;



















