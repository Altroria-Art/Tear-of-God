import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildTierRows, resolveTierColor } from '../../src/lib/tiers.js';
import { getInsertIndexFromZone, groupEditorItems, normalizeCreateDraft } from '../../src/lib/editorBoard.js';
import { buildCommunityExcelWorkbook, buildCommunityItemStats, getUserTierItems } from '../../src/lib/communityExcelExport.js';

const tiers = [{ id: 'one', label: '__proto__', color: '#ff7f7f' }, { id: 'two', label: 'constructor', color: '#7fbfff' }];
const rows = buildTierRows([{ item_id: 'x', tier: '__proto__' }, { item_id: 'y', tier: 'constructor' }, { item_id: 'z', tier: 'toString' }], tiers);
assert.deepEqual(rows.map(row => [row.tier, row.items.length]), [['__proto__', 1], ['constructor', 1], ['toString', 1]]);
assert.equal(resolveTierColor('constructor', '__proto__', 1), '#ffbf7f');
assert.equal(resolveTierColor(null, 'toString'), null);
assert.equal(resolveTierColor('bg-[#123456]', 'custom'), '#123456');

const card = (id, left, top) => ({ dataset: { itemId: id }, getBoundingClientRect: () => ({ left, top, width: 80, bottom: top + 90 }) });
const zone = { querySelectorAll: () => [card('a', 0, 0), card('b', 90, 0), card('c', 0, 100), card('d', 90, 100)] };
assert.equal(getInsertIndexFromZone(zone, 5, 150, 'missing'), 2, 'second row inserts before c, not a');
assert.equal(getInsertIndexFromZone(zone, 130, 150, 'missing'), 4, 'second row end appends');
assert.equal(getInsertIndexFromZone(zone, 5, 50, 'a'), 0, 'dragged card is excluded from insertion index');
assert.equal(getInsertIndexFromZone(zone, 5, 250, 'missing'), 4, 'below final row appends');

const draft = normalizeCreateDraft({ version: 1, title: {}, description: 3,
  tiers: [null], selectedHashtags: ['#a', null, '#a'], items: [
    { id: 'valid', content: 'Name', tierId: 'missing' }, { id: 'valid', content: 'Duplicate' },
    { id: 'second', content: 'Second', tierId: 'one' }, null, { id: 'blank', content: ' ' },
  ] }, tiers);
assert.equal(draft.title, '');
assert.equal(draft.description, '');
assert.deepEqual(draft.selectedHashtags, ['#a']);
assert.equal(draft.items.length, 2);
assert.equal(draft.items[0].tierId, null, 'unknown tiers must remain unranked');
const groups = groupEditorItems(draft.items, draft.tiers);
assert.deepEqual(groups.byTier.get('one').map(item => item.id), ['second']);
assert.deepEqual(groups.unranked.map(item => item.id), ['valid']);
assert.deepEqual(groups.positionById.get('second'), { position: 0, count: 1 });

const participants = [{ user_id: 'user', username: 'Should not leak', ranking_items: [
  { item_id: '__proto__', item_name: '__proto__', tier: '__proto__' },
  { item_id: 'constructor', item_name: 'constructor', tier: 'constructor' },
] }];
const stats = buildCommunityItemStats(participants, tiers);
assert.equal(stats.communityByItem.__proto__.count, 1);
assert.equal(stats.communityByItem.constructor.count, 1);
const emptyWorkbook = buildCommunityExcelWorkbook(XLSX, {
  template: { title: 'Empty filtered data', tiers }, participants, filteredRankings: [],
  participantFilter: 'all', displayTiers: tiers,
}).wb;
assert.equal(emptyWorkbook.SheetNames.length, 1, 'empty selection must not create analysis for excluded participants');
assert.equal(emptyWorkbook.Sheets['All Participants'].B2.v, 'All');
assert(!JSON.stringify(emptyWorkbook).includes('Should not leak'));
assert.equal(getUserTierItems({ ranking_items: [{ tier: 'A', item_name: 'Upper' }, { tier: 'a', item_name: 'Lower' }] }, 'A'), 'Upper');
assert.equal(getUserTierItems({ ranking_items: [{ tier: 'A', item_name: 'Upper' }, { tier: 'a', item_name: 'Lower' }] }, 'a'), 'Lower');
console.log('Editor/detail regression checks passed: prototype keys, wrapped drag rows, invalid drafts, grouping, filtered Excel, case-sensitive tiers.');
