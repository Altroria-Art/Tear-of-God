import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildCommunityRows, compareCommunityRanking } from '../../src/lib/communityComparison.js';

const template = {
  tiers: [{ label: 'ดี', color: 'bg-[#123456]' }, { label: 'A', color: 'bg-[#654321]' }],
  template_items: [
    { item_id: 'id-1', item: { name: 'Same name', image_url: '/one.png' } },
    { item_id: 'id-2', item: { name: 'Same name', image_url: '/two.png' } },
  ],
  community_average: { tiers: [
    { label: 'ดี', items: [{ name: 'id-1', avg: 2, votes: 3 }] },
    { label: 'A', items: [{ name: 'id-2', avg: 1, votes: 5 }] },
  ] },
};
for (const file of ['TemplateDetailPage', 'CommunityAveragePage']) {
  const source = (await readFile(new URL(`../../src/pages/${file}.jsx`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const start = source.indexOf('  const tiersDef = template.tiers || []');
  const end = source.indexOf(file === 'TemplateDetailPage' ? '  const creatorId =' : '\n  return (\n    <main', start);
  assert(start >= 0 && end > start);
  const context = vm.createContext({ template, total: 2, PAGE_SIZE: 12, buildCommunityRows, compareCommunityRanking,
    myRanking: { ranking_items: [
      { tier: 'ดี', item_id: 'id-1', item: { name: 'Same name' } },
      { tier: 'A', item_id: 'id-2', item: { name: 'Same name' } },
    ] },
  });
  vm.runInContext(source.slice(start, end) + `\nthis.rows = ${file === 'TemplateDetailPage' ? 'communityAvgRows' : 'avgTiers'};` +
    (file === 'CommunityAveragePage' ? '\nthis.comparison = myComparison;' : ''), context);
  assert.equal(context.rows[0].items[0].name, 'Same name', 'render a display name instead of a database ID');
  assert.equal(context.rows[0].items[0].id, 'id-1');
  assert.equal(context.rows[0].items[0].image_url, '/one.png');
  if (context.comparison) {
    assert.equal(context.comparison.length, 2);
    assert.equal(context.comparison[0].gap, 0);
    assert.equal(context.comparison[1].gap, 0, 'duplicate display names must not merge item identities');
  }
}
console.log('Community display names, images, custom tiers and comparison by stable item ID passed.');
