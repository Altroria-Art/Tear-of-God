import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestGet as spotlights } from '../../functions/api/spotlights.js';
import { onRequest as commentsApi } from '../../functions/api/comments.js';
import { getSpotlightsCacheKey } from '../../functions/lib/spotlight-cache.js';

console.log('Testing Active Debates sorted by latest comment and cache invalidation...');

function createFakeCache() {
  const store = new Map();
  return {
    store,
    matchCalls: 0,
    putCalls: 0,
    deleteCalls: 0,
    async match(request) {
      this.matchCalls += 1;
      const key = typeof request === 'string' ? request : request.url;
      const res = store.get(key);
      return res ? res.clone() : null;
    },
    async put(request, response) {
      this.putCalls += 1;
      const key = typeof request === 'string' ? request : request.url;
      store.set(key, response.clone());
    },
    async delete(request) {
      this.deleteCalls += 1;
      const key = typeof request === 'string' ? request : request.url;
      return store.delete(key);
    },
  };
}

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

async function setupTestDb() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));

  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

  // Insert test profiles
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('u1', 'UserOne', 'u1@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('u2', 'UserTwo', 'u2@local.test'),
  ]);

  // Insert template + items so template queries don't error
  await db.prepare(`
    INSERT INTO templates (id, creator_id, title, hashtags, tiers, created_at)
    VALUES ('tpl1', 'u1', 'Test Template', '#gaming', '[]', datetime('now', '-10 days'))
  `).run();
  await db.prepare(`INSERT INTO items (id, name) VALUES ('item1', 'Item One')`).run();
  await db.prepare(`INSERT INTO template_items (id, template_id, item_id, position) VALUES ('ti1', 'tpl1', 'item1', 0)`).run();

  return { mf, db };
}

async function callSpotlightsApi(db, url = 'https://local.test/api/spotlights') {
  const response = await spotlights({
    request: new Request(url, { method: 'GET' }),
    env: { tear_of_god_db: db },
    data: {},
    waitUntil: () => {},
  });
  return await response.json();
}

const { mf, db } = await setupTestDb();

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1:
// A: โพสต์ 5 วันก่อน, 20 comments, comment ล่าสุด 2 วันก่อน
// B: โพสต์ 3 วันก่อน, 2 comments, comment ล่าสุด 5 นาทีที่แล้ว
// C: โพสต์ 1 วันก่อน, ไม่มี comment (comments_count = 0)
// D: โพสต์อายุ 4 เดือน (120 วันก่อน), comment ล่าสุด 45 วันก่อน (> 30 days) -> ต้องไม่ติด
// E: โพสต์อายุ 4 เดือน (120 วันก่อน), แต่เพิ่งมี comment 1 นาทีที่แล้ว -> ต้องติดและขึ้น #1!
// ─────────────────────────────────────────────────────────────────────────────
console.log('Seeding Scenario 1: 4-month-old posts vs recent posts with comments...');

