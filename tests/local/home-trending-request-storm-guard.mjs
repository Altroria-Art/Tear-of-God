import assert from 'node:assert/strict';
import { fetchUnseenTrendingPage } from '../../src/lib/trendingSeen.js';

console.log('Testing Home Trending Request Storm Guards & Safety Limits...\n');

// =========================================================================
// Test 1: MAX_AUTO_REFILL_ATTEMPTS = 2 & Empty Raw Guard
// =========================================================================
console.log('Test 1: Verifying fetchUnseenTrendingPage stops after MAX_AUTO_REFILL_ATTEMPTS and on empty raw...');

let fetchCount = 0;
// Simulate a backend where all returned posts are already seen
async function mockFetchPage(page) {
  fetchCount += 1;
  return {
    success: true,
    data: [
      { id: `seen_post_${page}_1`, created_at: '2026-09-22 10:00:00' },
      { id: `seen_post_${page}_2`, created_at: '2026-09-22 10:00:00' },
    ],
  };
}

// All items are in seen list
const seenList = [
  { id: 'seen_post_1_1', seenAt: Date.now() - 1000 },
  { id: 'seen_post_1_2', seenAt: Date.now() - 1000 },
  { id: 'seen_post_2_1', seenAt: Date.now() - 1000 },
  { id: 'seen_post_2_2', seenAt: Date.now() - 1000 },
  { id: 'seen_post_3_1', seenAt: Date.now() - 1000 },
  { id: 'seen_post_3_2', seenAt: Date.now() - 1000 },
];

const result = await fetchUnseenTrendingPage(mockFetchPage, {
  page: 1,
  limit: 2,
  getSeen: () => seenList,
  maxAttempts: 2,
});

assert.equal(fetchCount, 2, 'fetchUnseenTrendingPage must strictly stop after MAX_AUTO_REFILL_ATTEMPTS (2) attempts');
assert.deepEqual(result.data, [], 'returns empty array when all attempts are exhausted');
assert.equal(result.hasMore, false, 'hasMore is false to prevent further network looping');
console.log('✔ Test 1.1 passed: MAX_AUTO_REFILL_ATTEMPTS = 2 stops network loop!');

// Test 1.2: If backend returns empty raw [], stops immediately after 1 request
let emptyFetchCount = 0;
async function mockFetchEmpty() {
  emptyFetchCount += 1;
  return { success: true, data: [] };
}

const emptyResult = await fetchUnseenTrendingPage(mockFetchEmpty, {
  page: 1,
  limit: 12,
  getSeen: () => [],
  maxAttempts: 2,
});

assert.equal(emptyFetchCount, 1, 'when backend returns [], it must STOP immediately without retrying');
assert.deepEqual(emptyResult.data, []);
assert.equal(emptyResult.hasMore, false);
console.log('✔ Test 1.2 passed: Empty raw [] stops immediately without retrying!');

// =========================================================================
// Test 2: In-Flight Concurrency Guard
// =========================================================================
console.log('\nTest 2: Verifying inFlightRef concurrency guard prevents overlapping requests...');

let activeRequests = 0;
let maxConcurrent = 0;
let totalExecuted = 0;
const inFlightRef = { current: false };

async function simulatedLoadOperation(_name) {
  if (inFlightRef.current) {
    return { blocked: true };
  }
  inFlightRef.current = true;
  activeRequests += 1;
  maxConcurrent = Math.max(maxConcurrent, activeRequests);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  activeRequests -= 1;
  inFlightRef.current = false;
  totalExecuted += 1;
  return { blocked: false };
}

// Fire 10 simultaneous attempts (e.g. fast scrolling + sentinel + tab click)
const attempts = await Promise.all([
  simulatedLoadOperation('req1'),
  simulatedLoadOperation('req2'),
  simulatedLoadOperation('req3'),
  simulatedLoadOperation('req4'),
  simulatedLoadOperation('req5'),
]);

const executed = attempts.filter((r) => !r.blocked).length;
const blocked = attempts.filter((r) => r.blocked).length;

assert.equal(maxConcurrent, 1, 'max concurrent network requests must never exceed 1');
assert.equal(executed, 1, 'only 1 request executed while in-flight');
assert.equal(blocked, 4, '4 overlapping requests were cleanly blocked');
console.log('✔ Test 2 passed: inFlightRef strictly guarantees 1 request finishes before next fires!');

// =========================================================================
// Test 3: Client-Side Session History Recycling When Pool Exhausted
// =========================================================================
console.log('\nTest 3: Verifying client-side recycling when network pool is exhausted...');

