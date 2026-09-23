// Preview data normalizer for TemplateCard.
//
// Rules:
// 1. Real tiers mode:
//    - When the template has real tiers AND either has assigned items or 0 total items.
//    - Shows at most 2 real tiers (1 tier -> exactly 1 row; 2+ tiers -> 2 rows).
//    - Fixed row height, no fake "—" tier rows.
// 2. Grid mode:
//    - When the template has NO tiers, OR items have no tier assignment (untiered).
//    - Directly renders a full-width item grid.
//    - Balanced into 2 rows (e.g. 4 items = 2 + 2, 6 items = 3 + 3).
//    - No TierLabel, no "—".
export const PREVIEW_MAX_TIERS = 2;
export const PREVIEW_MAX_ITEMS_PER_TIER = 4;
export const PREVIEW_MAX_GRID_ITEMS = 8;

export function normalizeTemplatePreview(
  template,
  {
    maxTiers = PREVIEW_MAX_TIERS,
    maxItemsPerTier = PREVIEW_MAX_ITEMS_PER_TIER,
    maxGridItems = PREVIEW_MAX_GRID_ITEMS,
  } = {},
) {
  const tiers = Array.isArray(template?.tiers) ? template.tiers : [];
  const rawItems = Array.isArray(template?.template_items) ? template.template_items : [];

  const items = rawItems.map((ti, index) => {
    const tierKey = typeof ti?.tier === 'string' ? ti.tier.trim() : '';
    const name = ti?.item?.name ?? ti?.name ?? ti?.item_id ?? '';
    const imageUrl = ti?.item?.image_url ?? ti?.image_url ?? null;
    return {
      key: `${ti?.item_id ?? 'item'}-${index}`,
      tierKey,
      name: String(name ?? ''),
      imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
    };
  });

  const validTiers = tiers
    .filter((t) => t && (t.label != null || t.id != null))
    .map((t, index) => ({
      key: t?.id ?? `tier-${index}`,
      label: String(t?.label ?? '').trim(),
      color: t?.color,
    }));

  const tierLabelSet = new Set(validTiers.map((t) => t.label).filter(Boolean));

  // Decide mode:
  // - "has real tiers": template.tiers has definitions -> ALWAYS show real tiers (top 2 tiers)
  //   Items with tier:null do not get forced into tiers; lane can be empty.
  // - "no tiers": fallback to item-grid preview ONLY when template actually has no tiers.
  const isTiered = validTiers.length > 0;

  if (isTiered) {
    const shownTiers = validTiers.slice(0, maxTiers);

    const itemsByTier = new Map();
    for (const item of items) {
      if (item.tierKey && tierLabelSet.has(item.tierKey)) {
        if (!itemsByTier.has(item.tierKey)) itemsByTier.set(item.tierKey, []);
        itemsByTier.get(item.tierKey).push(item);
      }
    }

    const rows = shownTiers.map((tierDef) => {
      const tierItems = itemsByTier.get(tierDef.label) ?? [];
      const visible = tierItems.slice(0, maxItemsPerTier);
      const overflow = Math.max(0, tierItems.length - maxItemsPerTier);
      return {
        key: tierDef.key,
        label: tierDef.label,
        color: tierDef.color,
        items: visible,
        overflow,
      };
    });

    return {
      mode: 'tiered',
      rows, // length is 1 or 2 (NEVER fake "—" rows)
      totalCount: items.length,
    };
  }

  // Grid mode: full width, no tier labels, split balanced into 2 rows
  const totalItems = items.length;
  if (totalItems === 0) {
    return {
      mode: 'grid',
      rows: [[], []],
      overflow: 0,
      totalCount: 0,
    };
  }

  const visibleItems = items.slice(0, maxGridItems);
  const overflow = Math.max(0, totalItems - maxGridItems);

  // Balanced split: e.g. 1 -> [1, 0], 2 -> [1, 1], 3 -> [2, 1], 4 -> [2, 2], 5 -> [3, 2], 6 -> [3, 3]
  const row1Count = Math.ceil(visibleItems.length / 2);
  const row1 = visibleItems.slice(0, row1Count);
  const row2 = visibleItems.slice(row1Count);

  return {
    mode: 'grid',
    rows: [row1, row2],
    overflow,
    totalCount: totalItems,
  };
}

export const normalizePreviewRows = normalizeTemplatePreview;
