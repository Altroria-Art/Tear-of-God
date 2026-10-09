import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { onRequest } from '../../functions/api/notifications.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default {fetch(){return new Response("fixture")}}',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  for (const file of ['schema.sql', 'migrations-active/0015_exact_unread_counts.sql']) {
    const sql = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    await db.batch(sql.split(SQL_SCRIPT_SEPARATOR).map(s => db.prepare(s)));
  }
  await db.prepare("INSERT INTO profiles(id) VALUES ('a'),('b')").run();
  await db.batch(Array.from({ length: 520 }, (_, i) => db.prepare(
    "INSERT INTO notifications(id,user_id,type) VALUES (?,?,'follow')"
  ).bind('n' + i, i < 500 ? 'a' : 'b')));
  await db.prepare("INSERT INTO notifications(id,user_id,type,is_read,read_at) VALUES ('expired','a','follow',1,datetime('now','-48 hours'))").run();
  let statements = [];
  const measured = { prepare(sql) { statements.push(sql); return db.prepare(sql); } };
  const get = async (id, countOnly = true, counters = true) => {
    statements = [];
    return onRequest({ request: new Request('https://fixture/api/notifications' + (countOnly ? '?count_only=1' : '')),
      data: { user: id ? { id } : null },
      env: { tear_of_god_db: measured, NOTIFICATION_UNREAD_COUNTS: String(counters) } });
  };
  for (const [id, expected] of [['a', 500], ['b', 20]]) {
    const response = await get(id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await response.json(), { success: true, unreadCount: expected });
    assert.equal(statements.length, 1, 'badge performs one query, no list joins or DELETE');
    const result = await db.prepare(statements[0]).bind(id).all();
    assert.equal(result.meta.rows_read, 1, 'counter read stays one row with 500 unread notifications');
    assert.equal(result.meta.rows_written, 0);
  }
  assert(await db.prepare("SELECT id FROM notifications WHERE id='expired'").first(), 'badge GET does not write cleanup');
  assert.equal((await get(null)).status, 401);
  assert.equal(statements.length, 0, 'unauthenticated request does not query D1');
  assert.equal((await (await get('a', true, false)).json()).unreadCount, 500, 'unmigrated fixture uses exact fallback');
  const post = body => onRequest({ request: new Request('https://fixture/api/notifications', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    data: { user: { id: 'a' } }, env: { tear_of_god_db: db, NOTIFICATION_UNREAD_COUNTS: 'true' } });
  await post({ action: 'read', id: 'n0' });
  await post({ action: 'delete', id: 'n1' });
  assert.equal((await (await get('a')).json()).unreadCount, 498, 'badge observes mutations immediately');
  const list = await (await get('a', false)).json();
  assert.equal(list.unreadCount, 498);
  assert.equal(list.data.length, 20);
  assert.equal(await db.prepare("SELECT id FROM notifications WHERE id='expired'").first(), null, 'full list retains 24h purge');
  console.log('Badge quota checks passed: one row/query, zero writes, private user scope, mutations, fallback and expiry.');
} finally { await mf.dispose(); }
