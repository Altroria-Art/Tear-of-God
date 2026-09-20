import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as notifications } from '../../functions/api/notifications.js';
import { onRequest as middleware } from '../../functions/api/_middleware.js';
import { onRequestGet as hashtags } from '../../functions/api/hashtags.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("test"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(/\r?\n/).filter(l => !l.trimStart().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
  await db.batch(statements.map(s => db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id, username, email) VALUES ('u', 'user', 'u@test.invalid')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO notifications(id, user_id, type, is_read, created_at)
    SELECT printf('n%04d', n), 'u', 'community_average', n%2, datetime('2026-01-01', '+' || (n/3) || ' minutes') FROM seq`).run();
  let measured;
  const measuredDb = { prepare(sql) {
    const stmt = db.prepare(sql);
    return { bind(...args) {
      const bound = stmt.bind(...args);
      return { first: () => bound.first(), run: () => bound.run(), all: async () => {
        const result = await bound.all();
        if (sql.includes('WITH recent')) measured = result;
        return result;
      } };
    } };
  } };
  const originalSql = `SELECT n.*, actor.username AS actor_username, actor.avatar_url AS actor_avatar_url,
    target.title AS ranking_title, source.title AS source_ranking_title, topic_template.title AS template_title
    FROM notifications n LEFT JOIN profiles actor ON actor.id=n.actor_id
    LEFT JOIN rankings target ON target.id=n.ranking_id LEFT JOIN rankings source ON source.id=n.source_ranking_id
    LEFT JOIN templates topic_template ON topic_template.id=n.template_id
    WHERE n.user_id=? ORDER BY n.created_at DESC, n.id DESC LIMIT ?`;
  for (const limit of [1, 20, 50]) {
    const before = await db.prepare(originalSql).bind('u', limit).all();
    const response = await notifications({ request: new Request(`https://test/api/notifications?limit=${limit}`), env: { tear_of_god_db: measuredDb }, data: { user: { id: 'u' } } });
    const body = await response.json();
    assert.deepEqual(body.data, before.results);
    assert.equal(body.unreadCount, 1000);
    assert.ok(measured.meta.rows_read < before.meta.rows_read / 5);
    console.log(`Notification limit ${limit}: rows_read ${before.meta.rows_read} -> ${measured.meta.rows_read}`);
  }
  const read = () => notifications({ request: new Request('https://test/api/notifications', { method: 'POST', body: JSON.stringify({ action: 'read', id: 'n0001' }) }), env: { tear_of_god_db: db }, data: { user: { id: 'u' } } });
  assert.equal((await read()).status, 200);
  assert.equal((await read()).status, 200);

  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO analytics_events(id,event_name,session_id,created_at)
    SELECT 'e'||n,'feed_view','s', CASE WHEN n<1990 THEN '2025-01-01 00:00:00' ELSE '2026-09-20 17:00:00' END FROM seq`).run();
  const oldDaily = await db.prepare("SELECT count(*) AS n FROM analytics_events WHERE date(created_at, '+7 hours')='2026-09-21'").all();
  const newDaily = await db.prepare("SELECT count(*) AS n FROM analytics_events WHERE created_at >= datetime('2026-09-21', '-7 hours') AND created_at < datetime('2026-09-21', '+1 day', '-7 hours')").all();
  assert.deepEqual(newDaily.results, oldDaily.results);
  assert.ok(newDaily.meta.rows_read < oldDaily.meta.rows_read / 10);
  console.log(`Analytics day: rows_read ${oldDaily.meta.rows_read} -> ${newDaily.meta.rows_read}`);
  const migration = await readFile(new URL('../../migrations-active/0011_quota_indexes.sql', import.meta.url), 'utf8');
  await db.prepare(migration).run(); // Idempotent on a fresh schema.

  const entries = new Map();
  globalThis.caches = { default: {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { entries.set(key.url, response.clone()); },
  } };
  let queries = 0;
  const catalogDb = { prepare(sql) { queries++; return db.prepare(sql); } };
  const call = (path, database = catalogDb) => {
    const context = { request: new Request(`https://test${path}`, { headers: { Cookie: `tog_session=${'a'.repeat(64)}` } }), env: { tear_of_god_db: database }, data: {} };
    context.next = () => hashtags(context);
    return middleware(context);
  };
  const first = await call('/api/hashtags?q=absent');
  assert.equal(queries, 1, 'No session read or redundant empty-page count');
  assert.equal((await first.json()).total, 0);
  const cached = await call('/api/categories?q=absent');
  assert.equal(queries, 1, 'Alias and signed-in caller reuse the public cache');
  assert.equal((await cached.json()).total, 0);
  assert.match(cached.headers.get('Cache-Control'), /^public, max-age=/);
  assert.equal(cached.headers.has('X-Catalog-Expires'), false);
  for (const entry of entries.values()) entry.headers.set('X-Catalog-Expires', '1');
  await call('/api/hashtags?q=absent');
  assert.equal(queries, 2, 'Expired entries requery');
  globalThis.caches.default.match = async () => { throw new Error('cache down'); };
  globalThis.caches.default.put = async () => { throw new Error('cache down'); };
  assert.equal((await call('/api/hashtags?q=absent')).status, 200);
  assert.equal(queries, 3, 'Cache failures fall back to D1');
  console.log('Public cache, expiry, alias, session bypass and failure fallback passed');
} finally {
  delete globalThis.caches;
  await mf.dispose();
}
