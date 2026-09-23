import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

console.log('Testing Home Trending "All Seen" Empty State and Layout Preservation...');

// 1. Verify localization keys
console.log('Scenario 1: Verifying localization keys in th.json and en.json...');
const thJson = JSON.parse(await readFile(new URL('../../src/locales/th.json', import.meta.url), 'utf8'));
const enJson = JSON.parse(await readFile(new URL('../../src/locales/en.json', import.meta.url), 'utf8'));

assert.equal(thJson.feed?.allSeen, 'ดูครบแล้ว', 'th.json feed.allSeen must match');
assert.equal(thJson.feed?.allSeenSubtitle, 'ยังไม่มีอันดับใหม่ ลองกลับมาใหม่ภายหลัง', 'th.json feed.allSeenSubtitle must match');
assert.equal(thJson.feed?.refresh, 'รีเฟรชฟีด', 'th.json feed.refresh must match');
assert.equal(thJson.feed?.emptyCta, 'สร้าง Tier List เป็นคนแรกเลย!', 'th.json feed.emptyCta must match');

assert.equal(enJson.feed?.allSeen, "You're all caught up", 'en.json feed.allSeen must match');
assert.equal(enJson.feed?.allSeenSubtitle, 'No new rankings right now. Check back later', 'en.json feed.allSeenSubtitle must match');
assert.equal(enJson.feed?.refresh, 'Refresh feed', 'en.json feed.refresh must match');
assert.equal(enJson.feed?.emptyCta, 'Create the first Tier List!', 'en.json feed.emptyCta must match');
console.log('✔ Scenario 1 passed: Localization keys for allSeen, allSeenSubtitle, refresh, and emptyCta are properly defined!');

// 2. Verify HomeFeed source code guarantees
console.log('Scenario 2: Verifying HomeFeed.jsx structure and guards...');
const homeFeedSource = await readFile(new URL('../../src/pages/HomeFeed.jsx', import.meta.url), 'utf8');

// Ensure tab capsule never hides when feed is empty
assert.match(
  homeFeedSource,
  /showTabNav \|\| displayData\.length === 0/,
  'Floating tab navigation capsule must never hide when displayData is empty'
);

// Ensure allSeen definition
assert.match(
  homeFeedSource,
  /const allSeen = activeTab === 'trending'[\s\S]*?!isLoading[\s\S]*?!trendingError[\s\S]*?displayData\.length === 0/,
  'allSeen boolean state must be explicitly derived'
);

// Ensure dedicated allSeen empty card
assert.match(
  homeFeedSource,
  /\{allSeen && \([\s\S]*?t\('feed\.allSeen'\)[\s\S]*?t\('feed\.allSeenSubtitle'\)[\s\S]*?refreshFeed[\s\S]*?\/create/,
  'allSeen card must render title, subtitle, refresh button, and create CTA'
);

// Ensure refresh throttling is bypassed when feed is empty
assert.match(
  homeFeedSource,
  /activeTab === 'trending' && posts\.length > 0 && Date\.now\(\) - lastRefreshRef\.current < 1500/,
  'refreshFeed must not block refresh when feed has 0 posts'
);

// Ensure sidebars and outer layout remain present
assert.match(homeFeedSource, /<HomeLeftSidebar \/>/, 'HomeLeftSidebar must be present in layout');
assert.match(homeFeedSource, /<FeaturedPrompts compact \/>/, 'FeaturedPrompts must be present in layout');
assert.match(homeFeedSource, /<FreshnessHub compact \/>/, 'FreshnessHub must be present in layout');
assert.match(homeFeedSource, /sidebar\.privacy/, 'Footer privacy link must be present in layout');

console.log('✔ Scenario 2 passed: HomeFeed preserves layout, sidebars, tabs, and displays centered allSeen empty card!');

// 3. Verify seen pruning & unseen filter logic
console.log('Scenario 3: Verifying seen filter & no recycling behavior...');
import {
  pruneTrendingSeen,
  filterUnseenTrending,
  TRENDING_SEEN_TTL_MS,
} from '../../src/lib/trendingSeen.js';

const now = Date.now();
const seenEntries = [
  { id: 'rank-1', seenAt: now - 1000 },
  { id: 'rank-2', seenAt: now - 2000 },
  { id: 'rank-old', seenAt: now - (TRENDING_SEEN_TTL_MS + 10000) }, // expired
];

const pruned = pruneTrendingSeen(seenEntries, now);
assert.equal(pruned.length, 2, 'Expired seen entries are pruned');
assert.ok(pruned.some((e) => e.id === 'rank-1'));
assert.ok(pruned.some((e) => e.id === 'rank-2'));
assert.ok(!pruned.some((e) => e.id === 'rank-old'));

const mockPosts = [
  { id: 'rank-1', title: 'Post 1' },
  { id: 'rank-2', title: 'Post 2' },
  { id: 'rank-3', title: 'Post 3 (Unseen)' },
];

const unseen = filterUnseenTrending(mockPosts, pruned);
assert.equal(unseen.length, 1, 'Only unseen posts are allowed');
assert.equal(unseen[0].id, 'rank-3', 'Unseen post is rank-3');

// When all posts in candidate list are seen
const allSeenPosts = filterUnseenTrending([mockPosts[0], mockPosts[1]], pruned);
assert.equal(allSeenPosts.length, 0, 'Returns empty array when all posts have been seen (no recycling)');
console.log('✔ Scenario 3 passed: Seen posts are never recycled while within TTL!');

console.log('\nAll Home Feed All-Seen tests PASSED successfully!');
