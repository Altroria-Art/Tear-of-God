// Comprehensive regression check for TemplateCard normalization & shapes.
import assert from 'node:assert/strict';
import {
  normalizeTemplatePreview,
  PREVIEW_MAX_TIERS,
  PREVIEW_MAX_ITEMS_PER_TIER,
  PREVIEW_MAX_GRID_ITEMS,
} from '../../src/lib/templatePreview.js';

const S = { id: 's', label: 'S', color: '#f87171' };
const A = { id: 'a', label: 'A', color: '#fdba74' };
const B = { id: 'b', label: 'B', color: '#fcd34d' };
const C = { id: 'c', label: 'C', color: '#4ade80' };

const makeItem = (id, tier, name, imageUrl = null) => ({
  id,
  item_id: id,
  tier,
  item: { id, name: name ?? id, image_url: imageUrl },
});

const shapes = [
  { name: '0 tiers, 0 items', data: { tiers: [], template_items: [] }, expectedMode: 'grid' },
  { name: '0 tiers, with items', data: { tiers: [], template_items: [makeItem('1', null), makeItem('2', null)] }, expectedMode: 'grid' },
  { name: '1 tier, 0 items', data: { tiers: [S], template_items: [] }, expectedMode: 'tiered' },
  { name: '1 tier, 1 item', data: { tiers: [S], template_items: [makeItem('1', 'S')] }, expectedMode: 'tiered' },
  { name: '1 tier, many items (>4)', data: { tiers: [S], template_items: Array.from({ length: 8 }, (_, i) => makeItem(`i${i}`, 'S')) }, expectedMode: 'tiered' },
  { name: '2 tiers, both with items', data: { tiers: [S, A], template_items: [makeItem('1', 'S'), makeItem('2', 'A')] }, expectedMode: 'tiered' },
  { name: '2 tiers, tier 2 empty', data: { tiers: [S, A], template_items: [makeItem('1', 'S')] }, expectedMode: 'tiered' },
  { name: '2 tiers, both empty', data: { tiers: [S, A], template_items: [] }, expectedMode: 'tiered' },
  { name: '>2 tiers (4 tiers)', data: { tiers: [S, A, B, C], template_items: [makeItem('1', 'S'), makeItem('2', 'A'), makeItem('3', 'B')] }, expectedMode: 'tiered' },
  { name: 'items have no tier', data: { tiers: [S, A], template_items: [makeItem('1', null), makeItem('2', null)] }, expectedMode: 'tiered' },
  { name: 'items have partial tier (some S, some null)', data: { tiers: [S, A], template_items: [makeItem('1', 'S'), makeItem('2', null)] }, expectedMode: 'tiered' },
  { name: 'long tier label (Thai)', data: { tiers: [{ id: 't1', label: 'สุดยอดดีเด่นที่สุดในจักรวาล', color: '#f87171' }], template_items: [] }, expectedMode: 'tiered' },
  { name: 'long item name', data: { tiers: [S], template_items: [makeItem('1', 'S', 'ชื่อไอเทมที่ยาวเหยียดแบบไม่มีเว้นวรรคเลยแม้แต่นิดเดียว')] }, expectedMode: 'tiered' },
  { name: 'with image_url', data: { tiers: [S], template_items: [makeItem('1', 'S', 'Pic', 'https://example.com/pic.jpg')] }, expectedMode: 'tiered' },
  { name: 'without image_url', data: { tiers: [S], template_items: [makeItem('1', 'S', 'NoPic', null)] }, expectedMode: 'tiered' },
  { name: 'null / undefined fields', data: { tiers: null, template_items: null }, expectedMode: 'grid' },
];

for (const shape of shapes) {
  const result = normalizeTemplatePreview(shape.data);
  assert.equal(result.mode, shape.expectedMode, `${shape.name}: mode must be ${shape.expectedMode}`);
  
  if (result.mode === 'tiered') {
    assert.ok(result.rows.length >= 1 && result.rows.length <= PREVIEW_MAX_TIERS, `${shape.name}: 1 or 2 tier rows`);
    for (const row of result.rows) {
      assert.ok(row.label != null, `${shape.name}: tier must have label`);
      assert.ok(row.items.length <= PREVIEW_MAX_ITEMS_PER_TIER, `${shape.name}: items capped per tier`);
      assert.ok(typeof row.overflow === 'number' && row.overflow >= 0, `${shape.name}: non-negative overflow`);
    }
  } else {
    assert.equal(result.rows.length, 2, `${shape.name}: grid mode must have 2 balanced rows`);
    const totalVisible = result.rows[0].length + result.rows[1].length;
    assert.ok(totalVisible <= PREVIEW_MAX_GRID_ITEMS, `${shape.name}: grid items capped`);
    assert.ok(typeof result.overflow === 'number' && result.overflow >= 0, `${shape.name}: non-negative overflow`);
  }
}

console.log(`Passed all ${shapes.length} comprehensive shape tests.`);
