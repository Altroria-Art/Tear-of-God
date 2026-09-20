import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as middleware } from '../../functions/api/_middleware.js';
import { onRequest as comments } from '../../functions/api/comments.js';
import { onRequest as templateComments } from '../../functions/api/template-comments.js';
import { digest } from '../../functions/lib/session.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("local test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(';').map(sql => sql.trim()).filter(Boolean);
  await db.batch(statements.map(sql => db.prepare(sql)));
  for (const [id, token] of [['owner', 'a'.repeat(64)], ['other', 'b'.repeat(64)]]) {
    await db.prepare('INSERT INTO profiles (id, username) VALUES (?, ?)').bind(id, id).run();
    await db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await digest(token), id, Date.now() + 60000).run();
  }
  await db.prepare("INSERT INTO templates (id, creator_id) VALUES ('template', 'other')").run();
  await db.prepare("INSERT INTO rankings (id, user_id, template_id, comments_count) VALUES ('ranking', 'other', 'template', 3)").run();

  async function call(isTemplate, body, token = 'a'.repeat(64), origin) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Cookie = `tog_session=${token}`;
    if (origin) headers.Origin = origin;
    const request = new Request(`http://localhost/api/${isTemplate ? 'template-comments' : 'comments'}`, {
      method: 'DELETE', headers, body: JSON.stringify(body),
    });
    const context = { request, env: { tear_of_god_db: db }, data: {} };
    context.next = () => (isTemplate ? templateComments : comments)(context);
    const response = await middleware(context);
    return { status: response.status, body: await response.json() };
  }

  for (const isTemplate of [false, true]) {
    const table = isTemplate ? 'template_comments' : 'comments';
    const column = isTemplate ? 'template_id' : 'ranking_id';
    const scope = isTemplate ? 'template' : 'ranking';
    for (const [id, user, parent] of [['parent', 'owner', null], ['reply', 'other', 'parent'], ['own-reply', 'owner', 'reply']]) {
      await db.prepare(`INSERT INTO ${table} (id, ${column}, user_id, content, parent_id) VALUES (?, ?, ?, 'test', ?)`)
        .bind(id, scope, user, parent).run();
    }
    assert.equal((await call(isTemplate, { id: 'parent' }, null)).status, 401);
    assert.equal((await call(isTemplate, { id: 'parent', user_id: 'owner' }, 'b'.repeat(64))).status, 403);
    assert.equal((await call(isTemplate, { id: 'parent' }, 'a'.repeat(64), 'https://other.test')).status, 403);
    assert.equal((await call(isTemplate, { id: 'missing' })).status, 404);
    assert.equal((await call(isTemplate, { id: "' OR 1=1" })).status, 400);

    // Force a failure after reply promotion: the transaction must undo it.
    await db.prepare(`CREATE TRIGGER fail_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`).run();
    assert.equal((await call(isTemplate, { id: 'parent' })).status, 500);
    assert.equal((await db.prepare(`SELECT parent_id FROM ${table} WHERE id = 'reply'`).first()).parent_id, 'parent');
    assert.ok(await db.prepare(`SELECT id FROM ${table} WHERE id = 'parent'`).first());
    await db.prepare('DROP TRIGGER fail_delete').run();

    const deleted = await call(isTemplate, { id: 'parent' });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.comments_count, 2);
    assert.equal(await db.prepare(`SELECT id FROM ${table} WHERE id = 'parent'`).first(), null);
    assert.equal((await db.prepare(`SELECT parent_id FROM ${table} WHERE id = 'reply'`).first()).parent_id, null);
    assert.equal((await db.prepare(`SELECT parent_id FROM ${table} WHERE id = 'own-reply'`).first()).parent_id, 'reply');
    assert.equal((await call(isTemplate, { id: 'parent' })).status, 404);
    const replyDeleted = await call(isTemplate, { id: 'own-reply' });
    assert.equal(replyDeleted.body.comments_count, 1);
    assert.ok(await db.prepare(`SELECT id FROM ${table} WHERE id = 'reply'`).first());
    if (!isTemplate) assert.equal((await db.prepare("SELECT comments_count FROM rankings WHERE id = 'ranking'").first()).comments_count, 1);
  }
  console.log('Comment deletion passed: ownership, guest/CSRF rejection, validation, reply preservation, counters and rollback for both endpoints.');
} finally {
  await mf.dispose();
}
