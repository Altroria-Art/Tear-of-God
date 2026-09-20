import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import {
  onRequestGet as spotlights,
  getBangkokPeriods,
  getSeasonalProfile,
  chooseTemplate,
  serializeTemplate,
  serializeRanking,
} from '../../functions/api/spotlights.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Fixture: expectations stay structural (computed from the table below + the
// current seasonal profile), never hardcoded to a calendar month.
// ---------------------------------------------------------------------------
const TEMPLATES = [
  // id, creator, title, hashtags, created_at, uses, views, items, seasonalAlways, official
  { id: 'tpl_hot', creator: 'u1', title: 'Hot Games', tags: '#gaming', created: '2026-01-10 10:00:00', uses: 0, views: 3, items: 3 },
  { id: 'tpl_viewed', creator: 'u1', title: 'Viewed Food', tags: '#food', created: '2026-02-10 10:00:00', uses: 0, views: 10, items: 2 },
  { id: 'tpl_season', creator: 'u2', title: 'Love Songkran Rain Halloween Year School Party Summer Loy Krathong', tags: '#love,#songkran,#rain,#halloween,#year,#school,#newyear,#valentine,#loykrathong,#horror', created: '2026-01-15 10:00:00', uses: 0, views: 1, items: 2 },
  { id: 'tpl_official', creator: 'admin1', title: 'Classic Board Games', tags: '#classic', created: '2026-03-10 10:00:00', uses: 0, views: 2, items: 2 },
  { id: 'tpl_both', creator: 'admin1', title: 'Rainy Love Loy Krathong Festival Year School', tags: '#rain,#love,#newyear,#songkran,#halloween,#valentine,#loykrathong,#horror,#summer', created: '2026-04-10 10:00:00', uses: 0, views: 1, items: 6 },
  { id: 'tpl_empty', creator: 'u1', title: 'Empty Desserts', tags: '#empty', created: '2026-05-10 10:00:00', uses: 0, views: 0, items: 2 },
  { id: 'tpl_big', creator: 'u2', title: 'Big Anime', tags: '#anime', created: '2026-06-10 10:00:00', uses: 0, views: 4, items: 10 },
  { id: 'tpl_tie1', creator: 'u2', title: 'Rain Tie One Year Loy Krathong', tags: '#rain,#love,#newyear,#songkran,#halloween,#valentine,#loykrathong,#horror,#summer,#school', created: '2026-07-10 12:00:00', uses: 0, views: 1, items: 2 },
  { id: 'tpl_tie2', creator: 'u2', title: 'Rain Tie Two Year Loy Krathong', tags: '#rain,#love,#newyear,#songkran,#halloween,#valentine,#loykrathong,#horror,#summer,#school', created: '2026-07-10 12:00:00', uses: 0, views: 1, items: 2 },
  { id: 'tpl_noitems', creator: 'u1', title: 'No Items Here', tags: '#none', created: '2026-08-10 10:00:00', uses: 0, views: 0, items: 0 },
  { id: 'tpl_filler1', creator: 'u1', title: 'Filler Sports', tags: '#sports', created: '2026-09-10 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_filler2', creator: 'u2', title: 'Filler Music', tags: '#music', created: '2026-10-10 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_newyear', creator: 'u2', title: 'Happy New Year', tags: '#newyear', created: '2026-11-10 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_valentine', creator: 'u2', title: 'Be My Valentine', tags: '#valentine', created: '2026-12-10 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_summer', creator: 'u2', title: 'Summer Vibes', tags: '#summer', created: '2026-01-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_songkran', creator: 'u2', title: 'Songkran Splash', tags: '#songkran', created: '2026-02-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_school', creator: 'u2', title: 'Back To School', tags: '#school', created: '2026-03-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_rainyseason', creator: 'u2', title: 'Rainy Season Blues', tags: '#rain', created: '2026-04-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_halloween', creator: 'u2', title: 'Halloween Horror Night', tags: '#halloween,#horror', created: '2026-05-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_loy', creator: 'u2', title: 'Loy Krathong Night', tags: '#loykrathong', created: '2026-06-11 10:00:00', uses: 0, views: 0, items: 1 },
  { id: 'tpl_yearend', creator: 'u2', title: 'Best of the Year', tags: '#year', created: '2026-07-11 10:00:00', uses: 0, views: 0, items: 1 },
];