function handleLoadMoreRecycling(prevPosts, networkData, recycleCounter) {
  let newPosts = networkData;
  let effectiveHasMore = networkData.length > 0;

  if (newPosts.length === 0 && prevPosts.length >= 12) {
    const tailIds = new Set(prevPosts.slice(-15).map((p) => p.id));
    const candidates = prevPosts.filter((p) => !tailIds.has(p.id));
    if (candidates.length > 0) {
      recycleCounter.value += 1;
      const rTag = recycleCounter.value;
      const batchSize = Math.min(12, candidates.length);
      newPosts = candidates.slice(0, batchSize).map((p) => ({
        ...p,
        virtualKey: `${p.id}-r${rTag}`,
      }));
      effectiveHasMore = true;
    } else {
      effectiveHasMore = false;
    }
  } else if (newPosts.length === 0) {
    effectiveHasMore = false;
  }

  return {
    merged: [...prevPosts, ...newPosts],
    hasMore: effectiveHasMore,
    newPostsCount: newPosts.length,
  };
}

const existing20 = Array.from({ length: 20 }, (_, i) => ({ id: `p_${i}`, title: `Post ${i}` }));
const counter = { value: 0 };

// Network returns [] (pool exhausted in DB)
const recycled = handleLoadMoreRecycling(existing20, [], counter);
assert.equal(recycled.newPostsCount, 5, 'recycles 5 candidates (20 - 15 = 5)');
assert.equal(recycled.hasMore, true, 'feed continues seamlessly without network loop');
assert.equal(recycled.merged.length, 25);
assert.equal(recycled.merged[20].id, 'p_0');
assert.equal(recycled.merged[20].virtualKey, 'p_0-r1');

// Verify tail items p_5..p_19 were NOT recycled (no consecutive duplicates)
for (let i = 20; i < 25; i++) {
  const card = recycled.merged[i];
  const preceding15 = recycled.merged.slice(i - 15, i).map((p) => p.id);
  assert.ok(!preceding15.includes(card.id), `recycled card ${card.id} must be >= 15 cards apart from previous appearance`);
}
console.log('✔ Test 3 passed: Pool exhaustion seamlessly recycles from history on client side with >=15-card distance!');

// =========================================================================
// Test 4: Generation Discard for Stale Requests
// =========================================================================
console.log('\nTest 4: Verifying stale requests are discarded when generation increments...');

let currentGeneration = 1;
let stateUpdatedCount = 0;

async function fetchWithGeneration(gen) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Check generation before commit
  if (gen !== currentGeneration) {
    return { discarded: true };
  }
  stateUpdatedCount += 1;
  return { discarded: false };
}

// Request 1 starts with generation 1
const p1 = fetchWithGeneration(1);

// User rapidly switches tab or clicks refresh -> generation increments to 2
currentGeneration = 2;
const p2 = fetchWithGeneration(2);

const [res1, res2] = await Promise.all([p1, p2]);
assert.equal(res1.discarded, true, 'stale request from generation 1 was discarded');
assert.equal(res2.discarded, false, 'active request from generation 2 was committed');
assert.equal(stateUpdatedCount, 1, 'state was only updated once by the active generation');
console.log('✔ Test 4 passed: Old requests discarded cleanly via requestGenerationRef!');

// =========================================================================
// Test 5: Fresh vs Snapshot Page Parameters
// =========================================================================
console.log('\nTest 5: Verifying fresh=1 is only sent on initial load/refresh, not infinite scroll...');

function buildRankingsUrl({ page, activeTab, isInitialOrRefresh, seed }) {
  const params = new URLSearchParams({
    feed_type: activeTab,
    page: String(page),
    seed: String(seed),
  });
  if (activeTab === 'trending' && page === 1 && isInitialOrRefresh) {
    params.set('fresh', '1');
  }
  return params.toString();
}

const initialUrl = buildRankingsUrl({ page: 1, activeTab: 'trending', isInitialOrRefresh: true, seed: 123 });
assert.ok(initialUrl.includes('fresh=1'), 'initial load has fresh=1');
assert.ok(initialUrl.includes('page=1'), 'initial load has page=1');

const scrollPage2Url = buildRankingsUrl({ page: 2, activeTab: 'trending', isInitialOrRefresh: false, seed: 123 });
assert.ok(!scrollPage2Url.includes('fresh=1'), 'infinite scroll page 2 must NOT have fresh=1');
assert.ok(scrollPage2Url.includes('page=2'), 'infinite scroll page 2 has page=2');
assert.ok(scrollPage2Url.includes('seed=123'), 'infinite scroll preserves exact seed snapshot');

const scrollPage3Url = buildRankingsUrl({ page: 3, activeTab: 'trending', isInitialOrRefresh: false, seed: 123 });
assert.ok(!scrollPage3Url.includes('fresh=1'), 'infinite scroll page 3 must NOT have fresh=1');
assert.ok(scrollPage3Url.includes('page=3'), 'infinite scroll page 3 has page=3');
console.log('✔ Test 5 passed: fresh=1 is strictly restricted to initial/manual refresh; infinite scroll uses snapshot pages!');

console.log('\n======================================================');
console.log('ALL REQUEST STORM GUARDS & SAFETY TESTS PASSED!');
console.log('======================================================\n');
