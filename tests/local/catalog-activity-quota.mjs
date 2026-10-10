import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as activity } from '../../functions/api/activity.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(l => !l.trimStart().startsWith('--')).join('\n').split(SQL_SCRIPT_SEPARATOR).map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('author','Author'),('other','Other')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10)
    INSERT INTO templates(id,title,creator_id,tiers) SELECT 't'||n,'Template '||n,'author','[]' FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at)
    SELECT printf('r%04d',n),'Rank '||n,'author','t'||(n%10+1),'#shared',datetime('now','-'||n||' minutes') FROM seq`).run();
  await db.prepare("INSERT INTO follows(follower_id,following_id) VALUES ('viewer','author')").run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type,created_at) SELECT 'v'||id,id,'author','like',created_at FROM rankings").run();
  await db.prepare("INSERT INTO template_bookmarks(user_id,template_id) VALUES ('viewer','t1'),('other','t2')").run();
  let reads = 0, queries = 0;
  const traced = { prepare(sql) {
    const wrap = s => ({ bind: (...args) => wrap(s.bind(...args)),
      all: async () => { const r = await s.all(); reads += r.meta.rows_read; queries++; return r; },
      first: async () => { const r = await s.all(); reads += r.meta.rows_read; queries++; return r.results[0] ?? null; },
    }); return wrap(db.prepare(sql));
  } };
  async function measure(handler, path, user = null, headers = {}) {
    reads = 0; queries = 0;
    const response = await handler({ request: new Request('https://test'+path, { headers }),
      env: { tear_of_god_db: traced }, data: { user: user ? { id: user } : null } });
    const body = await response.json();
    return { status: response.status, body, reads, queries, cacheControl: response.headers.get('Cache-Control') };
  }
  const entries = new Map();
  const cache = { match: async key => entries.get(key.url)?.clone(),
    put: async (key, response) => { entries.set(key.url, response.clone()); } };
  globalThis.caches = { default: cache };
  const path = '/api/templates?limit=12';
  const cold = await measure(templates, path);
  const warm = await measure(templates, path);
  assert.deepEqual(warm.body, cold.body);
  assert.equal(warm.reads, 0);
  const metadata = await measure(templates, path + '&fields=meta');
  assert.equal(metadata.queries, 2, 'Full-board catalog skips obsolete item preview queries');
  assert.ok(metadata.body.data.every(topic => !Object.hasOwn(topic, 'template_items') && !Object.hasOwn(topic, 'ranking_preview')));
  assert.deepEqual(metadata.body.data.map(topic => topic.id), cold.body.data.map(topic => topic.id));
  assert.equal((await measure(templates, path + '&fields=meta')).reads, 0);
  const personal = await measure(templates, path, 'viewer');
  assert.equal(personal.cacheControl, 'private, no-store');
  assert.deepEqual(personal.body.data.filter(t => t.is_saved).map(t => t.id), ['t1']);
  assert.ok(personal.reads < 20);
  const other = await measure(templates, path, 'other');
  assert.deepEqual(other.body.data.filter(t => t.is_saved).map(t => t.id), ['t2']);
  assert.equal((await measure(templates, path+'&q=missing')).body.data.length,0);
  const suggestions = await measure(templates, path+'&suggest=1','viewer');
  assert.ok(suggestions.body.data.every(t => !Object.hasOwn(t,'is_saved')));
  assert.equal((await measure(templates, path+'&suggest=1','other')).reads,0);
  assert.equal((await measure(templates, path+'&page=2')).body.data.length,0);
  await db.prepare("DELETE FROM template_bookmarks WHERE user_id='viewer'").run();
  assert.ok((await measure(templates, path, 'viewer')).body.data.every(t => !t.is_saved));
  assert.equal((await measure(templates, path+'&saved=true')).status, 401);
  assert.deepEqual((await measure(templates, path+'&saved=true', 'other')).body.data.map(t => t.id), ['t2']);
  for (const response of entries.values()) {
    assert.ok((await response.clone().json()).data.every(t => !t.is_saved), 'Shared payload has no bookmark state');
  }
  assert.ok((await measure(templates, path, null, { 'Cache-Control': 'no-cache' })).reads > 0);
  for (const [key, response] of entries) { response.headers.set('X-Public-Expires','0'); entries.set(key,response); }
  assert.ok((await measure(templates, path)).reads > 0, 'Expired cache reloads');
  entries.clear();
  reads = 0; queries = 0;
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => templates({
    request: new Request('https://test'+path), env: { tear_of_god_db: traced }, data: { user: null } })));
  assert.equal(queries, cold.queries, 'Concurrent cold requests share one public query batch');
  for (const response of concurrent) assert.deepEqual(await response.json(), cold.body);
  cache.match = async () => { throw new Error('cache unavailable'); };
  cache.put = async () => { throw new Error('cache unavailable'); };
  assert.deepEqual((await measure(templates, path)).body, cold.body);
  delete globalThis.caches;
  const currentActivity = await measure(activity, '/api/activity?limit=20', 'viewer');
  assert.equal(currentActivity.body.data.length,20);
  assert.deepEqual(currentActivity.body.data.slice(0,2).map(event => [event.type,event.ranking.id]),
    [['liked_ranking','r0001'],['template_used','r0001']]);
  assert.equal((await measure(activity, '/api/activity')).status,401);
  assert.equal((await measure(activity, '/api/activity?limit=51','viewer')).status,400);
  assert.equal((await measure(activity, '/api/activity','other')).body.data.length,0);
  const report = { fixture: { templates:10, rankings:2000, votes:2000 },
    templates: { cold: cold.reads, guestWarm: warm.reads, authenticatedWarm: personal.reads }, activity: { after: currentActivity.reads } };
  if (process.argv.includes('--compare')) {
    for (const [name, handlerName, url, user] of [['templates','onRequestGet',path,null],['activity','onRequest','/api/activity?limit=20','viewer']]) {
      const source = await readFile(new URL(`../../.wrangler/quota-baselines/${name}.js`, import.meta.url),'utf8');
      const rewritten = source.replace(/from '([^']+)'/g, (_, specifier) => `from '${new URL(specifier,new URL(`../../functions/api/${name}.js`,import.meta.url)).href}'`);
      const baseline = (await import('data:text/javascript;base64,'+Buffer.from(rewritten).toString('base64')))[handlerName];
      const before = await measure(baseline,url,user);
      const after = await measure(name === 'templates' ? templates : activity,url,user);
      assert.deepEqual(after.body,before.body);
      report[name].before = before.reads;
      if (name === 'activity') assert.ok(after.reads < before.reads);
      for (const limit of [1,12,50]) {
        if (name !== 'activity') continue;
        const old = await measure(baseline,`/api/activity?limit=${limit}`,user);
        const updated = await measure(activity,`/api/activity?limit=${limit}`,user);
        assert.deepEqual(updated.body,old.body,'Activity preserves ties, types and order');
      }
    }
  }
  console.log(JSON.stringify(report,null,2));
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 11 UNION ALL SELECT n+1 FROM seq WHERE n<100)
    INSERT INTO templates(id,title,creator_id,tiers) SELECT 't'||n,'Template '||n,'author','[]' FROM seq`).run();
  const fullPage = await measure(templates,'/api/templates?limit=100','other');
  assert.equal(fullPage.body.data.length,100,'Maximum list size respects the bind limit');
  assert.deepEqual(fullPage.body.data.filter(t => t.is_saved).map(t => t.id),['t2']);
  console.log('Catalog privacy, expiry, bypass, cache outage, burst dedup and activity checks passed.');
} finally { delete globalThis.caches; await mf.dispose(); }