// Rankings: [id, templateId|null, user, likes, dislikes, comments, createdOffset, title]
// createdOffset is a SQLite datetime modifier relative to now (hour/day scale
// keeps hot24/debate windows deterministic at any run time).
const RANKINGS = [
  ['r_hot24', 'tpl_hot', 'u1', 50, 2, 10, '-2 hours', 'Hot right now'],
  ['r_deb1', 'tpl_hot', 'u1', 5, 1, 30, '-3 hours', 'Debate me'],
  ['r_split1', 'tpl_hot', 'u2', 10, 9, 2, '-4 hours', 'Split one'],
  ['r_split2', 'tpl_hot', 'u2', 8, 8, 1, '-5 hours', 'Split two'],
  ['r_v1', 'tpl_viewed', 'u1', 3, 0, 0, '-6 hours', 'Viewed post'],
  ['r_s1', 'tpl_season', 'u2', 2, 0, 0, '-7 hours', 'Season post'],
  ['r_onesided', 'tpl_hot', 'u1', 20, 1, 0, '-8 hours', 'Landslide'],
  ['r_zero', 'tpl_hot', 'u2', 0, 0, 0, '-9 hours', 'Unvoted'],
  ['r_tieA', 'tpl_hot', 'u1', 6, 6, 0, '-11 hours', 'Tie A'],
  ['r_tieB', 'tpl_big', 'u2', 6, 6, 0, '-9 hours', 'Tie B'],
  ['r_oldhot', 'tpl_big', 'u1', 80, 5, 40, '-100 days', 'Old glory'],
  ['r_b1', 'tpl_big', 'u2', 4, 0, 1, '-11 hours', 'Big one'],
  ['r_b2', 'tpl_both', 'u1', 7, 0, 0, '-12 hours', 'Both one'],
  ['r_b3', 'tpl_both', 'u2', 6, 0, 0, '-13 hours', 'Both two'],
  ['r_b4', 'tpl_both', 'u1', 5, 0, 0, '-14 hours', 'Both three'],
  ['r_b5', 'tpl_both', 'u2', 4, 0, 0, '-15 hours', 'Both four'],
  ['r_o1', 'tpl_official', 'u1', 9, 0, 0, '-16 hours', 'Official one'],
  ['r_o2', 'tpl_official', 'u2', 8, 0, 0, '-17 hours', 'Official two'],
  ['r_o3', 'tpl_official', 'u1', 7, 0, 0, '-18 hours', 'Official three'],
  ['r_t1', 'tpl_tie1', 'u1', 2, 0, 0, '-19 hours', 'Tie1 one'],
  ['r_t2', 'tpl_tie1', 'u2', 1, 0, 0, '-20 hours', 'Tie1 two'],
  ['r_t3', 'tpl_tie2', 'u1', 2, 0, 0, '-21 hours', 'Tie2 one'],
  ['r_t4', 'tpl_tie2', 'u2', 1, 0, 0, '-22 hours', 'Tie2 two'],
  ['r_s2', 'tpl_season', 'u1', 1, 0, 0, '-23 hours', 'Season two'],
  ['r_big2', 'tpl_big', 'u1', 3, 0, 0, '-24 hours', 'Big two'],
  ['r_big3', 'tpl_big', 'u2', 2, 0, 0, '-25 hours', 'Big three'],
  ['r_big4', 'tpl_big', 'u1', 1, 0, 0, '-26 hours', 'Big four'],
  ['r_f1', 'tpl_filler1', 'u1', 0, 0, 0, '-27 hours', 'Filler one'],
  ['r_f2', 'tpl_filler2', 'u2', 0, 0, 0, '-28 hours', 'Filler two'],
];

