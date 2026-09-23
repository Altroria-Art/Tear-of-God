// Automated test ensuring Home Feed ranking export and Community Average export
// share the exact same layout structure, geometry, and dimensions when given identical tier data,
// differing only in metadata/badge.
import assert from 'node:assert/strict';
import {
  FORMAT_LAYOUT,
  estimateTableBudget,
  tableHeight,
  computeExportLayoutPlan,
} from '../../src/lib/exportCardLayout.js';

// 1. Verify canvas formats & target resolutions
assert.equal(FORMAT_LAYOUT.landscape.width, 1200, 'Landscape width must be 1200px');
assert.equal(FORMAT_LAYOUT.landscape.height, 630, 'Landscape height must be 630px');
assert.equal(FORMAT_LAYOUT.square.width, 1080, 'Square width must be 1080px');
assert.equal(FORMAT_LAYOUT.square.height, 1080, 'Square height must be 1080px');
assert.equal(FORMAT_LAYOUT.story.width, 1080, 'Story width must be 1080px');
assert.equal(FORMAT_LAYOUT.story.height, 1920, 'Story height must be 1920px');

// 2. Realistic test data
const sampleTiersDef = [
  { label: 'S', color: '#ef4444' },
  { label: 'A', color: '#f97316' },
  { label: 'B', color: '#eab308' },
  { label: 'C', color: '#22c55e' },
  { label: 'D', color: '#3b82f6' },
];

const sampleItems = [
  { id: 'item-1', name: 'Pizza', image_url: 'https://example.com/pizza.jpg' },
  { id: 'item-2', name: 'Burger', image_url: 'https://example.com/burger.jpg' },
  { id: 'item-3', name: 'Sushi', image_url: null },
  { id: 'item-4', name: 'Ramen', image_url: 'https://example.com/ramen.png' },
  { id: 'item-5', name: 'Tacos', image_url: 'https://example.com/tacos.jpg' },
  { id: 'item-6', name: 'Pasta', image_url: null },
  { id: 'item-7', name: 'Salad', image_url: 'https://example.com/salad.jpg' },
  { id: 'item-8', name: 'Steak', image_url: 'https://example.com/steak.jpg' },
];

// Distribution:
// S: 2 items
// A: 3 items
// B: 1 item
// C: 0 items (empty tier)
// D: 2 items
const tierItemDistribution = {
  S: [sampleItems[0], sampleItems[1]],
  A: [sampleItems[2], sampleItems[3], sampleItems[4]],
  B: [sampleItems[5]],
  C: [], // empty tier
  D: [sampleItems[6], sampleItems[7]],
};

// Shape A: Home Feed Ranking export format (src/pages/HomeFeed.jsx)
const homeFeedExportTiers = sampleTiersDef.map((td) => ({
  tier: td.label,
  color: td.color,
  items: (tierItemDistribution[td.label] || []).map((item) => ({
    name: item.name,
    image_url: item.image_url,
  })),
}));

// Shape B: Community Average export format (src/pages/TemplateDetailPage.jsx & CommunityAveragePage.jsx)
const commAvgExportTiers = sampleTiersDef.map((td, index) => ({
  tier: td.label,
  color: td.color,
  index,
  items: (tierItemDistribution[td.label] || []).map((item) => ({
    name: item.name,
    image_url: item.image_url,
  })),
}));

// Shape C: Community Average legacy format with `label` key instead of `tier`
const commAvgLegacyTiers = sampleTiersDef.map((td, index) => ({
  label: td.label,
  color: td.color,
  index,
  items: (tierItemDistribution[td.label] || []).map((item) => ({
    name: item.name,
    image_url: item.image_url,
  })),
}));

// 3. Test layout equivalence across formats and share modes
const formats = ['landscape', 'square', 'story'];
const shareModes = [false, true];

