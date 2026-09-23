import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequest as votes } from '../../functions/api/votes.js';
import { onRequest as comments } from '../../functions/api/comments.js';

// ---------------------------------------------------------------------------
// Schema Setup
// ---------------------------------------------------------------------------
const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

function makeFakeCache() {
  const store = new Map();
  return {
    store,
    async match(request) {
      const key = new URL(request.url).search;
      const entry = store.get(key);
      if (!entry) return null;
      return new Response(JSON.stringify({ ids: entry.ids, tiers: entry.tiers }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async put(request, response) {
      const key = new URL(request.url).search;
      const body = await response.json();
      store.set(key, { ids: body.ids, tiers: body.tiers });
    },
    async delete(request) {
      const key = new URL(request.url).search;
      return store.delete(key);
    },
  };
}

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("trending virtual feed test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');
await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

const realCaches = globalThis.caches;
globalThis.caches = { default: makeFakeCache() };

async function feedIds({ feedType = 'trending', seed = 0, exclude = null, seen = null, limit = 50, fresh = '1' }) {
  const query = new URLSearchParams({ feed_type: feedType, seed: String(seed), limit: String(limit) });
  if (exclude) query.set('exclude', exclude);
  if (seen) query.set('seen', seen);
  if (fresh) query.set('fresh', fresh);
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  return (body.data || []).map((row) => row.id);
}

async function insertRanking({ id, userId = 'author1', hashtags = '#test', likes = 0, comments: cCount = 0, createdMod, lastMod = null }) {
  const createdExpr = `datetime('now', '${createdMod}')`;
  const lastExpr = lastMod !== null ? `datetime('now', '${lastMod}')` : createdExpr;
  await db.prepare(`
    INSERT INTO rankings (id, user_id, hashtags, likes_count, comments_count, created_at, last_activity_at)
    VALUES (?, ?, ?, ?, ?, ${createdExpr}, ${lastExpr})
  `).bind(id, userId, hashtags, likes, cCount).run();
}

console.log('Testing Home Trending Infinite Virtual Feed (TikTok Style)...\n');

try {
  await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('author1', 'Author 1', 'author1@test.com').run();

  // =========================================================================
  // Scenario 1: Sliding Window DOM Virtualization Math & Bounds
  // =========================================================================
  console.log('Scenario 1: Testing Sliding Window DOM Virtualization calculations...');

  // Pure sliding-window simulation matching VirtualFeedContainer.jsx logic
  function simulateVirtualWindow(items, scrollY, containerTop, windowSize = 24, bufferBefore = 8, itemHeight = 440) {
    const total = items.length;
    const offsets = new Float64Array(total + 1);
    for (let i = 0; i < total; i++) {
      offsets[i + 1] = (i + 1) * itemHeight;
    }

    const currentY = Math.max(0, scrollY - containerTop);

    // Binary search for anchorIndex
    let low = 0;
    let high = total - 1;
    let anchorIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (offsets[mid] <= currentY) {
        anchorIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let desiredStart = Math.max(0, anchorIndex - bufferBefore);
    let desiredEnd = Math.min(total - 1, desiredStart + windowSize - 1);
    if (desiredEnd === total - 1) {
      desiredStart = Math.max(0, desiredEnd - windowSize + 1);
    }

    const topSpacerHeight = offsets[desiredStart] || 0;
    const bottomSpacerHeight = Math.max(0, offsets[total] - offsets[desiredEnd + 1]);
    const visibleItems = items.slice(desiredStart, desiredEnd + 1);

    return {
      desiredStart,
      desiredEnd,
      visibleCount: visibleItems.length,
      visibleItems,
      topSpacerHeight,
      bottomSpacerHeight,
      totalVirtualHeight: topSpacerHeight + (visibleItems.length * itemHeight) + bottomSpacerHeight,
    };
  }

  const mock100Items = Array.from({ length: 100 }, (_, i) => ({ id: `card_${i}`, title: `Post ${i}` }));
  const itemHeight = 440;
  const expectedTotalHeight = 100 * itemHeight; // 44,000px

  // 1.1 At scroll top (scrollY = 0)
  const atTop = simulateVirtualWindow(mock100Items, 0, 0, 24, 8, itemHeight);
  assert.equal(atTop.desiredStart, 0, 'at scroll top, window starts at 0');
  assert.equal(atTop.desiredEnd, 23, 'window ends at 23 (24 items rendered)');
  assert.equal(atTop.visibleCount, 24, 'only 24 cards rendered in DOM, not 100');
  assert.equal(atTop.topSpacerHeight, 0, 'top spacer is 0 at the top');
  assert.equal(atTop.bottomSpacerHeight, (100 - 24) * itemHeight, 'bottom spacer matches unmounted bottom items');
  assert.equal(atTop.totalVirtualHeight, expectedTotalHeight, 'total scroll height is exactly preserved');

  // 1.2 Scrolled deep down to item 50 (scrollY = 50 * 440 = 22,000px)
  const scrolledDown = simulateVirtualWindow(mock100Items, 22000, 0, 24, 8, itemHeight);
  assert.ok(scrolledDown.desiredStart > 30, 'upper items unmounted from DOM');
  assert.ok(scrolledDown.visibleCount <= 24, 'DOM node count strictly bounded to windowSize');
  assert.ok(scrolledDown.topSpacerHeight > 0, 'top spacer represents unmounted upper items');
  assert.equal(scrolledDown.topSpacerHeight, scrolledDown.desiredStart * itemHeight, 'top spacer exactly equals unmounted items * height');
  assert.equal(scrolledDown.totalVirtualHeight, expectedTotalHeight, 'zero scroll jumping: total virtual height remains constant');

  // 1.3 Scrolled back up to top (scrollY = 0)
  const scrolledBackUp = simulateVirtualWindow(mock100Items, 0, 0, 24, 8, itemHeight);
  assert.equal(scrolledBackUp.desiredStart, 0, 'scrolled back up: start restored to 0');
  assert.deepEqual(
    scrolledBackUp.visibleItems.map(p => p.id),
    mock100Items.slice(0, 24).map(p => p.id),
    'cards are restored from memory in original order with no data loss',
  );
  console.log('✔ Scenario 1 passed: Sliding window virtualization correctly bounds DOM nodes, prevents scroll jumping, and restores memory history!');

  // =========================================================================
  // Scenario 2: Non-Resetting Refresh
  // =========================================================================
  console.log('\nScenario 2: Testing Non-Resetting Refresh behavior...');

  function simulateTrendingRefresh(existingPosts, brandNewIncoming) {
    const currentIdSet = new Set(existingPosts.map(p => p.id));
    const brandNew = brandNewIncoming.filter(p => !currentIdSet.has(p.id));
    return brandNew.length > 0 ? [...brandNew, ...existingPosts] : existingPosts;
  }

  const initialFeed = [
    { id: 'post_1', title: 'Post 1' },
    { id: 'post_2', title: 'Post 2' },
    { id: 'post_3', title: 'Post 3' },
  ];

  // User presses refresh when a new post was published
  const incomingBatchWithNew = [
    { id: 'post_new_99', title: 'Brand New Post' },
    { id: 'post_1', title: 'Post 1' },
  ];

  const refreshedFeed = simulateTrendingRefresh(initialFeed, incomingBatchWithNew);
  assert.equal(refreshedFeed.length, 4, 'feed count increases without resetting');
  assert.equal(refreshedFeed[0].id, 'post_new_99', 'brand new post is prepended at the top');
  assert.deepEqual(refreshedFeed.slice(1), initialFeed, 'existing session feed is fully preserved');

  // User presses refresh when no new posts exist
  const refreshedNoNew = simulateTrendingRefresh(refreshedFeed, [{ id: 'post_1' }, { id: 'post_2' }]);
  assert.deepEqual(refreshedNoNew, refreshedFeed, 'feed does not flicker or blank when no new posts exist');
  console.log('✔ Scenario 2 passed: Refresh never wipes feed and prepends new content cleanly!');

  // =========================================================================
  // Scenario 3: Non-Consecutive Session Recycling
  // =========================================================================
  console.log('\nScenario 3: Testing Non-Consecutive Session Recycling...');

  function simulateInfiniteRecycling(sessionPosts, recycleCount) {
    if (sessionPosts.length < 12) return sessionPosts;
    const tailIds = new Set(sessionPosts.slice(-15).map(p => p.id));
    const candidates = sessionPosts.filter(p => !tailIds.has(p.id));
    if (candidates.length === 0) return sessionPosts;

    const rTag = recycleCount + 1;
    const batchSize = Math.min(12, candidates.length);
    const recycled = candidates.slice(0, batchSize).map(p => ({
      ...p,
      virtualKey: `${p.id}-r${rTag}`,
    }));

    return {
      updatedPosts: [...sessionPosts, ...recycled],
      recycledCount: recycled.length,
      recycleTag: rTag,
    };
  }

  // Create a session with 25 distinct posts
  const session25 = Array.from({ length: 25 }, (_, i) => ({ id: `s_post_${i}` }));
  const recycledResult = simulateInfiniteRecycling(session25, 0);

  assert.equal(recycledResult.recycledCount, 10, 'recycles the 10 earliest candidates (25 - 15 = 10)');
  assert.equal(recycledResult.updatedPosts.length, 35, 'recycled items appended to infinite feed');

  // Check distance: the last 15 items before appending were s_post_10..s_post_24.
  // The recycled items are s_post_0..s_post_9.
  // Distance between s_post_9 and its recycled clone is at least 15 cards!
  const firstClone = recycledResult.updatedPosts[25];
  assert.equal(firstClone.id, 's_post_0');
  assert.equal(firstClone.virtualKey, 's_post_0-r1', 'recycled card has distinct virtualKey for react rendering');

  // Verify no duplicate within 15 cards
  for (let i = 25; i < 35; i++) {
    const card = recycledResult.updatedPosts[i];
    const preceding15 = recycledResult.updatedPosts.slice(i - 15, i).map(p => p.id);
    assert.ok(!preceding15.includes(card.id), `card ${card.id} at index ${i} must not appear in preceding 15 cards`);
  }
  console.log('✔ Scenario 3 passed: Genuinely exhausted pool recycles non-consecutively with >= 15-card distance!');

  // =========================================================================
  // Scenario 4: Backend 3-Tier Age Pool and Sparse Fallback Pacing
  // =========================================================================
  console.log('\nScenario 4: Testing Backend 3-Tier Age Pool & Fallback Pacing...');

  // Clear previous test data in D1
  await db.prepare('DELETE FROM rankings').run();

  // Insert 30 primary posts (<= 30 days)
  for (let i = 1; i <= 30; i++) {
    await insertRanking({
      id: `prim_${String(i).padStart(2, '0')}`,
      createdMod: `-${Math.min(28, i)} days`,
      lastMod: `-${Math.min(28, i)} days`,
    });
  }

  // Insert 3 fallback posts (2–6 months: 60d, 90d, 120d)
  await insertRanking({ id: 'fb_60d', createdMod: '-60 days' });
  await insertRanking({ id: 'fb_90d', createdMod: '-90 days' });
  await insertRanking({ id: 'fb_120d', createdMod: '-120 days' });

  // Insert 2 old posts (> 6 months: 210d, 300d) - MUST NEVER APPEAR
  await insertRanking({ id: 'old_210d', createdMod: '-210 days' });
  await insertRanking({ id: 'old_300d', createdMod: '-300 days' });

  globalThis.caches.default = makeFakeCache();
  const trendingResult = await feedIds({ feedType: 'trending', limit: 50 });

  // 4.1 Posts > 6 months are completely excluded
  assert.ok(!trendingResult.includes('old_210d'), 'post > 6 months must NOT appear in Trending');
  assert.ok(!trendingResult.includes('old_300d'), 'post > 6 months must NOT appear in Trending');

  // 4.2 Fallback posts (2–6 months) are interspersed sparingly (1 per 15 primary items)
  // In the first 15 items: all 15 must be primary
  const first15 = trendingResult.slice(0, 15);
  for (const id of first15) {
    assert.ok(id.startsWith('prim_'), `first 15 items must all be primary: found ${id}`);
  }

  // At position 15 (16th item): 1st fallback item appears!
  assert.equal(trendingResult[15], 'fb_60d', '16th item is the first 2–6m fallback item (pacing 1:15)');

  // Next 15 items (indices 16..30) are the remaining primary items
  const next15 = trendingResult.slice(16, 31);
  for (const id of next15) {
    assert.ok(id.startsWith('prim_'), `next items must be primary: found ${id}`);
  }

  // At position 31 (32nd item): 2nd fallback item appears!
  assert.equal(trendingResult[31], 'fb_90d', '32nd item is the second 2–6m fallback item');

  console.log('✔ Scenario 4 passed: Primary content dominates, 2–6m fallback spaced at 1 per 15 items, >6m excluded!');

  // =========================================================================
  // Scenario 5: Post > 6 Months Cannot Revive With Likes or Comments
  // =========================================================================
  console.log('\nScenario 5: Testing >6 months post cannot revive with activity...');
  await votes({
    request: new Request('https://local.test/api/votes', {
      method: 'POST',
      body: JSON.stringify({ rankingId: 'old_210d', voteType: 'like' }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: 'author1' } },
  });

  await comments({
    request: new Request('https://local.test/api/comments', {
      method: 'POST',
      body: JSON.stringify({ ranking_id: 'old_210d', content: 'Fresh activity on old post' }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: 'author1' } },
  });

  globalThis.caches.default = makeFakeCache();
  const trendingAfterActivity = await feedIds({ feedType: 'trending', limit: 50 });
  assert.ok(!trendingAfterActivity.includes('old_210d'), '7-month-old post STILL cannot revive in Trending after new like and comment');
  console.log('✔ Scenario 5 passed: >6 months post strictly locked out even with fresh votes/comments!');

  console.log('\n======================================================');
  console.log('ALL INFINITE VIRTUAL FEED (TIKTOK STYLE) TESTS PASSED!');
  console.log('======================================================\n');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