async function createSeededD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, username, email, role) VALUES (?, ?, ?, ?)`).bind('admin1', 'Admin', 'admin@local.test', 'admin'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('u1', 'U1', 'u1@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('u2', 'U2', 'u2@local.test'),
  ]);
  const tplInserts = TEMPLATES.map((t) => db.prepare(
    `INSERT INTO templates (id, creator_id, title, hashtags, tiers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(t.id, t.creator, t.title, t.tags, JSON.stringify([{ label: 'S', color: '#fff' }]), t.created));
  await db.batch(tplInserts);
  const itemInserts = [];
  for (const t of TEMPLATES) {
    for (let p = 0; p < t.items; p += 1) {
      const itemId = `item-${t.id}-${p}`;
      itemInserts.push(db.prepare(`INSERT INTO items (id, name, image_url) VALUES (?, ?, ?)`)
        .bind(itemId, `Item ${t.id} ${p}`, p === 0 ? `https://img.local.test/${t.id}.png` : null));
      itemInserts.push(db.prepare(`INSERT INTO template_items (id, template_id, item_id, position) VALUES (?, ?, ?, ?)`)
        .bind(`ti-${t.id}-${p}`, t.id, itemId, p));
    }
  }
  await db.batch(itemInserts);
  const rankInserts = RANKINGS.map(([id, tpl, user, likes, dislikes, comments, offset, title]) => db.prepare(
    `INSERT INTO rankings (id, title, user_id, template_id, hashtags, likes_count, dislikes_count, comments_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
  ).bind(id, title, user, tpl, 'general', likes, dislikes, comments, offset));
  await db.batch(rankInserts);
  // Views: tpl_viewed x10 (distinct viewer keys, no FK on template_views).
  const viewInserts = [];
  for (let i = 0; i < 10; i += 1) {
    viewInserts.push(db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`).bind('tpl_viewed', `viewer${i}`));
  }
  viewInserts.push(db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`).bind('tpl_hot', 'viewer0'));
  viewInserts.push(db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`).bind('tpl_hot', 'viewer1'));
  viewInserts.push(db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`).bind('tpl_hot', 'viewer2'));
  viewInserts.push(db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`).bind('tpl_both', 'viewer0'));
  await db.batch(viewInserts);
  return { mf, db };
}

// FROZEN BASELINE: the exact pre-Batch-6 template queries (copied verbatim
// from git HEAD before the consolidation) plus the unchanged selection logic
// via the exported pure helpers. Any intentional future change to these must
// update this block explicitly — that is the point.
const RANKING_SELECT_FROZEN = `
  SELECT r.id, r.title, r.hashtags, r.template_id, r.created_at,
         r.likes_count, r.dislikes_count, r.comments_count,
         p.id AS user_id, p.username, p.avatar_url,
         t.title AS template_title
  FROM rankings r
  LEFT JOIN profiles p ON p.id = r.user_id
  LEFT JOIN templates t ON t.id = r.template_id
`;
  // NOTE: the frozen official query below re-declares FROM/JOIN explicitly —
// the shared TEMPLATE_SELECT_FROZEN already contains its own FROM clause,
// so it cannot be reused verbatim here.
const TEMPLATE_COLS_FROZEN = `
  t.*, p.username, p.avatar_url,
    (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
    (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
    (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
`;
const TEMPLATE_SELECT_FROZEN = `
  SELECT ${TEMPLATE_COLS_FROZEN}
  FROM templates t
  LEFT JOIN profiles p ON p.id = t.creator_id
`;

