import assert from 'node:assert/strict';
import { buildCommunityRows, compareCommunityRanking } from '../../src/lib/communityComparison.js';
import { normalizeTopicItemPreview } from '../../src/lib/templatePreview.js';

const template = {
  tiers: [{ label: 'ชอบ', color: 'bg-[#123456]' }, { label: '__proto__', color: 'bg-[#abcdef]' }, { label: 'ไม่ชอบ', color: 'bg-[#654321]' }],
  template_items: ['a', 'b', 'c'].map(item_id => ({ item_id, tier: 'ชอบ', item: { name: 'Same name' } })),
  community_average: { tiers: [{ label: '__proto__', items: [{ name: 'a', avg: 2.5, votes: 4 }] },
    { label: 'ชอบ', items: [{ name: 'b', avg: 3, votes: 2 }] },
    { label: 'ไม่ชอบ', items: [{ name: 'c', avg: 1, votes: 1 }] }] },
};
const comparison = compareCommunityRanking(buildCommunityRows(template), { ranking_items: [
  { item_id: 'a', tier: 'ชอบ' }, { item_id: 'b', tier: 'ไม่ชอบ' }, { item_id: 'c', tier: 'ไม่ชอบ' },
  { item_id: 'missing', tier: 'ชอบ' }, { item_id: 'a', tier: 'unknown' },
] });
assert.deepEqual(comparison.map(item => [item.id, item.gap]), [['b', 2], ['a', -1], ['c', 0]]);
assert.equal(comparison[1].commTier, '__proto__', 'use backend-assigned tier at rounded score boundary');
assert.equal(comparison[1].commColor, 'bg-[#abcdef]');
assert.deepEqual(compareCommunityRanking(buildCommunityRows({ ...template, community_average: null }), { ranking_items: [{ item_id: 'a', tier: 'ชอบ' }] }), []);
assert.deepEqual(compareCommunityRanking(buildCommunityRows(template), null), []);
const preview = normalizeTopicItemPreview(template);
assert.equal(preview.mode, 'grid');
assert.equal(preview.totalCount, 3);
assert.equal(preview.rows.flat().length, 3, 'show item set even with assigned tiers');
assert.equal(template.tiers.length, 3, 'do not mutate source tiers');
assert.equal(normalizeTopicItemPreview({ template_items: Array.from({ length: 10 }, (_, i) => ({ item_id: i, name: `Item ${i}` })) }).overflow, 2);

console.log('Community boundaries, stable identities, empty data and item previews passed.');
