import React, { useState, useEffect } from 'react';
import { Share2, Plus, Shuffle, ArrowDownAZ } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/ui/Toast';
import { fetchTemplate, createRanking } from '../lib/api';
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
      alert(t('rank.error', { msg: error }));
    } else {
      navigate('/');
    }
  };

  const renderCard = (item) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e, item.id)}
      className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg min-w-[110px] h-[52px] px-4 flex items-center justify-center text-center text-sm cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-all"
    >
      <span className="line-clamp-2 leading-tight pointer-events-none">{item.content}</span>
    </div>
  );

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

        {/* Action Bar (Add Custom / Shuffle / Sort) */}
        <div className="bg-surface-glass rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-[300px]">
            <input
              type="text"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
              placeholder={t('rank.customItemPh')}
              className="w-full bg-surface rounded-md py-2.5 pl-4 pr-10 text-sm outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={handleAddCustomItem}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand hover:text-highlight"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

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



