async function referenceSpotlights(db) {
  const periods = getBangkokPeriods();
  const seasonal = getSeasonalProfile();
  const conds = seasonal.keywords.map(() => `(lower(t.title) LIKE ? OR instr(lower(replace(COALESCE(t.hashtags, ''), '#', '')), ?) > 0)`).join(' OR ');
  const params = seasonal.keywords.flatMap((k) => [`%${k.toLowerCase()}%`, k.toLowerCase()]);
  const [cand, hot24, recent, debate, split, seas, off] = await Promise.all([
    db.prepare(`${TEMPLATE_SELECT_FROZEN}
      WHERE EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id)
      ORDER BY live_uses DESC, live_views DESC, t.created_at DESC, t.id DESC LIMIT 40`).all(),
    db.prepare(`${RANKING_SELECT_FROZEN}
      WHERE r.created_at >= datetime('now', '-1 day')
      ORDER BY (COALESCE(r.likes_count, 0) * 3 + COALESCE(r.comments_count, 0) * 2 - COALESCE(r.dislikes_count, 0)) DESC,
               r.created_at DESC, r.id DESC LIMIT 6`).all(),
    db.prepare(`${RANKING_SELECT_FROZEN} ORDER BY r.created_at DESC, r.id DESC LIMIT 6`).all(),
    db.prepare(`${RANKING_SELECT_FROZEN}
      WHERE r.created_at >= datetime('now', '-30 days') AND COALESCE(r.comments_count, 0) > 0
      ORDER BY COALESCE(r.comments_count, 0) DESC, (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) DESC,
               r.created_at DESC, r.id DESC LIMIT 6`).all(),
    db.prepare(`${RANKING_SELECT_FROZEN}
      WHERE (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) >= 3
        AND ABS(COALESCE(r.likes_count, 0) - COALESCE(r.dislikes_count, 0)) <= MAX(1, (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) * 0.35)
      ORDER BY (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) DESC, r.created_at DESC, r.id DESC LIMIT 6`).all(),
    db.prepare(`${TEMPLATE_SELECT_FROZEN}
      WHERE EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id) AND (${conds})
      ORDER BY live_uses DESC, t.created_at DESC, t.id DESC LIMIT 4`).bind(...params).all(),
    db.prepare(`SELECT ${TEMPLATE_COLS_FROZEN}
      FROM templates t JOIN profiles p ON p.id = t.creator_id
      WHERE p.role = 'admin' AND EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id)
      ORDER BY t.created_at DESC, t.id DESC LIMIT 4`).all(),
  ]);
  const candidates = cand.results || [];
  const daily = chooseTemplate(candidates, `daily:${periods.daily.key}`);
  const weekly = chooseTemplate(candidates, `weekly:${periods.weekly.key}`, daily?.id);
  const seasonalTemplates = seas.results || [];
  const officialTemplates = off.results || [];
  const all = [daily, weekly, ...seasonalTemplates, ...officialTemplates].filter(Boolean);
  const ids = [...new Set(all.map((t) => t?.id).filter(Boolean))];
  const itemsMap = {};
  if (ids.length > 0) {
    const { results } = await db.prepare(`
      SELECT ti.template_id, ti.item_id, ti.position, i.name AS item_name, i.image_url AS item_image
      FROM template_items ti LEFT JOIN items i ON (ti.item_id = i.id OR ti.item_id = i.name)
      WHERE ti.template_id IN (${ids.map(() => '?').join(',')}) AND ti.position < 4
      ORDER BY ti.template_id, ti.position ASC`).bind(...ids).all();
    for (const item of results || []) {
      (itemsMap[item.template_id] ||= []).push({
        item_id: item.item_id, position: item.position,
        item: { id: item.item_id, name: item.item_name || item.item_id, image_url: item.item_image || null },
      });
    }
  }
  return {
    success: true,
    data: {
      timezone: 'Asia/Bangkok',
      daily: { period_key: periods.daily.key, ends_at: periods.daily.endsAt, template: serializeTemplate(daily, itemsMap) },
      weekly: { period_key: periods.weekly.key, ends_at: periods.weekly.endsAt, template: serializeTemplate(weekly, itemsMap) },
      freshness: {
        hot24: (hot24.results || []).map(serializeRanking),
        recent: (recent.results || []).map(serializeRanking),
        debate: (debate.results || []).map(serializeRanking),
        split: (split.results || []).map(serializeRanking),
      },
      seasonal: { key: seasonal.key, month: seasonal.month, templates: seasonalTemplates.map((t) => serializeTemplate(t, itemsMap)) },
      official: officialTemplates.map((t) => serializeTemplate(t, itemsMap)),
    },
  };
}

