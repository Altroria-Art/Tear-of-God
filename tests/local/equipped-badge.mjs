import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { onRequest as authEndpoint } from '../../functions/api/auth.js';
import { onRequest as usersEndpoint } from '../../functions/api/users.js';
import { digest } from '../../functions/lib/session.js';
import { VALID_BADGE_IDS, isBadgeUnlocked, calculateUnlockedBadges } from '../../functions/lib/badges.js';
import { BADGE_CATALOG, getBadgeStates } from '../../src/lib/badges.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(SQL_SCRIPT_SEPARATOR)
  .map((statement) => statement.trim())
  .filter(Boolean);

const userAId = 'user_test_a';
const userBId = 'user_test_b';
const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);

async function callEndpoint(db, endpoint, { method = 'POST', path, body, token } = {}) {
  const headers = {};
  if (token) headers.Cookie = `tog_session=${token}`;
  let requestBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const request = new Request(`http://localhost:8788${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const env = {
    APP_ENV: 'local',
    tear_of_god_db: db,
  };

  const context = {
    request,
    env,
    data: {},
    next: () => endpoint({ request, env, data: context.data }),
  };

  const response = await apiMiddleware(context);
  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    // not json
  }
  return { response, body: responseBody };
}

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("badge test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');

console.log('🧪 Starting Task 4: Equipped Badge Test Suite...');

try {
  // Apply schema
  await db.batch(schemaStatements.map((stmt) => db.prepare(stmt)));

  // Setup test users
  // User A will have 1 ranking (unlocked: 'first_rank', locked: 'ranker_10', 'ranking_veteran', etc.)
  // User B will have 10 rankings, 5 templates, 10 followers (unlocked: 'all_rounder', etc.)
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userAId, 'User Alpha', 'alpha@example.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userBId, 'User Beta', 'beta@example.test'),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenA), userAId, Date.now() + 3600_000),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenB), userBId, Date.now() + 3600_000),
  ]);

  // Give User A 1 ranking -> unlocks first_rank only
  await db.prepare('INSERT INTO rankings (id, title, user_id) VALUES (?, ?, ?)').bind('rank_a_1', 'Alpha Ranking 1', userAId).run();

  // Give User B stats to unlock all_rounder (>=10 rankings, >=5 templates, >=10 followers)
  const userBStatements = [];
  for (let i = 1; i <= 10; i++) {
    userBStatements.push(db.prepare('INSERT INTO rankings (id, title, user_id) VALUES (?, ?, ?)').bind(`rank_b_${i}`, `Beta Ranking ${i}`, userBId));
  }
  for (let i = 1; i <= 5; i++) {
    userBStatements.push(db.prepare('INSERT INTO templates (id, creator_id, title, use_count, tiers) VALUES (?, ?, ?, ?, ?)').bind(`temp_b_${i}`, userBId, `Beta Template ${i}`, i === 1 ? 30 : 0, '[]'));
  }
  for (let i = 1; i <= 10; i++) {
    const followerId = `follower_${i}`;
    userBStatements.push(db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(followerId, `Follower ${i}`, `f${i}@example.test`));
    userBStatements.push(db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').bind(followerId, userBId));
  }
  await db.batch(userBStatements);

  // -------------------------------------------------------------
  // Test 1: User A equips an UNLOCKED badge ('first_rank') -> Success (200)
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'update_profile', equipped_badge_id: 'first_rank' },
      token: tokenA,
    });
    assert.equal(res.response.status, 200, 'Equipping unlocked badge must return 200');
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.equipped_badge_id, 'first_rank');

    const dbRow = await db.prepare('SELECT equipped_badge_id FROM profiles WHERE id = ?').bind(userAId).first();
    assert.equal(dbRow.equipped_badge_id, 'first_rank', 'DB row must reflect equipped badge');
    console.log('✅ Scenario 1 Passed: User equips unlocked badge successfully');
  }

  // -------------------------------------------------------------
  // Test 2: User A attempts to equip a LOCKED badge ('ranker_10') -> Reject (403 BADGE_NOT_UNLOCKED)
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'update_profile', equipped_badge_id: 'ranker_10' },
      token: tokenA,
    });
    assert.equal(res.response.status, 403, 'Equipping locked badge must return 403');
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'BADGE_NOT_UNLOCKED');

    // DB must retain previous equipped badge ('first_rank')
    const dbRow = await db.prepare('SELECT equipped_badge_id FROM profiles WHERE id = ?').bind(userAId).first();
    assert.equal(dbRow.equipped_badge_id, 'first_rank', 'DB row must not change on rejected equip');

    // Test equip_badge action as well
    const resEquip = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'trending_template' },
      token: tokenA,
    });
    assert.equal(resEquip.response.status, 403, 'equip_badge action with locked badge must return 403');
    assert.equal(resEquip.body.code, 'BADGE_NOT_UNLOCKED');
    console.log('✅ Scenario 2 Passed: Equipping locked badge rejected with 403 BADGE_NOT_UNLOCKED');
  }

  // -------------------------------------------------------------
  // Test 3: User attempts to equip INVALID/UNKNOWN badge ID -> Reject (400 INVALID_BADGE)
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'update_profile', equipped_badge_id: 'hacker_god_badge' },
      token: tokenA,
    });
    assert.equal(res.response.status, 400, 'Invalid badge ID must return 400');
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'INVALID_BADGE');
    console.log('✅ Scenario 3 Passed: Invalid badge ID rejected with 400 INVALID_BADGE');
  }

  // -------------------------------------------------------------
  // Test 4: User unequips badge (`equipped_badge_id: null`) -> Success (200)
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'update_profile', equipped_badge_id: null },
      token: tokenA,
    });
    assert.equal(res.response.status, 200, 'Unequipping badge must return 200');
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.equipped_badge_id, null);

    const dbRow = await db.prepare('SELECT equipped_badge_id FROM profiles WHERE id = ?').bind(userAId).first();
    assert.equal(dbRow.equipped_badge_id, null, 'DB row must be NULL after unequip');

    // Also test equip_badge action with null
    // First re-equip first_rank
    await db.prepare('UPDATE profiles SET equipped_badge_id = ? WHERE id = ?').bind('first_rank', userAId).run();
    const resUnequipAction = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: null },
      token: tokenA,
    });
    assert.equal(resUnequipAction.response.status, 200);
    assert.equal(resUnequipAction.body.data.equipped_badge_id, null);
    console.log('✅ Scenario 4 Passed: Unequip badge sets equipped_badge_id to null');
  }

  // -------------------------------------------------------------
  // Test 5: User A cannot modify User B's equipped badge
  // -------------------------------------------------------------
  {
    // User A sends update_profile while trying to forge user_id: userBId in payload
    await db.prepare('UPDATE profiles SET equipped_badge_id = ? WHERE id = ?').bind('all_rounder', userBId).run();

    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'update_profile', user_id: userBId, id: userBId, equipped_badge_id: 'first_rank' },
      token: tokenA,
    });
    assert.equal(res.response.status, 200);
    // User A's profile was changed, NOT User B
    assert.equal(res.body.data.id, userAId);

    const userBRow = await db.prepare('SELECT equipped_badge_id FROM profiles WHERE id = ?').bind(userBId).first();
    assert.equal(userBRow.equipped_badge_id, 'all_rounder', 'User B badge must remain untouched by User A');
    console.log('✅ Scenario 5 Passed: Cross-user badge modification forbidden by verified session');
  }

  // -------------------------------------------------------------
  // Test 6: GET public profile returns equipped_badge_id and equipped_badge
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userBId}`,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.equipped_badge_id, 'all_rounder');
    assert.deepEqual(res.body.data.equipped_badge, { id: 'all_rounder' });

    // Edge case: if a user's DB column has a badge they are not eligible for, it normalizes to null
    await db.prepare('UPDATE profiles SET equipped_badge_id = ? WHERE id = ?').bind('trending_template', userAId).run();
    const resA = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userAId}`,
    });
    assert.equal(resA.response.status, 200);
    assert.equal(resA.body.data.equipped_badge_id, null, 'Illegitimate badge must normalize to null on profile read');
    assert.equal(resA.body.data.equipped_badge, null);
    console.log('✅ Scenario 6 Passed: Public profile returns equipped_badge_id with safe fallback');
  }

  // -------------------------------------------------------------
  // Test 7: Backward compatibility: profile with NULL equipped_badge_id works smoothly
  // -------------------------------------------------------------
  {
    await db.prepare('UPDATE profiles SET equipped_badge_id = NULL WHERE id = ?').bind(userAId).run();
    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userAId}`,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.equipped_badge_id, null);
    assert.equal(res.body.data.equipped_badge, null);
    console.log('✅ Scenario 7 Passed: Backward compatibility preserved for profiles with NULL badge');
  }

  // -------------------------------------------------------------
  // Test 8: BadgeGallery read-only mode operates cleanly
  // -------------------------------------------------------------
  {
    const states = getBadgeStates({
      rankingCount: 1,
      templateCount: 0,
      followerCount: 0,
      maxTemplateUses: 0,
      unlockedIds: ['first_rank'],
    });
    assert.ok(states.length >= 10);
    const firstRank = states.find((b) => b.id === 'first_rank');
    assert.equal(firstRank.unlocked, true);
    const ranker10 = states.find((b) => b.id === 'ranker_10');
    assert.equal(ranker10.unlocked, false);
    console.log('✅ Scenario 8 Passed: BadgeGallery state derivation works seamlessly');
  }

  // -------------------------------------------------------------
  // Test 9: Existing badge catalog thresholds are completely unchanged
  // -------------------------------------------------------------
  {
    const catalogMap = new Map(BADGE_CATALOG.map((b) => [b.id, b]));
    assert.ok(VALID_BADGE_IDS.size >= 10);
    for (const id of VALID_BADGE_IDS) {
      assert.ok(catalogMap.has(id), `Catalog must contain ${id}`);
    }

    // Verify all 10 thresholds individually
    assert.equal(isBadgeUnlocked('first_rank', { rankingCount: 0 }), false);
    assert.equal(isBadgeUnlocked('first_rank', { rankingCount: 1 }), true);

    assert.equal(isBadgeUnlocked('ranker_10', { rankingCount: 9 }), false);
    assert.equal(isBadgeUnlocked('ranker_10', { rankingCount: 10 }), true);

    assert.equal(isBadgeUnlocked('ranking_veteran', { rankingCount: 49 }), false);
    assert.equal(isBadgeUnlocked('ranking_veteran', { rankingCount: 50 }), true);

    assert.equal(isBadgeUnlocked('template_creator', { templateCount: 0 }), false);
    assert.equal(isBadgeUnlocked('template_creator', { templateCount: 1 }), true);

    assert.equal(isBadgeUnlocked('template_builder', { templateCount: 4 }), false);
    assert.equal(isBadgeUnlocked('template_builder', { templateCount: 5 }), true);

    assert.equal(isBadgeUnlocked('community_voice', { followerCount: 4 }), false);
    assert.equal(isBadgeUnlocked('community_voice', { followerCount: 5 }), true);

    assert.equal(isBadgeUnlocked('community_star', { followerCount: 24 }), false);
    assert.equal(isBadgeUnlocked('community_star', { followerCount: 25 }), true);

    assert.equal(isBadgeUnlocked('template_hit', { maxTemplateUses: 24 }), false);
    assert.equal(isBadgeUnlocked('template_hit', { maxTemplateUses: 25 }), true);

    assert.equal(isBadgeUnlocked('trending_template', { maxTemplateUses: 99 }), false);
    assert.equal(isBadgeUnlocked('trending_template', { maxTemplateUses: 100 }), true);

    assert.equal(isBadgeUnlocked('all_rounder', { rankingCount: 9, templateCount: 5, followerCount: 10 }), false);
    assert.equal(isBadgeUnlocked('all_rounder', { rankingCount: 10, templateCount: 4, followerCount: 10 }), false);
    assert.equal(isBadgeUnlocked('all_rounder', { rankingCount: 10, templateCount: 5, followerCount: 9 }), false);
    assert.equal(isBadgeUnlocked('all_rounder', { rankingCount: 10, templateCount: 5, followerCount: 10 }), true);

    // Verify calculateUnlockedBadges produces all 10 badges when max stats met
    const allBadges = calculateUnlockedBadges({
      rankingCount: 50,
      templateCount: 5,
      followerCount: 25,
      maxTemplateUses: 100,
    });
    assert.equal(allBadges.length, 10, 'All 10 badges unlocked with max stats');
    console.log('✅ Scenario 9 Passed: All 10 existing badge thresholds completely unchanged');
  }

  console.log('🎉 ALL 9 EQUIPPED BADGE TEST SCENARIOS PASSED SUCCESSFULLY!');
} finally {
  await mf.dispose();
}
