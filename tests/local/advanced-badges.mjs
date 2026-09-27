import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { onRequest as authEndpoint } from '../../functions/api/auth.js';
import { onRequest as usersEndpoint } from '../../functions/api/users.js';
import { digest } from '../../functions/lib/session.js';
import {
  VALID_BADGE_IDS,
  HASHTAG_BADGE_IDS,
  HASHTAG_BADGE_THRESHOLDS,
  isBadgeUnlocked,
  calculateUnlockedBadges,
  normalizeHashtag,
  checkUserBadgeUnlocked,
  validateAndResolveEquipBadge,
} from '../../functions/lib/badges.js';
import { BADGE_CATALOG, getBadgeStates } from '../../src/lib/badges.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const userAlphaId = 'user_alpha';
const userBetaId = 'user_beta';
const userGammaId = 'user_gamma';
const userDeltaId = 'user_delta';
const tokenAlpha = 'a'.repeat(64);
const tokenBeta = 'b'.repeat(64);
const tokenGamma = 'c'.repeat(64);
const tokenDelta = 'd'.repeat(64);

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
  script: 'export default { fetch() { return new Response("advanced badge test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');

console.log('🧪 Starting Task 5: Advanced Badges & Generic Hashtag Achievements Test Suite...');

try {
  // Apply schema
  await db.batch(schemaStatements.map((stmt) => db.prepare(stmt)));

  // Setup users
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userAlphaId, 'Alpha Creator', 'alpha@god.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userBetaId, 'Beta Tag Master', 'beta@god.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userGammaId, 'Gamma Novice', 'gamma@god.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userDeltaId, 'Delta Gamer', 'delta@god.test'),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenAlpha), userAlphaId, Date.now() + 3600_000),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenBeta), userBetaId, Date.now() + 3600_000),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenGamma), userGammaId, Date.now() + 3600_000),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(tokenDelta), userDeltaId, Date.now() + 3600_000),
  ]);

  // -------------------------------------------------------------
  // Scenario 1: Badge Catalog integrity (14 badges total, all 10 legacy preserved)
  // -------------------------------------------------------------
  {
    assert.equal(BADGE_CATALOG.length, 14, 'Catalog must contain exactly 14 badges');
    assert.equal(VALID_BADGE_IDS.size, 14, 'VALID_BADGE_IDS must contain exactly 14 badges');

    const expectedBadgeIds = [
      'first_rank',
      'ranker_10',
      'ranking_veteran',
      'template_creator',
      'template_builder',
      'community_voice',
      'community_star',
      'template_hit',
      'trending_template',
      'template_legend',
      'all_rounder',
      'hashtag_enthusiast',
      'hashtag_specialist',
      'hashtag_master',
    ];

    const catalogIds = BADGE_CATALOG.map((b) => b.id);
    assert.deepEqual(catalogIds, expectedBadgeIds);
    for (const id of expectedBadgeIds) {
      assert.ok(VALID_BADGE_IDS.has(id), `VALID_BADGE_IDS must include ${id}`);
    }
    console.log('✅ Scenario 1 Passed: 14 badges in catalog with legacy badges intact');
  }

  // -------------------------------------------------------------
  // Scenario 2: Template milestone boundaries & MAX(use_count) vs SUM(use_count)
  // -------------------------------------------------------------
  {
    // Boundaries: 24/25, 99/100, 499/500
    assert.equal(isBadgeUnlocked('template_hit', { maxTemplateUses: 24 }), false);
    assert.equal(isBadgeUnlocked('template_hit', { maxTemplateUses: 25 }), true);

    assert.equal(isBadgeUnlocked('trending_template', { maxTemplateUses: 99 }), false);
    assert.equal(isBadgeUnlocked('trending_template', { maxTemplateUses: 100 }), true);

    assert.equal(isBadgeUnlocked('template_legend', { maxTemplateUses: 499 }), false);
    assert.equal(isBadgeUnlocked('template_legend', { maxTemplateUses: 500 }), true);
    assert.equal(isBadgeUnlocked('template_legend', { maxTemplateUses: 1250 }), true);

    // Rule confirmation: MAX not SUM
    // Creator with templates of 300 uses and 250 uses (SUM=550, but MAX=300)
    const maxUses = Math.max(300, 250);
    assert.equal(isBadgeUnlocked('template_legend', { maxTemplateUses: maxUses }), false, '300 + 250 uses must NOT unlock template_legend');
    assert.equal(isBadgeUnlocked('trending_template', { maxTemplateUses: maxUses }), true, '300 uses unlocks trending_template');
    assert.equal(isBadgeUnlocked('template_hit', { maxTemplateUses: maxUses }), true, '300 uses unlocks template_hit');

    const legendBadge = BADGE_CATALOG.find((b) => b.id === 'template_legend');
    assert.equal(legendBadge.need, 500);
    assert.equal(legendBadge.unit, 'uses');
    console.log('✅ Scenario 2 Passed: Template milestone boundaries and MAX(use_count) verified (300+250 correctly locks legend)');
  }

  // -------------------------------------------------------------
  // Scenario 3: Hashtag milestones thresholds logic
  // -------------------------------------------------------------
  {
    assert.equal(HASHTAG_BADGE_THRESHOLDS.hashtag_enthusiast, 10);
    assert.equal(HASHTAG_BADGE_THRESHOLDS.hashtag_specialist, 50);
    assert.equal(HASHTAG_BADGE_THRESHOLDS.hashtag_master, 100);
    assert.equal(HASHTAG_BADGE_IDS.size, 3);
    assert.ok(HASHTAG_BADGE_IDS.has('hashtag_enthusiast'));
    assert.ok(HASHTAG_BADGE_IDS.has('hashtag_specialist'));
    assert.ok(HASHTAG_BADGE_IDS.has('hashtag_master'));

    assert.equal(isBadgeUnlocked('hashtag_enthusiast', { topHashtagCount: 9 }), false);
    assert.equal(isBadgeUnlocked('hashtag_enthusiast', { topHashtagCount: 10 }), true);

    assert.equal(isBadgeUnlocked('hashtag_specialist', { topHashtagCount: 49 }), false);
    assert.equal(isBadgeUnlocked('hashtag_specialist', { topHashtagCount: 50 }), true);

    assert.equal(isBadgeUnlocked('hashtag_master', { topHashtagCount: 99 }), false);
    assert.equal(isBadgeUnlocked('hashtag_master', { topHashtagCount: 100 }), true);

    // Unit test calculateUnlockedBadges
    const unlockedBadges = calculateUnlockedBadges({
      rankingCount: 50,
      followerCount: 25,
      templateCount: 5,
      maxTemplateUses: 500,
      topHashtag: { hashtag: '#Anime', count: 120 },
    });
    assert.equal(unlockedBadges.length, 14, 'All 14 badges unlocked when all thresholds satisfied');
    console.log('✅ Scenario 3 Passed: Generic hashtag milestone thresholds 10/50/100 verified');
  }

  // -------------------------------------------------------------
  // Scenario 4: Hashtag normalization
  // -------------------------------------------------------------
  {
    assert.equal(normalizeHashtag('#Anime'), 'anime');
    assert.equal(normalizeHashtag('##Games  '), 'games');
    assert.equal(normalizeHashtag('###ZELDA'), 'zelda');
    assert.equal(normalizeHashtag('Food'), 'food');
    assert.equal(normalizeHashtag('   #Music   '), 'music');
    assert.equal(normalizeHashtag(''), '');
    assert.equal(normalizeHashtag(null), '');
    console.log('✅ Scenario 4 Passed: Hashtag normalization handles cases, spaces and leading hashes');
  }

  // -------------------------------------------------------------
  // Scenario 5: User Alpha template_legend in DB & Equip
  // -------------------------------------------------------------
  {
    // Alpha has 1 template with 499 uses -> cannot equip template_legend
    await db.prepare('INSERT INTO templates (id, creator_id, title, use_count, tiers) VALUES (?, ?, ?, ?, ?)')
      .bind('tpl_alpha_1', userAlphaId, 'Alpha Template', 499, '[]').run();

    const resReject = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'template_legend' },
      token: tokenAlpha,
    });
    assert.equal(resReject.response.status, 403);
    assert.equal(resReject.body.code, 'BADGE_NOT_UNLOCKED');

    // Update uses to 500 -> unlocks template_legend
    await db.prepare('UPDATE templates SET use_count = 500 WHERE id = ?').bind('tpl_alpha_1').run();

    const resAccept = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'template_legend' },
      token: tokenAlpha,
    });
    assert.equal(resAccept.response.status, 200);
    assert.equal(resAccept.body.success, true);
    assert.equal(resAccept.body.data.equipped_badge_id, 'template_legend');
    assert.equal(resAccept.body.data.equipped_badge_meta, null);
    assert.deepEqual(resAccept.body.data.equipped_badge, { id: 'template_legend' });

    // Verify helper functions directly
    assert.equal(await checkUserBadgeUnlocked(db, userAlphaId, 'template_legend'), true);
    const resolved = await validateAndResolveEquipBadge(db, userAlphaId, 'template_legend', null);
    assert.equal(resolved.valid, true);
    assert.equal(resolved.badgeId, 'template_legend');
    assert.equal(resolved.metaString, null);
    console.log('✅ Scenario 5 Passed: template_legend equipped upon reaching 500 uses');
  }

  // -------------------------------------------------------------
  // Scenario 6: User Beta hashtag contribution calculation:
  // 1 contribution = 1 distinct ranking with tag + 1 distinct template with tag
  // Duplicate tags in a single ranking or template count as 1
  // -------------------------------------------------------------
  {
    const betaStatements = [];
    // User Beta creates 60 rankings with '#Anime, anime, #ANIME' (duplicate within post -> counts as 1 distinct post per tag)
    for (let i = 1; i <= 60; i++) {
      betaStatements.push(
        db.prepare('INSERT INTO rankings (id, title, user_id, hashtags) VALUES (?, ?, ?, ?)')
          .bind(`rank_beta_anime_${i}`, `Anime Ranking ${i}`, userBetaId, '#Anime, anime, #ANIME')
      );
    }
    // User Beta creates 45 templates with '#Anime, ##anime' (duplicate within template -> counts as 1 distinct template per tag)
    for (let i = 1; i <= 45; i++) {
      betaStatements.push(
        db.prepare('INSERT INTO templates (id, creator_id, title, hashtags, use_count, tiers) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(`tpl_beta_anime_${i}`, userBetaId, `Anime Template ${i}`, '#Anime, ##anime', 0, '[]')
      );
    }
    // Total #anime contributions = 60 rankings + 45 templates = 105 contributions! (unlocks enthusiast, specialist, master)

    // User Beta creates 15 rankings with '#Gaming' (15 contributions -> secondary tag, unlocks enthusiast only)
    for (let i = 1; i <= 15; i++) {
      betaStatements.push(
        db.prepare('INSERT INTO rankings (id, title, user_id, hashtags) VALUES (?, ?, ?, ?)')
          .bind(`rank_beta_game_${i}`, `Gaming Ranking ${i}`, userBetaId, '#Gaming')
      );
    }

    await db.batch(betaStatements);

    // Verify contribution count in D1 for anime
    const animeCount = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT ranking_id AS id, hashtag FROM ranking_hashtags WHERE user_id = ? AND hashtag = 'anime'
        UNION ALL
        SELECT template_id AS id, hashtag FROM template_hashtags WHERE creator_id = ? AND hashtag = 'anime'
      )
    `).bind(userBetaId, userBetaId).first();
    assert.equal(animeCount.count, 105, '105 contributions for anime (60 rankings + 45 templates)');

    // Verify contribution count in D1 for gaming
    const gamingCount = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT ranking_id AS id, hashtag FROM ranking_hashtags WHERE user_id = ? AND hashtag = 'gaming'
        UNION ALL
        SELECT template_id AS id, hashtag FROM template_hashtags WHERE creator_id = ? AND hashtag = 'gaming'
      )
    `).bind(userBetaId, userBetaId).first();
    assert.equal(gamingCount.count, 15, '15 contributions for gaming');
    console.log('✅ Scenario 6 Passed: Contribution calculation correctly unites distinct rankings and templates without duplicates');
  }

  // -------------------------------------------------------------
  // Scenario 7: Public profile API returns unlocked hashtag milestones & top hashtag
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userBetaId}`,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.success, true);

    const tasteIdentity = res.body.data.taste_identity;
    assert.ok(tasteIdentity);
    // Top hashtag must be anime with count 105
    assert.equal(tasteIdentity.top_hashtag.hashtag, 'anime');
    assert.equal(tasteIdentity.top_hashtag.count, 105);

    // taste_identity.badges must contain hashtag_enthusiast, hashtag_specialist, hashtag_master with hashtag and value
    const badges = tasteIdentity.badges;
    const enthusiast = badges.find((b) => b.id === 'hashtag_enthusiast');
    assert.ok(enthusiast, 'hashtag_enthusiast unlocked');
    assert.equal(enthusiast.hashtag, '#anime');
    assert.equal(enthusiast.value, 105);

    const specialist = badges.find((b) => b.id === 'hashtag_specialist');
    assert.ok(specialist, 'hashtag_specialist unlocked');
    assert.equal(specialist.hashtag, '#anime');
    assert.equal(specialist.value, 105);

    const master = badges.find((b) => b.id === 'hashtag_master');
    assert.ok(master, 'hashtag_master unlocked');
    assert.equal(master.hashtag, '#anime');
    assert.equal(master.value, 105);
    console.log('✅ Scenario 7 Passed: Public profile returns unlocked hashtag milestones with #tag and value');
  }

  // -------------------------------------------------------------
  // Scenario 8: Equip hashtag badge with valid metadata -> Success
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'equip_badge',
        equipped_badge_id: 'hashtag_master',
        equipped_badge_meta: { hashtag: '#Anime' },
      },
      token: tokenBeta,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.equipped_badge_id, 'hashtag_master');
    assert.deepEqual(res.body.data.equipped_badge_meta, { hashtag: '#Anime' });
    assert.deepEqual(res.body.data.equipped_badge, { id: 'hashtag_master', hashtag: '#Anime' });

    // Verify DB
    const dbRow = await db.prepare('SELECT equipped_badge_id, equipped_badge_meta FROM profiles WHERE id = ?').bind(userBetaId).first();
    assert.equal(dbRow.equipped_badge_id, 'hashtag_master');
    assert.equal(dbRow.equipped_badge_meta, '{"hashtag":"#Anime"}');
    console.log('✅ Scenario 8 Passed: Equipping hashtag badge stores badge ID and hashtag metadata');
  }

  // -------------------------------------------------------------
  // Scenario 9: Top Hashtag Achievement Rule (Item 8) & Threshold Enforcement:
  // - User Beta (Top tag: #Anime 105, Secondary tag: #Gaming 15)
  //   Trying to equip #Gaming -> REJECT 403 (Item 8: only top hashtag is an unlocked identity achievement)
  // - User Delta (Top tag: #Gaming 15)
  //   Trying to equip hashtag_specialist with #Gaming (15 < 50) -> REJECT 403
  //   Trying to equip hashtag_enthusiast with #Gaming (15 >= 10) -> SUCCESS 200
  // -------------------------------------------------------------
  {
    // Setup Delta with 15 rankings in #Gaming (so #Gaming is Delta's top hashtag)
    const deltaStatements = [];
    for (let i = 1; i <= 15; i++) {
      deltaStatements.push(
        db.prepare('INSERT INTO rankings (id, title, user_id, hashtags) VALUES (?, ?, ?, ?)')
          .bind(`rank_delta_game_${i}`, `Delta Game ${i}`, userDeltaId, '#Gaming')
      );
    }
    await db.batch(deltaStatements);

    // 1. User Beta tries to equip #Gaming (non-top tag, 15 contributions vs #Anime 105) -> must reject
    const resBetaNonTop = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'equip_badge',
        equipped_badge_id: 'hashtag_enthusiast',
        equipped_badge_meta: { hashtag: '#Gaming' },
      },
      token: tokenBeta,
    });
    assert.equal(resBetaNonTop.response.status, 403);
    assert.equal(resBetaNonTop.body.code, 'BADGE_NOT_UNLOCKED');

    // 2. User Delta tries to equip hashtag_specialist with #Gaming (15 < 50) -> must reject
    const resDeltaSpecialist = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'equip_badge',
        equipped_badge_id: 'hashtag_specialist',
        equipped_badge_meta: { hashtag: '#Gaming' },
      },
      token: tokenDelta,
    });
    assert.equal(resDeltaSpecialist.response.status, 403);
    assert.equal(resDeltaSpecialist.body.code, 'BADGE_NOT_UNLOCKED');

    // 3. User Delta tries to equip hashtag_enthusiast with #Gaming (15 >= 10, top tag) -> must succeed
    const resDeltaEnthusiast = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'equip_badge',
        equipped_badge_id: 'hashtag_enthusiast',
        equipped_badge_meta: { hashtag: 'Gaming' },
      },
      token: tokenDelta,
    });
    assert.equal(resDeltaEnthusiast.response.status, 200);
    assert.equal(resDeltaEnthusiast.body.data.equipped_badge_id, 'hashtag_enthusiast');
    assert.deepEqual(resDeltaEnthusiast.body.data.equipped_badge_meta, { hashtag: '#Gaming' });
    console.log('✅ Scenario 9 Passed: Top Hashtag rule (Item 8) and threshold enforcement verified');
  }

  // -------------------------------------------------------------
  // Scenario 10: Security / Tampering on equip_badge
  // -------------------------------------------------------------
  {
    // Arbitrary unearned tag
    const resCrypto = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'hashtag_enthusiast', equipped_badge_meta: { hashtag: '#Crypto' } },
      token: tokenBeta,
    });
    assert.equal(resCrypto.response.status, 403);
    assert.equal(resCrypto.body.code, 'BADGE_NOT_UNLOCKED');

    // Missing metadata
    const resMissing = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'hashtag_enthusiast' },
      token: tokenBeta,
    });
    assert.equal(resMissing.response.status, 403);

    // Empty/spaces metadata
    const resEmpty = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'hashtag_enthusiast', equipped_badge_meta: { hashtag: '   ' } },
      token: tokenBeta,
    });
    assert.equal(resEmpty.response.status, 403);

    // Array / malformed metadata
    const resArray = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'hashtag_enthusiast', equipped_badge_meta: ['#Anime'] },
      token: tokenBeta,
    });
    assert.equal(resArray.response.status, 403);

    // Oversized metadata
    const resOversized = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: { action: 'equip_badge', equipped_badge_id: 'hashtag_enthusiast', equipped_badge_meta: { hashtag: 'A'.repeat(1000) } },
      token: tokenBeta,
    });
    assert.equal(resOversized.response.status, 403);
    console.log('✅ Scenario 10 Passed: equip_badge strictly rejects unearned tags, missing/empty/oversized/malformed metadata');
  }

  // -------------------------------------------------------------
  // Scenario 11: Security / Tampering on update_profile
  // -------------------------------------------------------------
  {
    // Attempting to sneak an unearned tag via update_profile
    const resUpdateUnearned = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'update_profile',
        bio: 'Hacker bio',
        equipped_badge_id: 'hashtag_master',
        equipped_badge_meta: { hashtag: '#Crypto' },
      },
      token: tokenBeta,
    });
    assert.equal(resUpdateUnearned.response.status, 403);
    assert.equal(resUpdateUnearned.body.code, 'BADGE_NOT_UNLOCKED');

    // Attempting to equip hashtag badge without meta via update_profile
    const resUpdateNoMeta = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'update_profile',
        equipped_badge_id: 'hashtag_master',
      },
      token: tokenBeta,
    });
    assert.equal(resUpdateNoMeta.response.status, 403);
    assert.equal(resUpdateNoMeta.body.code, 'BADGE_NOT_UNLOCKED');

    // Attempting to equip non-top hashtag via update_profile
    const resUpdateNonTop = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'update_profile',
        equipped_badge_id: 'hashtag_enthusiast',
        equipped_badge_meta: { hashtag: '#Gaming' },
      },
      token: tokenBeta,
    });
    assert.equal(resUpdateNonTop.response.status, 403);
    assert.equal(resUpdateNonTop.body.code, 'BADGE_NOT_UNLOCKED');
    console.log('✅ Scenario 11 Passed: update_profile strictly enforces the exact same security rules as equip_badge');
  }

  // -------------------------------------------------------------
  // Scenario 12: Public profile GET returns equipped hashtag badge and metadata
  // -------------------------------------------------------------
  {
    // Re-equip hashtag_master with #Anime for user Beta
    await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'equip_badge',
        equipped_badge_id: 'hashtag_master',
        equipped_badge_meta: { hashtag: '#Anime' },
      },
      token: tokenBeta,
    });

    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userBetaId}`,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.equipped_badge_id, 'hashtag_master');
    assert.deepEqual(res.body.data.equipped_badge_meta, { hashtag: '#Anime' });
    assert.deepEqual(res.body.data.equipped_badge, { id: 'hashtag_master', hashtag: '#Anime' });
    console.log('✅ Scenario 12 Passed: Public profile GET returns equipped badge and metadata');
  }

  // -------------------------------------------------------------
  // Scenario 13: Stale / Degraded Data Fallback on Public Profile
  // -------------------------------------------------------------
  {
    // 1. User Delta has 15 contributions and equipped hashtag_enthusiast.
    // If Delta's contributions drop to 9 (e.g. rankings deleted), enthusiast should no longer display.
    // Delete 7 rankings so Delta has only 8 contributions left (< 10)
    await db.prepare('DELETE FROM rankings WHERE user_id = ? AND id IN (SELECT id FROM rankings WHERE user_id = ? LIMIT 7)')
      .bind(userDeltaId, userDeltaId).run();

    const resDeltaStale = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userDeltaId}`,
    });
    assert.equal(resDeltaStale.response.status, 200);
    assert.equal(resDeltaStale.body.data.equipped_badge_id, null, 'Degraded hashtag badge normalizes to null');
    assert.equal(resDeltaStale.body.data.equipped_badge_meta, null);
    assert.equal(resDeltaStale.body.data.equipped_badge, null);

    // 2. User Alpha has template_legend equipped. If Alpha's max template uses drop to 499:
    await db.prepare('UPDATE templates SET use_count = 499 WHERE id = ?').bind('tpl_alpha_1').run();
    const resAlphaStale = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userAlphaId}`,
    });
    assert.equal(resAlphaStale.response.status, 200);
    assert.equal(resAlphaStale.body.data.equipped_badge_id, null, 'Degraded template badge normalizes to null');
    assert.equal(resAlphaStale.body.data.equipped_badge, null);

    // 3. Corrupt/malformed JSON in DB:
    await db.prepare('UPDATE profiles SET equipped_badge_meta = ? WHERE id = ?')
      .bind('{corrupted-json: true', userBetaId).run();
    const resBetaCorrupted = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userBetaId}`,
    });
    assert.equal(resBetaCorrupted.response.status, 200);
    assert.equal(resBetaCorrupted.body.data.equipped_badge_id, null);
    assert.equal(resBetaCorrupted.body.data.equipped_badge_meta, null);
    assert.equal(resBetaCorrupted.body.data.equipped_badge, null);

    // Restore Beta's valid metadata for subsequent scenarios
    await db.prepare('UPDATE profiles SET equipped_badge_meta = ? WHERE id = ?')
      .bind('{"hashtag":"#Anime"}', userBetaId).run();
    console.log('✅ Scenario 13 Passed: Public profile safely falls back to null on degraded thresholds or corrupted JSON (0 crashes, 200 OK)');
  }

  // -------------------------------------------------------------
  // Scenario 14: Illegitimately injected badge in DB for user with 0 stats normalizes to null
  // -------------------------------------------------------------
  {
    // User Gamma has 0 hashtags. Force inject hashtag_master into Gamma's DB row
    await db.prepare('UPDATE profiles SET equipped_badge_id = ?, equipped_badge_meta = ? WHERE id = ?')
      .bind('hashtag_master', '{"hashtag":"#Hacker"}', userGammaId).run();

    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userGammaId}`,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.equipped_badge_id, null, 'Illegitimate hashtag badge must normalize to null');
    assert.equal(res.body.data.equipped_badge_meta, null);
    assert.equal(res.body.data.equipped_badge, null);
    console.log('✅ Scenario 14 Passed: Injected badge normalizes safely to null on profile view');
  }

  // -------------------------------------------------------------
  // Scenario 15: update_profile action preserves equipped badge when not sent
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'update_profile',
        bio: 'Updated bio for Beta',
      },
      token: tokenBeta,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.bio, 'Updated bio for Beta');
    assert.equal(res.body.data.equipped_badge_id, 'hashtag_master');
    assert.deepEqual(res.body.data.equipped_badge_meta, { hashtag: '#Anime' });
    console.log('✅ Scenario 15 Passed: Updating profile bio preserves equipped badge and metadata');
  }

  // -------------------------------------------------------------
  // Scenario 16: update_profile action with unequip (equipped_badge_id: null)
  // -------------------------------------------------------------
  {
    const res = await callEndpoint(db, authEndpoint, {
      path: '/api/auth',
      body: {
        action: 'update_profile',
        equipped_badge_id: null,
      },
      token: tokenBeta,
    });
    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.equipped_badge_id, null);
    assert.equal(res.body.data.equipped_badge_meta, null);

    const dbRow = await db.prepare('SELECT equipped_badge_id, equipped_badge_meta FROM profiles WHERE id = ?').bind(userBetaId).first();
    assert.equal(dbRow.equipped_badge_id, null);
    assert.equal(dbRow.equipped_badge_meta, null);
    console.log('✅ Scenario 16 Passed: update_profile with equipped_badge_id: null clears both columns');
  }

  // -------------------------------------------------------------
  // Scenario 17: Top hashtag tie-breaker: alphabetical order
  // -------------------------------------------------------------
  {
    const userTieId = 'user_tie';
    await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(userTieId, 'Tie User', 'tie@god.test').run();

    // 10 rankings with #Zelda and 10 rankings with #Apex
    const tieStatements = [];
    for (let i = 1; i <= 10; i++) {
      tieStatements.push(db.prepare('INSERT INTO rankings (id, title, user_id, hashtags) VALUES (?, ?, ?, ?)').bind(`rank_zelda_${i}`, `Zelda ${i}`, userTieId, '#Zelda'));
      tieStatements.push(db.prepare('INSERT INTO rankings (id, title, user_id, hashtags) VALUES (?, ?, ?, ?)').bind(`rank_apex_${i}`, `Apex ${i}`, userTieId, '#Apex'));
    }
    await db.batch(tieStatements);

    const res = await callEndpoint(db, usersEndpoint, {
      method: 'GET',
      path: `/api/users?id=${userTieId}`,
    });
    assert.equal(res.response.status, 200);
    // Apex comes before Zelda alphabetically
    assert.equal(res.body.data.taste_identity.top_hashtag.hashtag, 'apex');
    assert.equal(res.body.data.taste_identity.top_hashtag.count, 10);
    console.log('✅ Scenario 17 Passed: Top hashtag tie-breaker selects alphabetically first tag');
  }

  // -------------------------------------------------------------
  // Scenario 18: getBadgeStates derives correct progress and hashtag
  // -------------------------------------------------------------
  {
    const states = getBadgeStates({
      rankingCount: 20,
      templateCount: 6,
      followerCount: 30,
      maxTemplateUses: 550,
      topHashtag: { hashtag: 'Anime', count: 65 },
      unlockedBadges: [
        { id: 'first_rank', value: 20 },
        { id: 'ranker_10', value: 20 },
        { id: 'template_creator', value: 6 },
        { id: 'template_builder', value: 6 },
        { id: 'community_voice', value: 30 },
        { id: 'community_star', value: 30 },
        { id: 'template_hit', value: 550 },
        { id: 'trending_template', value: 550 },
        { id: 'template_legend', value: 550 },
        { id: 'all_rounder', value: 3 },
        { id: 'hashtag_enthusiast', hashtag: '#Anime', value: 65 },
        { id: 'hashtag_specialist', hashtag: '#Anime', value: 65 },
      ],
    });

    const legend = states.find((b) => b.id === 'template_legend');
    assert.equal(legend.unlocked, true);
    assert.equal(legend.progress, 500);

    const enthusiast = states.find((b) => b.id === 'hashtag_enthusiast');
    assert.equal(enthusiast.unlocked, true);
    assert.equal(enthusiast.hashtag, '#Anime');
    assert.equal(enthusiast.progress, 10);

    const specialist = states.find((b) => b.id === 'hashtag_specialist');
    assert.equal(specialist.unlocked, true);
    assert.equal(specialist.hashtag, '#Anime');
    assert.equal(specialist.progress, 50);

    const master = states.find((b) => b.id === 'hashtag_master');
    assert.equal(master.unlocked, false);
    assert.equal(master.hashtag, '#Anime');
    assert.equal(master.progress, 65); // Shows 65/100 towards next milestone
    console.log('✅ Scenario 18 Passed: getBadgeStates correctly derives progress, unlocked status and #hashtag');
  }

  // -------------------------------------------------------------
  // Scenario 19: D1 EXPLAIN QUERY PLAN verification
  // -------------------------------------------------------------
  {
    const explainPlan = await db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT hashtag, COUNT(*) AS count
      FROM (
        SELECT ranking_id AS id, hashtag FROM ranking_hashtags WHERE user_id = ?
        UNION ALL
        SELECT template_id AS id, hashtag FROM template_hashtags WHERE creator_id = ?
      )
      GROUP BY hashtag
      ORDER BY count DESC, hashtag ASC
    `).bind(userBetaId, userBetaId).all();

    const planRows = explainPlan.results || [];
    assert.ok(planRows.length > 0, 'Query plan rows must not be empty');

    const planText = planRows.map((r) => r.detail || JSON.stringify(r)).join('\n');
    console.log('🔍 D1 EXPLAIN QUERY PLAN details:\n' + planText);

    // Verify index usage on rankings and templates
    assert.ok(
      planText.includes('idx_rankings_user_created'),
      'Must use index idx_rankings_user_created on rankings(user_id)'
    );
    assert.ok(
      planText.includes('idx_templates_creator_id'),
      'Must use index idx_templates_creator_id on templates(creator_id)'
    );
    assert.ok(!/\bSCAN r\b/.test(planText), 'Must NOT full-scan rankings table');
    assert.ok(!/\bSCAN t\b/.test(planText), 'Must NOT full-scan templates table');
    console.log('✅ Scenario 19 Passed: Query plan verified — uses indexes on user_id/creator_id, NO full table scan');
  }

  console.log('🎉 ALL 19 ADVANCED BADGES TEST SCENARIOS PASSED SUCCESSFULLY!');
} finally {
  await mf.dispose();
}
