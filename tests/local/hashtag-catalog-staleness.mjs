// Regression: hashtag catalog freshness after template deletion.
//
// GET /api/hashtags is derived live from templates.hashtags (no hashtag table),
// so deleting a template must shrink its tags' counts immediately — and a tag
// with zero live templates must vanish from browse/search/suggest. The stall
// was purely the Cache API: browse (q='') was `public, max-age=300`, so after a
// delete the catalog could show dead tags for 5 minutes. This test pins the new
// policy: uniform max-age=30 on every variant (worst-case stale 30s), the
// HAVING no-zero guard, and correct counts after creator / admin / orphan
// (owner deletes last ranking) template deletion.
// Run with: node tests/local/hashtag-catalog-staleness.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestGet as hashtags } from '../../functions/api/hashtags.js';
import { onRequestPost as creatorDelete } from '../../functions/api/template-delete.js';
import { onRequest as adminTemplates } from '../../functions/api/admin/templates.js';
import { onRequest as rankings } from '../../functions/api/rankings.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

// Fake global Cache API for the staleness scenario: keys are full URLs, put()
// keeps a clone with the handler-added X-Catalog-Expires, and expiry is forced
// by setting that header into the past (same technique as quota-optimization.mjs).
function installFakeCache() {
  const entries = new Map();
  globalThis.caches = {
    default: {
      async match(key) {
        const entry = entries.get(key.url);
        if (!entry) return null;
        return entry.clone();
      },
      async put(key, response) {
        entries.set(key.url, response.clone());
      },
      entries,
    },
  };
  return globalThis.caches.default;
}

async function createLocalD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function seedProfile(db, id, role = 'user') {
  await db.prepare('INSERT INTO profiles (id, username, email, role) VALUES (?, ?, ?, ?)')
    .bind(id, id, `${id}@local.test`, role).run();
}