function fakeCache({ failMatch = false, failPut = false } = {}) {
  const store = new Map();
  return {
    store,
    matchCalls: 0,
    putCalls: 0,
    async match(request) {
      this.matchCalls += 1;
      if (failMatch) throw new Error('simulated cache outage');
      return store.get(request.url) || null;
    },
    async put(request, response) {
      this.putCalls += 1;
      if (failPut) throw new Error('simulated put failure');
      store.set(request.url, response);
    },
  };
}

function countingDb(db, counter) {
  return {
    prepare(sql) {
      counter.statements += 1;
      if (/FROM templates t/.test(sql)) counter.templateScans += 1;
      if (/SELECT r\.id, r\.title/.test(sql)) counter.rankingQueries += 1;
      return db.prepare(sql);
    },
    batch(statements) {
      return db.batch(statements);
    },
  };
}

async function callSpotlights(db, { userId = null } = {}) {
  const response = await spotlights({
    request: new Request('https://local.test/api/spotlights', { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  return { response, body: await response.json() };
}

const { mf, db: rawDb } = await createSeededD1();
const realCaches = globalThis.caches;
try {
  const counter = { statements: 0, templateScans: 0, rankingQueries: 0 };
  const db = countingDb(rawDb, counter);
  globalThis.caches = { default: fakeCache() };

  // CASE 1 — cold miss: full correct response (deep-compared to frozen baseline below).
  const cold = await callSpotlights(db);
  assert.equal(cold.response.status, 200);
  assert.equal(cold.body.success, true);
  assert.equal(counter.statements, 6, 'cold miss: 1 base + 4 ranking + 1 items');
  console.log('CASE 1 passed: cold miss 200 with full response');

  // CASE 20 — full response deep-equal vs frozen baseline (same fixture, back-to-back run).
  const ref = await referenceSpotlights(rawDb);
  assert.deepEqual(cold.body, ref, 'optimized output must equal frozen baseline output');
  console.log('CASE 20 passed: full response deep-equal to frozen baseline');

  // CASE 3/4 — daily/weekly rotation selected from candidates via period keys.
  const periods = getBangkokPeriods();
  assert.equal(cold.body.data.daily.period_key, periods.daily.key);
  assert.equal(cold.body.data.weekly.period_key, periods.weekly.key);
  assert.ok(cold.body.data.daily.template && cold.body.data.weekly.template);
  assert.notEqual(cold.body.data.daily.template.id, cold.body.data.weekly.template.id);
  console.log('CASE 3/4 passed: daily/weekly rotation present and distinct');

  // CASE 7 — every seasonal template matches a current keyword; ordering by uses.
  {
    const profile = getSeasonalProfile();
    const kws = profile.keywords.map((k) => k.toLowerCase());
    const matches = (t) => {
      const title = String(t.title || '').toLowerCase();
      const tags = String(t.hashtags || '').replaceAll('#', '').toLowerCase();
      return kws.some((k) => title.includes(k) || tags.includes(k));
    };
    const seasonal = cold.body.data.seasonal.templates;
    assert.ok(seasonal.length > 0, 'fixture must yield seasonal templates in the current month');
    assert.ok(seasonal.every(matches), 'all seasonal templates match a current keyword');
    const uses = seasonal.map((t) => t.use_count);
    assert.deepEqual([...uses].sort((a, b) => b - a), uses, 'seasonal ordered by uses DESC');
    // Month-independent: the always-keyworded quartet outranks every
    // month-specific template (uses 4/2/2/2 vs 0), so this exact array holds
    // in all 12 months (ties broken by id DESC).
    assert.deepEqual(seasonal.map((t) => t.id), ['tpl_both', 'tpl_tie2', 'tpl_tie1', 'tpl_season']);
    assert.equal(cold.body.data.seasonal.key, profile.key);
    console.log(`CASE 7 passed: seasonal selection (${profile.key}, n=${seasonal.length})`);
  }

  // CASE 8 — official: admin-created only, newest first.
  {
    const official = cold.body.data.official;
    assert.deepEqual(official.map((t) => t.id), ['tpl_both', 'tpl_official']);
    assert.ok(official.every((t) => t.profile.id === 'admin1'));
    console.log('CASE 8 passed: official selection (admin only, newest first)');
  }

  // CASE 9 — seasonal+official template appears in both sections.
  {
    const inSeasonal = cold.body.data.seasonal.templates.some((t) => t.id === 'tpl_both');
    const inOfficial = cold.body.data.official.some((t) => t.id === 'tpl_both');
    assert.equal(inSeasonal, true);
    assert.equal(inOfficial, true);
    assert.ok(!cold.body.data.official.some((t) => t.id === 'tpl_season'), 'non-admin never official');
    console.log('CASE 9 passed: tpl_both in seasonal+official, tpl_season not official');
  }

  // CASE 10/11/12/13 — ranking sections: window membership + ordering + formula.
  {
    const { hot24, recent, debate, split } = cold.body.data.freshness;
    assert.equal(hot24[0].id, 'r_hot24');
    assert.ok(!hot24.some((r) => r.id === 'r_oldhot'), 'old hot ranking outside 24h window');
    assert.ok(!recent.some((r) => r.id === 'r_oldhot'), 'old ranking outside recent-6');
    assert.equal(recent.map((r) => r.id).join(','), 'r_hot24,r_deb1,r_split1,r_split2,r_v1,r_s1');
    assert.equal(debate[0].id, 'r_deb1');
    assert.deepEqual(split.map((r) => r.id), ['r_split1', 'r_split2', 'r_tieB', 'r_tieA']);
    assert.ok(!split.some((r) => ['r_onesided', 'r_zero'].includes(r.id)));
    const s1 = split.find((r) => r.id === 'r_split1');
    assert.deepEqual(s1.stats, { likes: 10, dislikes: 9, comments: 2 });
    assert.equal(s1.disagreement, 95);
    console.log('CASE 10/11/12/13 passed: ranking windows, ordering, split formula');
  }

  // CASE 14 — tie-breaks: equal uses+created seasonal pair ordered by id DESC
  // (exact indices inside the month-independent seasonal array).
  {
    const seasonalIds = cold.body.data.seasonal.templates.map((t) => t.id);
    assert.deepEqual(seasonalIds.indexOf('tpl_tie2'), 1);
    assert.deepEqual(seasonalIds.indexOf('tpl_tie1'), 2);
    console.log('CASE 14 passed: tie-break by id DESC');
  }

  // CASE 15 — item previews: only selected templates, position<4, ordered, with images.
  {
    const byId = {};
    const collect = (t) => { byId[t.id] = t.template_items; };
    [cold.body.data.daily.template, cold.body.data.weekly.template].forEach((t) => t && collect(t));
    cold.body.data.seasonal.templates.forEach(collect);
    cold.body.data.official.forEach(collect);
    assert.ok(byId.tpl_both.length === 4, 'multi-item template capped at 4 preview items');
    assert.deepEqual(byId.tpl_both.map((i) => i.position), [0, 1, 2, 3]);
    assert.equal(byId.tpl_both[0].item.image_url, 'https://img.local.test/tpl_both.png');
    assert.ok(!('tpl_noitems' in byId), 'unselected/empty templates load no items');
    console.log('CASE 15 passed: item previews capped, ordered, with images');
  }

  // CASE 2 — warm cache hit: zero D1.
  {
    const before = counter.statements;
    const warm = await callSpotlights(db);
    assert.equal(warm.response.status, 200);
    assert.deepEqual(warm.body, cold.body);
    assert.equal(counter.statements, before, 'cache hit must not touch D1');
    console.log('CASE 2 passed: cache hit, D1 statements = 0');
  }

  // CASE 5/6 — Bangkok clock boundaries on the pure helpers (fully deterministic).
  {
    // Bangkok midnight = 17:00Z. One second before/after must flip the daily key.
    const beforeMidnight = getBangkokPeriods(new Date('2026-09-18T16:59:59Z'));
    const afterMidnight = getBangkokPeriods(new Date('2026-09-18T17:00:01Z'));
    assert.equal(beforeMidnight.daily.key, '2026-09-18');
    assert.equal(afterMidnight.daily.key, '2026-09-19');
    // Weekly Monday boundary: Mon 2026-09-21 00:00 Bangkok = Sun 17:00Z.
    const sun = getBangkokPeriods(new Date('2026-09-20T16:59:59Z'));
    const mon = getBangkokPeriods(new Date('2026-09-20T17:00:01Z'));
    assert.equal(sun.weekly.key, '2026-09-14');
    assert.equal(mon.weekly.key, '2026-09-21');
    // Seasonal month mapping is Bangkok-based too.
    assert.equal(getSeasonalProfile(new Date('2026-04-15T00:00:00Z')).key, 'songkran');
    assert.equal(getSeasonalProfile(new Date('2026-04-14T16:00:00Z')).key, 'songkran');
    console.log('CASE 5/6 passed: Bangkok midnight + Monday + seasonal boundaries');
  }

  // CASE 17/18 — cache errors never fail the feed.
  {
    globalThis.caches = { default: fakeCache({ failMatch: true }) };
    const outage = await callSpotlights(db);
    assert.equal(outage.response.status, 200);
    assert.equal(outage.body.success, true);
    globalThis.caches = { default: fakeCache({ failPut: true }) };
    const putFail = await callSpotlights(db);
    assert.equal(putFail.response.status, 200);
    assert.equal(putFail.body.success, true);
    globalThis.caches = { default: fakeCache() };
    console.log('CASE 17/18 passed: cache match/put errors fall back cleanly');
  }

  // CASE 19 — logged-in request: same public body (session bypass untouched).
  {
    const authed = await callSpotlights(db, { userId: 'u1' });
    assert.equal(authed.response.status, 200);
    assert.deepEqual(authed.body, cold.body);
    console.log('CASE 19 passed: logged-in response identical (still public)');
  }

  // CASE 16 — empty DB: same shape, nulls and empty lists (no crash, no fallback weirdness).
  {
    const mf2 = new Miniflare(convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("empty"); } }',
      compatibilityDate: '2026-01-01',
      d1Databases: ['DB2'],
    }));
    try {
      const emptyDb = await mf2.getD1Database('DB2');
      await emptyDb.batch(schemaStatements.map((s) => emptyDb.prepare(s)));
      globalThis.caches = { default: fakeCache() };
      const { body } = await callSpotlights(emptyDb);
      assert.equal(body.success, true);
      assert.equal(body.data.daily.template, null);
      assert.equal(body.data.weekly.template, null);
      assert.deepEqual(body.data.seasonal.templates, []);
      assert.deepEqual(body.data.official, []);
      assert.deepEqual(body.data.freshness, { hot24: [], recent: [], debate: [], split: [] });
      console.log('CASE 16 passed: empty DB keeps response shape');
    } finally {
      await mf2.dispose();
    }
  }

  console.log('Spotlights optimization checks passed against local Miniflare D1.');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
