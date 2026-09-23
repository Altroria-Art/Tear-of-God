// Regression: TemplateCard preview shape tests.
// Run: node tests/local/template-card-preview-shapes.mjs
import assert from 'node:assert/strict';
import {
  normalizeTemplatePreview,
  PREVIEW_MAX_ITEMS_PER_TIER,
} from '../../src/lib/templatePreview.js';

const S = { id: 's', label: 'S', color: '#f87171' };
const A = { id: 'a', label: 'A', color: '#fdba74' };
const B = { id: 'b', label: 'B', color: '#fcd34d' };

const ti = (item_id, tier, name) => ({
  id: `${item_id}-${tier ?? 'none'}`,
  item_id,
  tier,
  position: 0,
  item: name === undefined ? { id: item_id, name: item_id, image_url: null } : { id: item_id, name, image_url: null },
});

let n = 0;
const t = (label, template, fn) => {
  n += 1;
  const result = normalizeTemplatePreview(template);
  assert.ok(['tiered', 'grid'].includes(result.mode), `${label}: valid mode`);
  fn(result);
  console.log(`ok ${n} - ${label}`);
};

// 1. 0 tiers, no items -> grid mode, 0 items
t('0 tiers + no items', { tiers: [], template_items: [] }, (res) => {
  assert.equal(res.mode, 'grid');
  assert.equal(res.totalCount, 0);
  assert.equal(res.rows[0].length, 0);
  assert.equal(res.rows[1].length, 0);
});

// 2. tiers null + untiered items -> grid mode, balanced 2 rows (3 items: 2 + 1)
t('tiers null + 3 untiered items', { tiers: null, template_items: [ti('x', null), ti('y', ''), ti('z')] }, (res) => {
  assert.equal(res.mode, 'grid');
  assert.equal(res.totalCount, 3);
  assert.equal(res.rows[0].length, 2);
  assert.equal(res.rows[1].length, 1);
});

// 3. template_items undefined with real tiers -> tiered mode, 2 rows empty
t('template_items undefined with 2 tiers', { tiers: [S, A] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].label, 'S');
  assert.equal(res.rows[0].items.length, 0);
  assert.equal(res.rows[1].label, 'A');
  assert.equal(res.rows[1].items.length, 0);
});

// 4. 1 tier with items -> exactly 1 row (NO fake "—" row!)
t('1 tier with items', { tiers: [S], template_items: [ti('x', 'S')] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 1, '1 tier must render exactly 1 row, no fake row');
  assert.equal(res.rows[0].label, 'S');
  assert.equal(res.rows[0].items.length, 1);
});

// 5. 1 tier empty -> exactly 1 row, empty items
t('1 tier empty', { tiers: [S], template_items: [] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].label, 'S');
  assert.equal(res.rows[0].items.length, 0);
});

// 6. 2 tiers with items
t('2 tiers with items', { tiers: [S, A], template_items: [ti('x', 'S'), ti('y', 'A')] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].label, 'S');
  assert.deepEqual(res.rows[0].items.map((i) => i.name), ['x']);
  assert.equal(res.rows[1].label, 'A');
  assert.deepEqual(res.rows[1].items.map((i) => i.name), ['y']);
});

// 7. 2 tiers, second empty -> exactly 2 rows
t('2nd tier empty', { tiers: [S, A], template_items: [ti('x', 'S')] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].items.length, 1);
  assert.equal(res.rows[1].items.length, 0);
});

// 8. >2 tiers -> first 2 only
t('3 tiers', { tiers: [S, A, B], template_items: [ti('x', 'S'), ti('y', 'A'), ti('z', 'B')] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 2);
  assert.deepEqual(res.rows.map((r) => r.label), ['S', 'A']);
});

// 9. template has tiers defined, but all items untiered -> tiered mode! Always show real tiers!
t('template has tiers but items untiered', {
  tiers: [{ id: 't1', label: 'เบรกอยู่ไหน', color: '#f87171' }, { id: 't2', label: 'ซิ่งนรก', color: '#fdba74' }],
  template_items: [ti('m1', null), ti('m2', null), ti('m3', null), ti('m4', null)],
}, (res) => {
  assert.equal(res.mode, 'tiered', 'Must use tiered mode when template.tiers has definitions');
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].label, 'เบรกอยู่ไหน');
  assert.equal(res.rows[0].items.length, 0, 'Lane is empty because items have tier:null');
  assert.equal(res.rows[1].label, 'ซิ่งนรก');
  assert.equal(res.rows[1].items.length, 0, 'Lane is empty');
});

// 10. mixed tiered + untiered -> tiered mode
t('mixed tiered + untiered', { tiers: [S], template_items: [ti('x', 'S'), ti('orphan', null)] }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows.length, 1);
  assert.deepEqual(res.rows[0].items.map((i) => i.name), ['x']);
});

// 11. many items in tier -> capped with +N overflow chip
t('12 items one tier', { tiers: [S], template_items: Array.from({ length: 12 }, (_, i) => ti(`i${i}`, 'S')) }, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows[0].items.length, PREVIEW_MAX_ITEMS_PER_TIER);
  assert.equal(res.rows[0].overflow, 12 - PREVIEW_MAX_ITEMS_PER_TIER);
});

// 12. long Thai tier label
t('long label + long name', {
  tiers: [{ id: 't1', label: 'ร้านประจำ', color: '#f87171' }],
  template_items: [ti('x', 'ร้านประจำ', 'Agri Cafe')],
}, (res) => {
  assert.equal(res.mode, 'tiered');
  assert.equal(res.rows[0].label, 'ร้านประจำ');
  assert.equal(res.rows[0].items[0].name, 'Agri Cafe');
});

// 13. 20 untiered items in grid mode -> 4 in row 1, 4 in row 2, overflow +12
t('20 untiered items', { tiers: [], template_items: Array.from({ length: 20 }, (_, i) => ti(`u${i}`, null)) }, (res) => {
  assert.equal(res.mode, 'grid');
  assert.equal(res.rows[0].length, 4);
  assert.equal(res.rows[1].length, 4);
  assert.equal(res.overflow, 12);
});

// 14. 6 untiered items -> balanced 3 + 3
t('6 untiered items balanced', { tiers: [], template_items: Array.from({ length: 6 }, (_, i) => ti(`u${i}`, null)) }, (res) => {
  assert.equal(res.mode, 'grid');
  assert.equal(res.rows[0].length, 3);
  assert.equal(res.rows[1].length, 3);
  assert.equal(res.overflow, 0);
});

// 15. null fields everywhere
t('null fields', { tiers: [{ label: null, color: null }], template_items: [{ item_id: null, tier: null, item: null }] }, (res) => {
  assert.ok(['tiered', 'grid'].includes(res.mode));
});

console.log(`\nAll ${n} TemplateCard preview shape checks passed.`);
