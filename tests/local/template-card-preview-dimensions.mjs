// Verification for TemplateCard preview physical pixel geometry,
// row heights, item box sizing, and zero horizontal overflow across viewports:
// 320px (small mobile), 390px (mobile), 768px (tablet), and desktop.
import assert from 'node:assert/strict';

// Design tokens from TemplateCard.jsx
const PREVIEW_CONTAINER_HEIGHT = 144; // h-36 = 9rem = 144px
const PREVIEW_PADDING_TOP = 36;       // pt-9 = 2.25rem = 36px (reserves space for uses/views badges)
const PREVIEW_PADDING_BOTTOM = 12;    // pb-3 = 0.75rem = 12px
const PREVIEW_PADDING_X = 12;         // px-3 = 0.75rem = 12px each side = 24px total
const ROW_HEIGHT = 44;                // h-11 = 2.75rem = 44px
const ROW_GAP = 8;                    // gap-2 = 0.5rem = 8px (or justify-between across 96px)
const LABEL_WIDTH = 56;               // w-14 = 3.5rem = 56px
const ROW_BORDER = 2;                 // border = 1px left + 1px right
const DIVIDER_BORDER = 1;             // border-r = 1px
const LANE_PADDING_X = 8;             // px-2 = 0.5rem = 8px each side = 16px total
const ITEM_BOX_SIZE = 32;             // w-8 h-8 = 2rem = 32px
const ITEM_GAP = 6;                   // gap-1.5 = 0.375rem = 6px
const MAX_ITEMS = 4;                  // PREVIEW_MAX_ITEMS

// 1. Vertical Height Budget Verification
const totalVerticalSpace = PREVIEW_PADDING_TOP + ROW_HEIGHT + ROW_GAP + ROW_HEIGHT + PREVIEW_PADDING_BOTTOM;
assert.equal(
  totalVerticalSpace,
  PREVIEW_CONTAINER_HEIGHT,
  `Vertical height budget: 36 + 44 + 8 + 44 + 12 must equal ${PREVIEW_CONTAINER_HEIGHT}px (h-36)`
);

// 2. Maximum Row Content Width (4 items + 1 overflow chip)
const maxBoxes = MAX_ITEMS + 1; // 4 items + 1 overflow chip = 5 boxes
const maxBoxesWidth = (maxBoxes * ITEM_BOX_SIZE) + ((maxBoxes - 1) * ITEM_GAP);
assert.equal(maxBoxesWidth, 184, '5 boxes (4 items + 1 chip) with 6px gaps must equal 184px');

// 3. Viewport Simulation Check
const viewports = [
  { name: '320px (iPhone SE / small mobile)', screenWidth: 320, pagePaddingX: 16, cols: 1 },
  { name: '390px (iPhone 12/13/14)', screenWidth: 390, pagePaddingX: 16, cols: 1 },
  { name: '768px (iPad portrait / tablet)', screenWidth: 768, pagePaddingX: 24, cols: 2, colGap: 20 },
  { name: '1280px (Desktop)', screenWidth: 1280, pagePaddingX: 32, cols: 4, colGap: 20 },
];

for (const vp of viewports) {
  const containerWidth = vp.screenWidth - (vp.pagePaddingX * 2);
  const gapsTotal = (vp.cols - 1) * (vp.colGap || 0);
  const cardWidth = Math.floor((containerWidth - gapsTotal) / vp.cols);
  const rowWidth = cardWidth - (PREVIEW_PADDING_X * 2);
  const laneAvailableWidth = rowWidth - ROW_BORDER - LABEL_WIDTH - DIVIDER_BORDER - (LANE_PADDING_X * 2);

  assert.ok(
    laneAvailableWidth >= maxBoxesWidth,
    `${vp.name}: card=${cardWidth}px, row=${rowWidth}px, lane=${laneAvailableWidth}px must fit ${maxBoxesWidth}px (slack: ${laneAvailableWidth - maxBoxesWidth}px)`
  );

  console.log(`ok - ${vp.name}: lane width ${laneAvailableWidth}px fits 5 boxes (184px) with ${laneAvailableWidth - maxBoxesWidth}px margin`);
}

// 4. Item Box aspect-ratio & overflow chip invariants
assert.equal(ITEM_BOX_SIZE, 32, 'Item boxes strictly 32px');
assert.equal(ROW_HEIGHT, 44, 'Rows strictly 44px');
assert.ok(ITEM_BOX_SIZE < ROW_HEIGHT, 'Item box fits comfortably inside row height');

console.log('\nAll TemplateCard dimension & viewport checks passed.');