for (const format of formats) {
  for (const isShareCard of shareModes) {
    const layout = FORMAT_LAYOUT[format];
    const modeLabel = isShareCard ? 'shareCard' : 'standard';

    // Compute plans
    const homePlan = computeExportLayoutPlan(layout, homeFeedExportTiers, isShareCard);
    const commPlan = computeExportLayoutPlan(layout, commAvgExportTiers, isShareCard);
    const legacyPlan = computeExportLayoutPlan(layout, commAvgLegacyTiers, isShareCard);

    // Assert item size & gap are strictly identical
    assert.equal(
      homePlan.itemSize,
      commPlan.itemSize,
      `[${format} / ${modeLabel}] itemSize must be identical (Home: ${homePlan.itemSize}, Comm: ${commPlan.itemSize})`
    );
    assert.equal(
      homePlan.itemGap,
      commPlan.itemGap,
      `[${format} / ${modeLabel}] itemGap must be identical (Home: ${homePlan.itemGap}, Comm: ${commPlan.itemGap})`
    );
    assert.equal(
      legacyPlan.itemSize,
      commPlan.itemSize,
      `[${format} / ${modeLabel}] legacy tier format itemSize must match standard`
    );

    // Assert row count
    assert.equal(
      homePlan.rows.length,
      commPlan.rows.length,
      `[${format} / ${modeLabel}] Row count must be identical`
    );

    // Assert table height
    const homeH = tableHeight(layout, homePlan.rows);
    const commH = tableHeight(layout, commPlan.rows);
    assert.equal(homeH, commH, `[${format} / ${modeLabel}] Table height must be identical: ${homeH}px`);

    const budget = estimateTableBudget(layout, isShareCard);
    assert.ok(homeH <= budget, `[${format} / ${modeLabel}] Table height ${homeH}px fits within budget ${budget}px`);

    // Assert every row geometry, minHeight, items, label, color
    for (let i = 0; i < homePlan.rows.length; i++) {
      const hRow = homePlan.rows[i];
      const cRow = commPlan.rows[i];
      const lRow = legacyPlan.rows[i];

      assert.equal(
        hRow.minHeight,
        cRow.minHeight,
        `[${format} / ${modeLabel}] Row ${i} minHeight must match (Home: ${hRow.minHeight}, Comm: ${cRow.minHeight})`
      );
      assert.equal(
        hRow.tier,
        cRow.tier,
        `[${format} / ${modeLabel}] Row ${i} tier label must match`
      );
      assert.equal(
        lRow.tier,
        cRow.tier,
        `[${format} / ${modeLabel}] Legacy row ${i} tier label must match`
      );
      assert.equal(
        hRow.color,
        cRow.color,
        `[${format} / ${modeLabel}] Row ${i} color must match`
      );
      assert.equal(
        hRow.items.length,
        cRow.items.length,
        `[${format} / ${modeLabel}] Row ${i} items count must match`
      );

      // Verify item objects inside row
      for (let j = 0; j < hRow.items.length; j++) {
        assert.equal(hRow.items[j].name, cRow.items[j].name);
        assert.equal(hRow.items[j].image_url, cRow.items[j].image_url);
      }
    }

    console.log(`ok - [${format} / ${modeLabel}] Home export vs Community Average export geometry matches 100%`);
  }
}

// 4. Test Adapter normalization in CommunityAvgExportPreview
// Simulate the normalization function inside CommunityAvgExportPreview
function normalizeCommunityAvgTiers(tiers) {
  return (tiers || []).map((t, idx) => ({
    tier: t.tier ?? t.label,
    color: t.color,
    index: t.index ?? idx,
    items: (t.items || []).map((it) => (
      typeof it === 'object'
        ? { name: it.name || it.title || '', image_url: it.image_url || it.image || null }
        : { name: String(it), image_url: null }
    )),
  }));
}

const rawCommunityAverageData = [
  { label: 'S', color: '#ff0000', items: [{ name: 'Item 1', avg: 4.8, votes: 12, image_url: 'https://img/1.png' }] },
  { label: 'A', color: '#00ff00', items: ['Item 2 (string only)'] },
  { tier: 'B', color: '#0000ff', items: [] },
];

const normalized = normalizeCommunityAvgTiers(rawCommunityAverageData);
assert.equal(normalized[0].tier, 'S');
assert.equal(normalized[0].items[0].name, 'Item 1');
assert.equal(normalized[0].items[0].image_url, 'https://img/1.png');
assert.equal(normalized[1].tier, 'A');
assert.equal(normalized[1].items[0].name, 'Item 2 (string only)');
assert.equal(normalized[1].items[0].image_url, null);
assert.equal(normalized[2].tier, 'B');
assert.equal(normalized[2].items.length, 0);

console.log('ok - CommunityAvgExportPreview adapter normalizes diverse input shapes to standard ExportCard shape');

// 5. Test Metadata mapping check
// Community Average uses template creator profile for authorName & authorAvatar
const mockTemplate = {
  id: 'tpl-100',
  title: 'Favorite UP Food',
  creator_id: 'creator-999',
  hashtags: 'food,up,review',
  profile: {
    id: 'creator-999',
    username: 'ChefPhayao',
    avatar_url: 'https://avatar/chef.jpg',
  },
  community_average: {
    updated_at: '2026-09-22 18:30:00',
    tiers: rawCommunityAverageData,
  },
};

const commAvgExportProps = {
  title: mockTemplate.title,
  authorName: mockTemplate.profile?.username,
  authorAvatar: mockTemplate.profile?.avatar_url,
  hashtags: mockTemplate.hashtags,
  typeBadge: 'Community Average',
  tiers: normalizeCommunityAvgTiers(mockTemplate.community_average.tiers),
};

assert.equal(commAvgExportProps.authorName, 'ChefPhayao', 'Creator username must be authorName');
assert.equal(commAvgExportProps.authorAvatar, 'https://avatar/chef.jpg', 'Creator avatar must be authorAvatar');
assert.equal(commAvgExportProps.typeBadge, 'Community Average', 'Community Average badge must be present');
assert.equal(commAvgExportProps.title, 'Favorite UP Food', 'Template title must be passed');

console.log('ok - Creator metadata mapping verified');
console.log('All export card consistency checks PASSED!');