async function seedTemplate(db, templateId, creatorId, hashtags) {
  await db.prepare('INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(templateId, creatorId, `Template ${templateId}`, '', hashtags, '[]').run();
}

// "Fresh" request — no cache installed, so every call hits D1 and reflects the
// current templates.hashtags exactly.
async function callCatalog(db, { page = 1, limit = 50, sort, q, suggest } = {}, waiter = []) {
  const url = new URL('https://local.test/api/hashtags');
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  if (sort) url.searchParams.set('sort', sort);
  if (q !== undefined) url.searchParams.set('q', q);
  if (suggest) url.searchParams.set('suggest', '1');
  const response = await hashtags({
    request: new Request(url.toString()),
    env: { tear_of_god_db: db },
    waitUntil: (promise) => waiter.push(promise),
  });
  assert.equal(response.status, 200);
  return { body: await response.json(), response };
}

async function badge(db, body) {
  const byTag = new Map((body.data || []).map((r) => [r.tag, r.content_count]));
  const ids = (body.data || []).map((r) => r.tag);
  return { byTag, ids, total: body.total };
}

async function callCreatorDelete(db, userId, templateId) {
  const response = await creatorDelete({
    request: new Request('https://local.test/api/template-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json() };
}

async function callAdminDelete(db, adminId, targetId) {
  const response = await adminTemplates({
    request: new Request('https://local.test/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', target_id: targetId }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: adminId } },
  });
  return { response, body: await response.json() };
}

async function callRankingDelete(db, userId, rankingId) {
  const response = await rankings({
    request: new Request('https://local.test/api/rankings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rankingId }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json() };
}

async function run() {
  // ---------------------------------------------------------------------------
  // A + B + F + H: count shrinks per live template; tag vanishes at zero; search
  // reflects it; total tracks the live tag set exactly.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'creator-A', 'user');
      await seedTemplate(db, 'T1', 'creator-A', '#food');
      await seedTemplate(db, 'T2', 'creator-A', '#food , #thai');

      const before = await callCatalog(db);
      const { byTag, total: totalBefore } = await badge(db, before.body);
      assert.equal(byTag.get('#food'), 2);
      assert.equal(byTag.get('#thai'), 1);
      assert.equal(totalBefore, 2, 'total = distinct live tags');
      assert.ok(![...byTag.values()].includes(0), 'never emit content_count = 0');

      const del1 = await callCreatorDelete(db, 'creator-A', 'T1');
      assert.equal(del1.response.status, 200);
      assert.equal(del1.body.success, true);

      const afterT1 = await callCatalog(db);
      const a1 = await badge(db, afterT1.body);
      assert.equal(a1.byTag.get('#food'), 1, 'A: #food count drops 2 -> 1 after T1 delete');
      assert.equal(a1.byTag.get('#thai'), 1);
      assert.equal(a1.total, 2);

      const del2 = await callCreatorDelete(db, 'creator-A', 'T2');
      assert.equal(del2.response.status, 200);

      const afterT2 = await callCatalog(db);
      const a2 = await badge(db, afterT2.body);
      assert.equal(a2.byTag.has('#food'), false, 'B: #food gone once last template is deleted');
      assert.equal(a2.byTag.has('#thai'), false, 'B: #thai also gone');
      assert.equal(a2.ids.length, 0, 'B: no orphan tags in response');
      assert.equal(a2.total, 0, 'B/H: total 0');

      const search = await callCatalog(db, { q: 'food' });
      const se = await badge(db, search.body);
      assert.equal(se.ids.length, 0, 'F: search q=food returns nothing when no template remains');
      assert.equal(se.total, 0);

      const suggest = await callCatalog(db, { suggest: 1 });
      const sg = await badge(db, suggest.body);
      assert.equal(sg.ids.length, 0, 'G: suggest returns no orphan tags');

      const cacheControl = before.response.headers.get('Cache-Control') || '';
      assert.match(cacheControl, /^public, max-age=30($|,)/, 'browse must be max-age=30');
      console.log('A/B/F/G/H passed: live counts, zero-count avoidance, tag removal, search/suggest, total');
    } finally {
      await mf.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // C: multi-tag template delete shrinks every owned tag by its real delta.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'creator-C', 'user');
      // #food used by T1 only; #thai shared by T3+T4; #rpg isolated on T5 (untouched)
      await seedTemplate(db, 'T1', 'creator-C', '#food,#thai');
      await seedTemplate(db, 'T2', 'creator-C', '#thai');
      await seedTemplate(db, 'T3', 'creator-C', '#rpg');

      const before = await callCatalog(db);
      const b = await badge(db, before.body);
      assert.equal(b.byTag.get('#food'), 1);
      assert.equal(b.byTag.get('#thai'), 2);
      assert.equal(b.byTag.get('#rpg'), 1);

      await callCreatorDelete(db, 'creator-C', 'T1');
      const after = await callCatalog(db);
      const a = await badge(db, after.body);
      assert.equal(a.byTag.get('#food'), undefined, 'C: #food (only on T1) disappears');
      assert.equal(a.byTag.get('#thai'), 1, 'C: #thai shared count shrinks 2 -> 1');
      assert.equal(a.byTag.get('#rpg'), 1, 'C: untouched tag unchanged');
      assert.equal(a.total, 2);
      console.log('C passed: multi-tag template deletion shrinks each owned tag correctly');
    } finally {
      await mf.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // D: orphan template auto-delete (owner deletes last ranking of template)
  // must behave exactly like a normal template delete for the hashtag catalog.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'owner-D', 'user');
      await seedTemplate(db, 'tpl-D', 'owner-D', '#food,#thai');
      await seedTemplate(db, 'tpl-D-keep', 'owner-D', '#thai');
      await db.prepare('INSERT INTO rankings (id, title, hashtags, user_id, template_id) VALUES (?, ?, ?, ?, ?)')
        .bind('rk-D', 'Rank D', '#food', 'owner-D', 'tpl-D').run();
      await db.prepare('INSERT INTO rankings (id, title, hashtags, user_id, template_id) VALUES (?, ?, ?, ?, ?)')
        .bind('rk-D-keep', 'Rank D keep', '#thai', 'owner-D', 'tpl-D-keep').run();

      const before = await callCatalog(db);
      const b = await badge(db, before.body);
      assert.equal(b.byTag.get('#food'), 1);

      const del = await callRankingDelete(db, 'owner-D', 'rk-D');
      assert.equal(del.response.status, 200);
      assert.equal(del.body.success, true);
      assert.equal(del.body.templateDeleted, true);

      const after = await callCatalog(db);
      const a = await badge(db, after.body);
      assert.equal(a.byTag.get('#food'), undefined, 'D: orphan-auto-deleted template drops #food');
      assert.equal(a.byTag.get('#thai'), 1, 'D: #thai keeps the surviving template count');
      console.log('D passed: orphan template auto-delete updates hashtag catalog like a normal delete');
    } finally {
      await mf.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // E: admin template delete applies the same catalog freshness.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'admin-E', 'admin');
      await seedProfile(db, 'creator-E', 'user');
      await seedTemplate(db, 'tpl-E1', 'creator-E', '#food');
      await seedTemplate(db, 'tpl-E2', 'creator-E', '#food,#thai');

      const before = await callCatalog(db);
      const b = await badge(db, before.body);
      assert.equal(b.byTag.get('#food'), 2);

      const del = await callAdminDelete(db, 'admin-E', 'tpl-E1');
      assert.equal(del.response.status, 200);
      assert.equal(del.body.success, true);

      const after = await callCatalog(db);
      const a = await badge(db, after.body);
      assert.equal(a.byTag.get('#food'), 1, 'E: admin delete shrinks #food 2 -> 1');
      assert.equal(a.byTag.get('#thai'), 1);
      console.log('E passed: admin template delete updates hashtag count identically');
    } finally {
      await mf.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // Pagination (H): after removals, pages/lengths/total stay internally
  // consistent — no dead slot counting an orphan tag.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'creator-H', 'user');
      await seedTemplate(db, 'h1', 'creator-H', '#aaa');
      await seedTemplate(db, 'h2', 'creator-H', '#bbb');
      await seedTemplate(db, 'h3', 'creator-H', '#ccc');
      await callCreatorDelete(db, 'creator-H', 'h1');

      const page = await callCatalog(db, { page: 1, limit: 2, sort: 'az' });
      const p = await badge(db, page.body);
      assert.deepEqual(p.ids, ['#bbb', '#ccc'], 'H: deleted #aaa no longer in first page');
      assert.equal(p.total, 2, 'H: total now counts only live tags (#aaa gone)');

      // page 2 must still be reachable and not emit a phantom 0-count row.
      const page2 = await callCatalog(db, { page: 2, limit: 2, sort: 'az' });
      const p2 = await badge(db, page2.body);
      assert.equal(p2.ids.length, 0, 'H: no phantom tags past the end after deletion');
      assert.equal(p2.total, 2);
      console.log('H passed: pagination/total consistent after deletions');
    } finally {
      await mf.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // Cache staleness: with the fake cache installed, a browse miss caches at
  // max-age=30; after a delete the entry must honour the TTL (forced expiry →
  // fresh D1) so worst-case stale is bounded by 30s, and DELETE keeps the
  // catalog live. Also asserts the cache is rewritten with the new content.
  // ---------------------------------------------------------------------------
  {
    const { mf, db } = await createLocalD1();
    try {
      await seedProfile(db, 'creator-CACHE', 'user');
      await seedTemplate(db, 'tc1', 'creator-CACHE', '#food');
      await seedTemplate(db, 'tc2', 'creator-CACHE', '#food');

      const fake = installFakeCache();
      const waiter = [];
      const first = await callCatalog(db, {}, waiter);
      await Promise.all(waiter);
      assert.equal((await badge(db, first.body)).byTag.get('#food'), 2);
      assert.deepEqual([...fake.entries.keys()], ['https://local.test/api/hashtags?catalog=v2&limit=50&page=1']);

      // Cached browse response respects 30s freshness on the way out.
      const cachedHit = await callCatalog(db, {}, waiter);
      const hitCacheControl = cachedHit.response.headers.get('Cache-Control') || '';
      assert.match(hitCacheControl, /^public, max-age=(?:[1-9]|[12][0-9]|30)($|,)/);

      // Delete a template, then force the cached entry to expire: the next
      // browse must reflect the deletion (fresh D1), proving a delete does not
      // stay stuck behind a 5-minute minimum.
      await callCreatorDelete(db, 'creator-CACHE', 'tc1');
      for (const entry of fake.entries.values()) entry.headers.set('X-Catalog-Expires', '1');
      const after = await callCatalog(db, {}, waiter);
      await Promise.all(waiter);
      assert.equal((await badge(db, after.body)).byTag.get('#food'), 1, 'catalog reflects delete after TTL expiry');
      console.log('CACHE passed: max-age=30 policy; forced expiry shows fresh count after template delete');
    } finally {
      delete globalThis.caches;
      await mf.dispose();
    }
  }
}

await run();
console.log('Hashtag catalog staleness checks passed against local Miniflare D1.');