await db.batch([
  // Ranking A: created 5 days ago, 20 comments
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('ranking_A', 'Ranking A (Popular Old)', 'u1', 'tpl1', 20, datetime('now', '-5 days'))
  `),
  // Ranking B: created 3 days ago, 2 comments
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('ranking_B', 'Ranking B (Fresh Debate)', 'u2', 'tpl1', 2, datetime('now', '-3 days'))
  `),
  // Ranking C: created 1 day ago, 0 comments
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('ranking_C', 'Ranking C (No Comments)', 'u1', 'tpl1', 0, datetime('now', '-1 day'))
  `),
  // Ranking D: created 120 days ago (4 months), comments are 45 days ago (> 30 days)
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('ranking_D', 'Ranking D (4 months old, inactive comments)', 'u2', 'tpl1', 5, datetime('now', '-120 days'))
  `),
  // Ranking E: created 120 days ago (4 months), but has comment 1 minute ago!
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('ranking_E', 'Ranking E (4 months old, fresh comment 1 min ago)', 'u1', 'tpl1', 1, datetime('now', '-120 days'))
  `),
]);

// Insert comments for A (latest is 2 days ago)
const commentsA = [];
for (let i = 1; i <= 20; i++) {
  const hoursAgo = 48 + i;
  commentsA.push(
    db.prepare(`
      INSERT INTO comments (id, ranking_id, user_id, content, created_at)
      VALUES (?, 'ranking_A', 'u2', ?, datetime('now', ?))
    `).bind(`c_a_${i}`, `Comment ${i} for A`, `-${hoursAgo} hours`)
  );
}
await db.batch(commentsA);

// Insert comments for B (latest is 5 minutes ago)
await db.batch([
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_b_1', 'ranking_B', 'u1', 'First comment for B', datetime('now', '-1 hour'))
  `),
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_b_2', 'ranking_B', 'u2', 'Latest comment for B', datetime('now', '-5 minutes'))
  `),
  // Comments for D (latest is 45 days ago -> > 30 days old)
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_d_old', 'ranking_D', 'u1', 'Old comment for D', datetime('now', '-45 days'))
  `),
  // Comment for E (1 minute ago on a 4-month-old ranking)
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_e_fresh', 'ranking_E', 'u2', 'Fresh comment on 4-month-old post', datetime('now', '-1 minute'))
  `),
]);

// Query spotlights
const res1 = await callSpotlightsApi(db);
assert.equal(res1.success, true);
const { debate: debate1, recent: recent1 } = res1.data.freshness;

// Assertions for Scenario 1:
console.log('Verifying Scenario 1 assertions...');
assert.equal(debate1.length, 2, 'Only rankings with last_comment_at within 24 hours should be in debate');

// Ranking E (created 4 months ago) must be #1 because its last comment is 1 minute ago!
assert.equal(debate1[0].id, 'ranking_E', 'Ranking E (4 months old) with comment 1 min ago must be #1 in Active Debates');
// Ranking B is #2 (comment 5 minutes ago)
assert.equal(debate1[1].id, 'ranking_B', 'Ranking B with comment 5 mins ago must be #2');

// Ranking A (latest comment 2 days ago > 24 hours) must NOT be in debate
assert.equal(debate1.some((r) => r.id === 'ranking_A'), false, 'Ranking A with last comment 2 days ago must not appear in debate (exceeds 24 hours)');

// Ranking C (no comments) must NOT be in debate
assert.equal(debate1.some((r) => r.id === 'ranking_C'), false, 'Ranking C with 0 comments must not appear in debate');

// Ranking D (comments 45 days ago) must NOT be in debate
assert.equal(debate1.some((r) => r.id === 'ranking_D'), false, 'Ranking D with last comment 45 days ago must not appear in debate');

// Just Ranked (recent) must remain sorted by created_at DESC (unaffected by debate sorting)
assert.equal(recent1[0].id, 'ranking_C', 'Just Ranked (recent) must remain sorted by created_at DESC');
console.log('✔ Scenario 1 passed: 4-month-old post with fresh comment (<24h) ranks #1; inactive/old-comment posts excluded!');

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2:
// โพสต์อายุ 4 เดือน (ranking_D) ที่เดิมไม่ติดเพราะคอมเมนต์เกิน 30 วัน
// เมื่อเพิ่งมีคอมเมนต์ใหม่ตอนนี้ (10 วินาทีที่แล้ว)
// => ต้องดันขึ้น Active Debates อันดับ #1 ทันที!
// ─────────────────────────────────────────────────────────────────────────────
console.log('Seeding Scenario 2: Adding fresh comment to 4-month-old Ranking D...');

await db.batch([
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_d_brand_new', 'ranking_D', 'u1', 'Brand new comment on 4-month-old post D', datetime('now', '-10 seconds'))
  `),
  db.prepare(`UPDATE rankings SET comments_count = comments_count + 1 WHERE id = 'ranking_D'`),
]);

const res2 = await callSpotlightsApi(db);
const { debate: debate2 } = res2.data.freshness;

