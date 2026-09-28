// A tier's cards wrap on narrow screens. Test the row before the horizontal
// midpoint so dropping on a later line cannot insert into the first line.
export function getInsertIndexFromZone(zone, clientX, clientY, draggedId) {
  const cards = Array.from(zone.querySelectorAll('[data-item-id]'))
    .filter(card => card.dataset.itemId !== String(draggedId));
  for (let index = 0; index < cards.length; index++) {
    const box = cards[index].getBoundingClientRect();
    if (clientY < box.top || (clientY <= box.bottom && clientX < box.left + box.width / 2)) return index;
  }
  return cards.length;
}

export function groupEditorItems(items, tiers) {
  const byTier = new Map(tiers.map(tier => [tier.id, []]));
  const unranked = [];
  for (const item of items) (byTier.get(item.tierId) || unranked).push(item);
  const positionById = new Map();
  for (const list of [...byTier.values(), unranked]) {
    list.forEach((item, position) => positionById.set(item.id, { position, count: list.length }));
  }
  return { byTier, unranked, positionById };
}

// localStorage can contain an older or interrupted draft. Only restore the
// fields the editor understands; an unknown tier always returns to the pool.
export function normalizeCreateDraft(value, defaultTiers) {
  if (!value || value.version !== 1) return null;
  const tierIds = new Set();
  const tiers = Array.isArray(value.tiers) && value.tiers.length && value.tiers.every(tier => {
    if (!tier || typeof tier.id !== 'string' || !tier.id || tierIds.has(tier.id)
      || typeof tier.label !== 'string' || typeof tier.color !== 'string' || !tier.color) return false;
    tierIds.add(tier.id);
    return true;
  }) ? value.tiers : defaultTiers;
  const validIds = new Set(tiers.map(tier => tier.id));
  const itemIds = new Set();
  const items = (Array.isArray(value.items) ? value.items : []).filter(item => {
    if (!item || typeof item.id !== 'string' || !item.id || itemIds.has(item.id)
      || typeof item.content !== 'string' || !item.content.trim()) return false;
    itemIds.add(item.id);
    return true;
  }).map(item => ({ ...item, tierId: validIds.has(item.tierId) ? item.tierId : null }));
  const tags = list => [...new Set((Array.isArray(list) ? list : []).filter(tag => typeof tag === 'string' && tag.trim()))];
  return { version: 1, title: typeof value.title === 'string' ? value.title : '',
    description: typeof value.description === 'string' ? value.description : '', tiers, items,
    selectedHashtags: tags(value.selectedHashtags), customHashtags: tags(value.customHashtags) };
}
