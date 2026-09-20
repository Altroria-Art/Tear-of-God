import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as users } from '../../functions/api/users.js';
import { onRequest as admin } from '../../functions/api/admin/index.js';
import { onRequest as topics } from '../../functions/api/topic-follows.js';
import { onRequestGet as spotlights } from '../../functions/api/spotlights.js';
import { onRequest as activity } from '../../functions/api/activity.js';
import { onRequestGet as hashtags } from '../../functions/api/hashtags.js';

const sql = async path => (await readFile(new URL(path, import.meta.url), 'utf8'))
  .split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
  .split(';').map(statement => statement.trim()).filter(Boolean);
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("test"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB', 'FRESH'],
}));
try {
  const db = await mf.getD1Database('DB');
  const fresh = await mf.getD1Database('FRESH');
  let categoryRemoved = false;
  await db.batch((await sql('../fixtures/schema-before-hashtags.sql')).map(s => db.prepare(s)));
  await fresh.batch((await sql('../../schema.sql')).map(s => fresh.prepare(s)));
  await db.batch([
    db.prepare("INSERT INTO profiles (id, username, role) VALUES ('admin', 'Admin', 'admin'), ('author', 'Author', 'user'), ('viewer', 'Viewer', 'user')"),
    db.prepare(`INSERT INTO templates (id, creator_id, title, category, hashtags, tiers) VALUES
      ('t1', 'author', 'Test', 'Food', ' #food , #ไทย,#Food', '[{"id":"s","label":"S","color":"#ff0000"}]'),
      ('t2', 'author', 'Legacy', 'Anime', NULL, '[]'),
      ('t3', 'author', 'Mixed', 'Gaming', '#RPG', '[]')`),
    db.prepare(`INSERT INTO rankings (id, user_id, template_id, title, category, hashtags) VALUES
      ('r1', 'author', 't1', 'Test rank', 'Food', '#Food,#ไทย'),
      ('r2', 'author', 't2', 'Legacy rank', 'Anime', NULL),
      ('r3', 'viewer', 't3', 'Mixed rank', 'Gaming', '#RPG'),
      ('r4', 'author', NULL, 'Tagless', NULL, '')`),
    db.prepare("INSERT INTO topic_follows (user_id, topic_type, topic_key) VALUES ('viewer','category','Food'), ('viewer','hashtag','food'), ('viewer','category','Anime'), ('viewer','template','t1')"),
    db.prepare("INSERT INTO comments (id, ranking_id, user_id, content) VALUES ('c1','r1','viewer','preserved')"),
    db.prepare("INSERT INTO follows (follower_id, following_id) VALUES ('viewer','author')"),
    db.prepare("INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES ('v1','r1','viewer','like')"),
  ]);
  const transition = await sql('../../migrations-active/0009_hashtag_transition.sql');
  const removal = await sql('../../migrations-active/0010_drop_category.sql');
  const migration = [...transition, ...removal];
  await assert.rejects(db.batch([...migration.map(s => db.prepare(s)), db.prepare('INSERT INTO table_that_does_not_exist VALUES (1)')]));
  assert.ok((await db.prepare('PRAGMA table_info(rankings)').all()).results.some(c => c.name === 'category'));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM topic_follows WHERE topic_type = 'category'").first()).n, 2);
  await db.batch(transition.map(s => db.prepare(s)));
  await call(rankings, '/api/rankings?hashtag=food', null);
  await call(templates, '/api/templates?hashtag=food', null);
  await call(users, '/api/users?id=author', null);
  await db.batch(removal.map(s => db.prepare(s)));
  categoryRemoved = true;
  for (const table of ['rankings', 'templates', 'topic_follows']) {
    const migratedColumns = (await db.prepare(`PRAGMA table_info(${table})`).all()).results.map(c => c.name);
    const freshColumns = (await fresh.prepare(`PRAGMA table_info(${table})`).all()).results.map(c => c.name);
    assert.deepEqual(migratedColumns, freshColumns);
    assert.ok(!migratedColumns.includes('category'));
  }
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM comments').first()).n, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rankings').first()).n, 4);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM topic_follows').first()).n, 3);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM template_hashtags WHERE template_id = 't1' AND hashtag = 'food'").first()).n, 1);
  assert.equal((await db.prepare("SELECT hashtags FROM templates WHERE id = 't2'").first()).hashtags, '#Anime');
  assert.equal((await db.prepare("SELECT hashtags FROM rankings WHERE id = 'r3'").first()).hashtags, '#RPG,#Gaming');

  async function call(handler, path, userId = 'viewer', body) {
    const pending = [];
    const response = await handler({
      request: new Request(`http://localhost${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      env: { tear_of_god_db: db }, data: { user: userId ? { id: userId } : null },
      waitUntil: promise => pending.push(promise),
    });
    const result = await response.json();
    assert.equal(response.status < 400, true, `${path}: ${JSON.stringify(result)}`);
    if (categoryRemoved) assert.ok(!JSON.stringify(result).includes('"category":'), path);
    await Promise.all(pending);
    return result;
  }
  for (const param of ['hashtag=food', 'category=food']) {
    const feed = await call(rankings, `/api/rankings?${param}`, null);
    assert.deepEqual(feed.data.map(r => r.id), ['r1']);
    const list = await call(templates, `/api/templates?${param}`, null);
    assert.deepEqual(list.data.map(t => t.id), ['t1']);
  }
  assert.equal((await call(templates, '/api/templates?hashtag=foo', null)).data.length, 0);
  assert.equal((await call(templates, '/api/templates?hashtag=ไทย', null)).data.length, 1);
  for (const feed of ['trending', 'for_you', 'following']) await call(rankings, `/api/rankings?feed_type=${feed}&seed=9`);
  await call(rankings, '/api/rankings'); // legacy personalized ordering
  await call(templates, '/api/templates?suggest=1');
  await call(templates, '/api/templates?id=t1');
  await call(spotlights, '/api/spotlights');
  await call(activity, '/api/activity');
  await call(hashtags, '/api/hashtags');
  const profile = await call(users, '/api/users?id=author');
  assert.ok(profile.data.taste_identity.hashtag_distribution.some(t => t.hashtag === 'food'));
  await call(users, '/api/users?id=author&fields=similar');
  const dashboard = await call(admin, '/api/admin', 'admin');
  assert.ok(dashboard.data.top_hashtags.some(t => t.hashtag === 'food'));
  await call(topics, '/api/topic-follows?topic_type=hashtag&topic_key=food');
  const created = await call(rankings, '/api/rankings', 'author', {
    payload: { title: 'New hashtag post', hashtags: '#Food,#New', category: 'ignored' },
    template: { title: 'New hashtag template', hashtags: '#Food,#New', category: 'ignored', tiers: [{ id: 's', label: 'S', color: '#ff0000' }], items: [{ name: 'One', position: 0 }] },
    items: [{ item_id: 'One', tier: 'S', position: 0 }],
  });
  assert.ok(created.data.id);
  assert.equal((await db.prepare('SELECT hashtags FROM rankings WHERE id = ?').bind(created.data.id).first()).hashtags, '#Food,#New');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE ranking_id = ? AND user_id = 'viewer' AND type = 'following_rank'").bind(created.data.id).first()).n, 1);
  console.log('Hashtags-only migration and API checks passed: rollback, preserved data/follows, schema parity, exact filters, feeds, profiles, admin stats, notifications and publishing.');
} finally {
  await mf.dispose();
}