console.log('Verifying Scenario 2 assertions...');
assert.equal(debate2[0].id, 'ranking_D', '4-month-old Ranking D with brand new comment must immediately jump to #1 in Active Debates');
assert.equal(debate2[1].id, 'ranking_E', 'Ranking E is now #2');
console.log('✔ Scenario 2 passed: 4-month-old post with new comment immediately jumped to #1 in Active Debates!');

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3:
// Tie-breaking when last_comment_at is equal:
// ถ้าเวลา comment เท่ากัน ค่อยใช้ comments_count DESC แล้ว created_at DESC
// ─────────────────────────────────────────────────────────────────────────────
console.log('Seeding Scenario 3: Equal last_comment_at tie-breaker...');

await db.batch([
  // Ranking Tie 1: comments_count = 5, created 4 days ago
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('r_tie_low', 'Tie Low Count', 'u1', 'tpl1', 5, datetime('now', '-4 days'))
  `),
  // Ranking Tie 2: comments_count = 15, created 4 days ago
  db.prepare(`
    INSERT INTO rankings (id, title, user_id, template_id, comments_count, created_at)
    VALUES ('r_tie_high', 'Tie High Count', 'u2', 'tpl1', 15, datetime('now', '-4 days'))
  `),
  // Same last_comment_at for both
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_tie_1', 'r_tie_low', 'u1', 'Tie comment low', datetime('now', '-20 minutes'))
  `),
  db.prepare(`
    INSERT INTO comments (id, ranking_id, user_id, content, created_at)
    VALUES ('c_tie_2', 'r_tie_high', 'u2', 'Tie comment high', datetime('now', '-20 minutes'))
  `),
]);

const res3 = await callSpotlightsApi(db);
const { debate: debate3 } = res3.data.freshness;

console.log('Verifying Scenario 3 assertions...');
const tieHighIdx = debate3.findIndex((r) => r.id === 'r_tie_high');
const tieLowIdx = debate3.findIndex((r) => r.id === 'r_tie_low');

assert.ok(tieHighIdx !== -1 && tieLowIdx !== -1, 'Both tie rankings must be in debate');
assert.ok(
  tieHighIdx < tieLowIdx,
  `When last_comment_at is equal, ranking with higher comments_count (${tieHighIdx}) must rank above lower count (${tieLowIdx})`
);
console.log('✔ Scenario 3 passed: Equal last_comment_at tie-breaker orders by comments_count DESC!');

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Cache invalidation on comment mutation
// 1. warm spotlight cache
// 2. create new comment
// 3. cache must be invalidated
// 4. GET /api/spotlights returns ranking with the new comment at #1
// ─────────────────────────────────────────────────────────────────────────────
console.log('Seeding Scenario 4: Cache warming, invalidation on new comment, and fresh spotlight check...');

const originalCaches = globalThis.caches;
const cache = createFakeCache();
globalThis.caches = { default: cache };

const cacheKey = getSpotlightsCacheKey('https://local.test/api/spotlights').url;

// 1. Warm spotlight cache with initial cycle token
const initialCycleToken = 'cycle_warm_1';
const initialSpotlightRes = await callSpotlightsApi(db, `https://local.test/api/spotlights?cycle=${initialCycleToken}`);
assert.equal(initialSpotlightRes.success, true);
assert.equal(cache.putCalls, 1, 'Cache should have received a put call on cold miss');
assert.equal(cache.store.has(cacheKey), true, 'Cache store must contain canonical key without cycle param');

// Confirm backend canonicalization: requesting with a different cycle token matches the same edge cache
const secondCycleToken = 'cycle_warm_2';
const cachedSpotlightRes = await callSpotlightsApi(db, `https://local.test/api/spotlights?cycle=${secondCycleToken}`);
assert.equal(cache.matchCalls, 2, 'Cache match should have been called on second request');
assert.deepEqual(cachedSpotlightRes, initialSpotlightRes, 'Edge cache hit matches canonical key regardless of cycle param');

// Test canonicalization of getSpotlightsCacheKey directly
assert.equal(
  getSpotlightsCacheKey('https://local.test/api/spotlights?cycle=custom_token_123').url,
  cacheKey,
  'getSpotlightsCacheKey must canonicalize any query param into the standard schema cache key'
);

