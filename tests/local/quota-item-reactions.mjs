import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as templateVotes } from '../../functions/api/template-votes.js';
import { onRequestGet as templates } from '../../functions/api/templates.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("test"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));
const splitSql = sql => sql.split(/\r?\n/).filter(l => !l.trimStart().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(splitSql(schema).map(s => db.prepare(s)));
  await db.prepare('DROP INDEX idx_items_name').run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<5000)
    INSERT INTO items(id,name) SELECT 'item-'||n, 'Name '||n FROM seq`).run();
  await db.prepare("INSERT INTO items VALUES ('collision', 'item-1', NULL), ('duplicate-name', 'Name 2', NULL)").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO profiles(id,username) SELECT 'u'||n, 'User '||n FROM seq`).run();
  await db.prepare("INSERT INTO templates(id,title,creator_id,tiers) VALUES ('t','Template','u1','[]'), ('empty','Empty','u1','[]')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<25)
    INSERT INTO template_items(id,template_id,item_id,position)
    SELECT 'ti'||n,'t', CASE WHEN n%2=0 THEN 'Name '||n ELSE 'item-'||n END,n FROM seq`).run();
  await db.prepare("INSERT INTO template_items(id,template_id,item_id,position) VALUES ('missing','t','unknown',26)").run();
  const join = `SELECT ti.*, i.name as item_name, i.image_url as item_image
    FROM template_items ti LEFT JOIN items i ON (ti.item_id = i.id OR ti.item_id = i.name)
    WHERE ti.template_id = ? ORDER BY ti.position ASC`;
  const before = await db.prepare(join).bind('t').all();
  const migration = await readFile(new URL('../../migrations-active/0011_quota_indexes.sql', import.meta.url), 'utf8');
  await db.batch(splitSql(migration).map(s => db.prepare(s)));
  await db.batch(splitSql(migration).map(s => db.prepare(s))); // Repeat apply is safe.
  const after = await db.prepare(join).bind('t').all();
  const stable = rows => rows.map(r => JSON.stringify(r)).sort();
  assert.deepEqual(stable(after.results), stable(before.results), 'IDs, legacy names, collisions, duplicate names, missing items preserved');
  assert.ok(after.meta.rows_read < before.meta.rows_read / 100);
  console.log(`Item join (26 template items, 5002 catalog items): rows_read ${before.meta.rows_read} -> ${after.meta.rows_read}`);

  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO template_reactions(id,template_id,user_id,vote_type)
    SELECT 'v'||n,'t','u'||n, CASE WHEN n%2=0 THEN 'like' ELSE 'dislike' END FROM seq`).run();
  const old = `SELECT
    (SELECT COUNT(*) FROM template_reactions r WHERE r.template_id=?1 AND r.vote_type='like') AS likes,
    (SELECT COUNT(*) FROM template_reactions r WHERE r.template_id=?1 AND r.vote_type='dislike') AS dislikes,
    (SELECT vote_type FROM template_reactions r WHERE r.template_id=?1 AND r.user_id=?2) AS user_vote`;
  let measured;
  const measuredDb = { prepare(sql) {
    const stmt = db.prepare(sql);
    return { bind(...args) {
      const bound = stmt.bind(...args);
      return { all: async () => {
        const result = await bound.all();
        if (sql.includes('SUM(')) measured = result;
        return result;
      }, first: () => bound.first(), run: () => bound.run() };
    } };
  } };
  for (const templateId of ['t', 'empty']) {
    for (const user of [null, 'u1', 'u2']) {
      const baseline = await db.prepare(old).bind(templateId, user).all();
      const response = await templateVotes({ request: new Request(`https://test/api/template-votes?template_id=${templateId}`), env: { tear_of_god_db: measuredDb }, data: { user: user ? { id: user } : null } });
      const row = baseline.results[0];
      assert.deepEqual(await response.json(), { success: true, likes: row.likes, dislikes: row.dislikes, userVote: row.user_vote });
      if (templateId === 't') {
        assert.ok(measured.meta.rows_read < baseline.meta.rows_read * 0.6);
        if (user === 'u1') console.log(`Reaction counts (1000 votes): rows_read ${baseline.meta.rows_read} -> ${measured.meta.rows_read}`);
      }
    }
    const response = await templates({ request: new Request(`https://test/api/templates?id=${templateId}`), env: { tear_of_god_db: measuredDb }, data: { user: null } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.stats.likes, templateId === 't' ? 500 : 0);
    assert.equal(body.data.stats.dislikes, templateId === 't' ? 500 : 0);
  }
  // Exercise mutation counts after switching and cancelling a vote.
  for (const [voteType, likes, dislikes] of [['like', 501, 499], [null, 500, 499]]) {
    const response = await templateVotes({ request: new Request('https://test/api/template-votes', { method: 'POST', body: JSON.stringify({ template_id: 't', voteType }) }), env: { tear_of_god_db: db }, data: { user: { id: 'u1' } } });
    assert.deepEqual(await response.json(), { success: true, likes, dislikes, userVote: voteType });
  }
  console.log('Migration, item resolution, empty counts, guest/user counts and vote mutations passed');
} finally { await mf.dispose(); }
