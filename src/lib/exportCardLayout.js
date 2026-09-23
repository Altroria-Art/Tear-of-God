// Every number here is a hard pixel value chosen for the export size, NOT a
// Tailwind breakpoint. The card is rendered at its real pixel size (captured
// as-is offscreen) and simply `scale()`d down for the on-screen preview, so
// `sm:`/`md:` viewport utilities would be evaluated against the PHONE viewport
// and corrupt the export. Layout must be deterministic per `shareFormat`.
export const FORMAT_LAYOUT = {
  landscape: {
    width: 1200, height: 630, padding: 28,
    avatarSize: 42,
    headerGap: 14,
    titleSize: 32,
    nameSize: 15, subSize: 12, badgeSize: 12,
    itemsCountSize: 13,
    tierLabelWidth: 76, tierLabelSize: 18,
    itemSizeBase: 84, itemSizeMin: 36, itemGapBase: 10, itemGapMin: 4, step: 2,
    rowPadX: 10, rowPadY: 4,
    itemTextSize: 11,
    sharePadY: 8, qrSize: 48, shareGapTop: 8,
    footerSize: 12, footerGapTop: 10,
  },
  square: {
    width: 1080, height: 1080, padding: 40,
    avatarSize: 54,
    headerGap: 20,
    titleSize: 44,
    nameSize: 16, subSize: 13, badgeSize: 13,
    itemsCountSize: 14,
    tierLabelWidth: 108, tierLabelSize: 24,
    itemSizeBase: 96, itemSizeMin: 48, itemGapBase: 12, itemGapMin: 6, step: 2,
    rowPadX: 14, rowPadY: 10,
    itemTextSize: 13,
    sharePadY: 16, qrSize: 68, shareGapTop: 14,
    footerSize: 13, footerGapTop: 14,
  },
  story: {
    width: 1080, height: 1920, padding: 48,
    avatarSize: 60,
    headerGap: 24,
    titleSize: 52,
    nameSize: 18, subSize: 14, badgeSize: 14,
    itemsCountSize: 15,
    tierLabelWidth: 122, tierLabelSize: 26,
    itemSizeBase: 116, itemSizeMin: 58, itemGapBase: 15, itemGapMin: 8, step: 2,
    rowPadX: 16, rowPadY: 12,
    itemTextSize: 14,
    sharePadY: 18, qrSize: 88, shareGapTop: 16,
    footerSize: 14, footerGapTop: 16,
  },
};

export function buildRows(l, itemSize, itemGap, tiers) {
  const usableWidth = l.width - 2 * l.padding - l.tierLabelWidth - 2 * l.rowPadX;
  return tiers.map(({ tier, label, color, index, items }, i) => {
    const tierName = tier ?? label;
    const tierIndex = index ?? i;
    const list = items || [];
    if (list.length === 0) {
      return { index: tierIndex, tier: tierName, color, items: list, minHeight: itemSize + 2 * l.rowPadY };
    }
    const perRow = Math.max(1, Math.floor((usableWidth + itemGap) / (itemSize + itemGap)));
    const itemRows = Math.ceil(list.length / perRow);
    const itemsH = itemRows * itemSize + (itemRows - 1) * itemGap;
    return { index: tierIndex, tier: tierName, color, items: list, minHeight: Math.max(itemSize + 2 * l.rowPadY, itemsH + 2 * l.rowPadY) };
  });
}

// Fixed non-table budget within the card height (header / share block / footer).
export function estimateTableBudget(l, isShareCard) {
  const headerH =
    l.avatarSize + l.headerGap + Math.round(l.titleSize * 1.25) + 6 + Math.round(l.itemsCountSize * 1.25) + 22;
  const shareH = isShareCard ? l.qrSize + 2 * l.sharePadY + 32 + l.shareGapTop : 0;
  const footerH = l.footerGapTop + Math.round(l.footerSize * 1.3) + 10;
  return l.height - 2 * l.padding - headerH - shareH - footerH;
}

export function tableHeight(l, rows) {
  return rows.reduce((acc, r) => acc + r.minHeight, 0) + Math.max(0, rows.length - 1);
}

/**
 * Computes the optimal sizing plan for items and gaps based on available budget.
 */
export function computeExportLayoutPlan(layout, tiers, isShareCard) {
  const available = estimateTableBudget(layout, isShareCard);
  let size = layout.itemSizeMin;
  for (let s = layout.itemSizeBase; s >= layout.itemSizeMin; s -= layout.step) {
    const g = Math.max(layout.itemGapMin, Math.round(layout.itemGapBase * (s / layout.itemSizeBase)));
    if (tableHeight(layout, buildRows(layout, s, g, tiers)) <= available) {
      size = s;
      break;
    }
  }
  const itemGap = Math.max(layout.itemGapMin, Math.round(layout.itemGapBase * (size / layout.itemSizeBase)));
  return { itemSize: size, itemGap, rows: buildRows(layout, size, itemGap, tiers) };
}
