import assert from 'node:assert/strict';
import { findDuplicateNames, prepareCreateItems, removeDuplicateCreateItems } from '../../src/lib/createItems.js';
import { normalizeCreateDraft } from '../../src/lib/editorBoard.js';

const names = ['มะม่วง', 'มะยม', 'มะขาม', 'มะขามป้อม', 'มะขามแขก', 'นู้นนี้', 'นู้นนั้น', 'นั้นนู้น'];
for (const separator of [', ', '\n', '\r\n']) {
  const result = prepareCreateItems(names.join(separator), []);
  assert.deepEqual(result.items.map(item => item.content), names);
  assert.deepEqual(result.duplicates, []);
  assert.equal(new Set(result.items.map(item => item.id)).size, names.length);
  assert(result.items.every(item => item.tierId === null));
}
assert.deepEqual(findDuplicateNames(names), [], 'prefixes, similar spelling and reversed words are distinct');
const initial = prepareCreateItems(names.join(','), []).items;
initial[2].tierId = 'a';
const snapshot = structuredClone(initial);
const additional = prepareCreateItems(' มะขาม , มะขามหวาน, มะขามหวาน\nมะม่วงเขียว', initial);
assert.deepEqual(additional.items.map(item => item.content), ['มะขามหวาน', 'มะม่วงเขียว']);
assert.deepEqual(additional.duplicates, ['มะขาม', 'มะขามหวาน']);
assert.deepEqual(initial, snapshot, 'adding never changes existing cards or placements');
assert.deepEqual(prepareCreateItems('มะขาม, มะขาม', initial).items, [], 'repeated clicks/batches cannot add a second card');
assert.deepEqual(prepareCreateItems(' ,\r\n , ', initial), { items: [], duplicates: [] });
assert.deepEqual(prepareCreateItems('Death Note, Death note, __proto__, constructor, toString', []).duplicates, [], 'exact case and prototype-safe names');
assert.deepEqual(prepareCreateItems('ร้านอาหาร มพ', []).items.map(item => item.content), ['ร้านอาหาร มพ'], 'spaces inside a name remain intact');

const oldItems = [...initial, { id: 'old-repeat', content: ' มะขาม ', tierId: 'b' }];
const tiers = [{ id: 'a', label: 'ชอบ', color: '#ff7f7f' }, { id: 'b', label: 'ชอบอีก', color: '#ffbf7f' }];
const draft = normalizeCreateDraft({ version: 1, items: oldItems, tiers }, tiers);
assert.equal(draft.items.length, 9, 'opening an old draft never silently discards repeated cards');
assert.deepEqual(findDuplicateNames(draft.items.map(item => item.content)), ['มะขาม']);
const repaired = removeDuplicateCreateItems(draft.items);
assert.deepEqual(repaired, initial, 'explicit repair keeps the first card, tier and ordering');
assert.equal(draft.items.length, 9, 'repair does not mutate its input');
assert.deepEqual(findDuplicateNames(tiers.map(tier => tier.label)), []);
assert.deepEqual(findDuplicateNames(['S', ' S ']), ['S'], 'tier names follow API trimming too');

const many = Array.from({ length: 500 }, (_, index) => `มะขามป้อม ${index}`);
const large = prepareCreateItems(many.join('\n'), []);
assert.equal(large.items.length, 500);
assert.deepEqual(large.items.map(item => item.content), many);
assert.equal(new Set(large.items.map(item => item.id)).size, 500);
assert.equal(findDuplicateNames(large.items.map(item => item.content)).length, 0);
console.log('Create names passed: Thai similarities, exact duplicates, mixed batches, draft repair, tiers and 500 distinct items.');
