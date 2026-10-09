import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as deleteUser } from '../../functions/api/admin/users.js';
import { onRequest as deleteComment } from '../../functions/api/admin/comments.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("admin deletion"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));
const oldCaches = globalThis.caches;
const evicted = [];
globalThis.caches = { default: { delete: async request => { evicted.push(request.url); return true; } } };
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  for (const id of ['admin', 'removed', 'survivor']) {
    await db.prepare('INSERT INTO profiles (id, username, role) VALUES (?, ?, ?)').bind(id, id, id === 'admin' ? 'admin' : 'user').run();
  }
  await db.prepare("INSERT INTO templates (id, creator_id) VALUES ('template', 'survivor')").run();
  await db.prepare("INSERT INTO rankings (id, user_id, template_id, likes_count, dislikes_count, comments_count) VALUES ('surviving-post', 'survivor', 'template', 1, 1, 4), ('removed-post', 'removed', 'template', 0, 0, 0)").run();
  await db.prepare("UPDATE templates SET use_count = 2 WHERE id = 'template'").run();
  await db.prepare("INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES ('v1', 'surviving-post', 'removed', 'like'), ('v2', 'surviving-post', 'admin', 'dislike')").run();
  for (const [id, user, parent] of [['root', 'removed', null], ['reply', 'survivor', 'root'], ['nested', 'admin', 'reply'], ['kept', 'survivor', null]]) {
    await db.prepare("INSERT INTO comments (id, ranking_id, user_id, parent_id) VALUES (?, 'surviving-post', ?, ?)").bind(id, user, parent).run();
  }
  async function call(endpoint, body) {
    const response = await endpoint({
      request: new Request('https://admin-deletion.test/api/admin/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      env: { tear_of_god_db: db }, data: { user: { id: 'admin' } },
    });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  }
  await call(deleteUser, { action: 'delete', target_id: 'removed' });
  assert.equal(await db.prepare("SELECT id FROM profiles WHERE id = 'removed'").first(), null);
  assert.equal(await db.prepare("SELECT id FROM rankings WHERE id = 'removed-post'").first(), null);
  assert.equal((await db.prepare("SELECT use_count FROM templates WHERE id='template'").first()).use_count,1);
  assert.deepEqual(await db.prepare("SELECT likes_count, dislikes_count, comments_count FROM rankings WHERE id = 'surviving-post'").first(), { likes_count: 0, dislikes_count: 1, comments_count: 1 });
  assert.deepEqual((await db.prepare('SELECT id FROM comments').all()).results, [{ id: 'kept' }]);
  assert.ok(evicted.some(url => url.includes('__community_stats_v1?template=template')));
  assert.ok(evicted.some(url => url.includes('/api/spotlights?')));

  for (const [id, parent] of [['moderated', null], ['moderated-reply', 'moderated'], ['moderated-nested', 'moderated-reply']]) {
    await db.prepare("INSERT INTO comments (id, ranking_id, user_id, parent_id) VALUES (?, 'surviving-post', 'survivor', ?)").bind(id, parent).run();
  }
  await db.prepare("UPDATE rankings SET comments_count = 4 WHERE id = 'surviving-post'").run();
  await Promise.all([
    call(deleteComment, { action: 'delete', target_id: 'moderated', is_template_comment: false }),
    call(deleteComment, { action: 'delete', target_id: 'moderated', is_template_comment: false }),
  ]);
  assert.equal((await db.prepare("SELECT comments_count FROM rankings WHERE id = 'surviving-post'").first()).comments_count, 1);
  assert.deepEqual((await db.prepare('SELECT id FROM comments').all()).results, [{ id: 'kept' }]);
  console.log('Admin deletion counters passed: surviving votes, recursive reply cascades, concurrent moderation, community and spotlight invalidation.');
} finally {
  globalThis.caches = oldCaches;
  await mf.dispose();
}