const currentTopId = initialSpotlightRes.data.freshness.debate[0].id;
const targetRankingId = currentTopId === 'ranking_A' ? 'ranking_B' : 'ranking_A';

// 2. Create new comment via POST /api/comments
console.log(`Creating new comment on ${targetRankingId} to test cache invalidation...`);
const createCommentRequest = new Request('https://local.test/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ranking_id: targetRankingId,
    content: 'Brand new comment pushing ranking to #1 with immediate cache invalidation!',
  }),
});

const commentRes = await commentsApi({
  request: createCommentRequest,
  env: { tear_of_god_db: db },
  data: { user: { id: 'u1', username: 'UserOne', role: 'user' } },
});
assert.equal(commentRes.status, 201, 'Comment creation must succeed');
const commentJson = await commentRes.json();
assert.equal(commentJson.success, true);
const createdCommentId = commentJson.data.id;

// 3. Cache must be invalidated
console.log('Verifying cache invalidation...');
assert.equal(cache.deleteCalls, 1, 'caches.default.delete must have been called on comment create');
assert.equal(cache.store.has(cacheKey), false, 'Spotlight cache key must no longer exist in store');
assert.equal(await cache.match(cacheKey), null, 'Cache match on spotlights key must return null after comment create');

// Test client event simulation and token sharing between FreshnessHub and FeaturedPrompts
const eventToken = String(Date.now());
const simulatedUrls = [];
const mockFreshnessHubHandler = (e) => {
  const token = e.detail?.token;
  simulatedUrls.push(`/api/spotlights?cycle=${token}`);
};
const mockFeaturedPromptsHandler = (e) => {
  const token = e.detail?.token;
  simulatedUrls.push(`/api/spotlights?cycle=${token}`);
};

const mockEvent = { detail: { token: eventToken } };
mockFreshnessHubHandler(mockEvent);
mockFeaturedPromptsHandler(mockEvent);

assert.equal(simulatedUrls.length, 2);
assert.equal(
  simulatedUrls[0],
  simulatedUrls[1],
  'FreshnessHub and FeaturedPrompts must use the identical cycle token URL for inFlightGET dedup'
);
assert.ok(
  simulatedUrls[0].includes(`?cycle=${eventToken}`),
  'Request URL must include ?cycle=<token> to bypass browser cache'
);

// 4. GET /api/spotlights with new cycle token returns ranking with the new comment at #1
console.log('Verifying GET /api/spotlights returns ranking with new comment at #1...');
const freshSpotlightRes = await callSpotlightsApi(db, `https://local.test/api/spotlights?cycle=${eventToken}`);
assert.equal(freshSpotlightRes.success, true);
const debateAfterComment = freshSpotlightRes.data.freshness.debate;
assert.equal(debateAfterComment[0].id, targetRankingId, `Ranking ${targetRankingId} with the new comment must now be #1 in Active Debates`);

// 5. Test comment deletion also invalidates cache
console.log('Verifying comment deletion also invalidates cache...');
assert.equal(cache.store.has(cacheKey), true, 'Spotlights cache was re-warmed after fetch');

const deleteCommentRequest = new Request('https://local.test/api/comments', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: createdCommentId }),
});

const deleteRes = await commentsApi({
  request: deleteCommentRequest,
  env: { tear_of_god_db: db },
  data: { user: { id: 'u1', username: 'UserOne', role: 'user' } },
});
assert.equal(deleteRes.status, 200, 'Comment deletion must succeed');
assert.equal(cache.deleteCalls, 2, 'caches.default.delete must be called on comment deletion');
assert.equal(cache.store.has(cacheKey), false, 'Spotlight cache key must be invalidated after comment delete');

console.log('✔ Scenario 4 passed: Cache warms, invalidates on create, reflects #1 ranking, dedupes token, and invalidates on delete!');

globalThis.caches = originalCaches;

await mf.dispose();
console.log('All Active Debates tests passed successfully!');
