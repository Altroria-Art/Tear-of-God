import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest } from '../../functions/api/rankings.js';
import { seedLatestContributions } from './helpers/contributions.mjs';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  // Run the identical, existing quota fixture rather than a smaller substitute.
  const fixture = await readFile(new URL('./quota-hot-paths.mjs', import.meta.url), 'utf8');
  const from = fixture.indexOf('  const schema =');
  const to = fixture.indexOf('  if (cpuMode)', from);
  assert(from >= 0 && to > from);
  const seed = fixture.slice(from, to).replace("new URL('../../schema.sql', import.meta.url)", "'schema.sql'");
  await new Function('db', 'readFile', 'seedLatestContributions', `return (async()=>{${seed}})()`)(db, readFile, seedLatestContributions);
  // Isolated Miniflare fixture only: measure deployment compatibility with the
  // existing production indexes while migration approval is pending.
  if (process.argv.includes('--without-home-indexes')) {
    await db.prepare('DROP INDEX IF EXISTS idx_rankings_feed_activity').run();
    await db.prepare('DROP INDEX IF EXISTS idx_ranking_items_preview').run();
  }
  if (process.argv.includes('--index-experiment')) {
    const queries = [
      "SELECT id FROM rankings ORDER BY COALESCE(last_activity_at,created_at) DESC,id DESC LIMIT 49",
      "SELECT id FROM ranking_items WHERE ranking_id='r0001' ORDER BY position,id LIMIT 12",
      "SELECT id FROM rankings WHERE user_id='author' AND (created_at,id)<('9999','z') ORDER BY created_at DESC,id DESC LIMIT 13",
    ];
    const plans = async () => Promise.all(queries.map(async sql => ({sql, plan:(await db.prepare('EXPLAIN QUERY PLAN '+sql).all()).results})));
    const before = await plans();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_rankings_feed_activity ON rankings(COALESCE(last_activity_at,created_at) DESC,id DESC)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_ranking_items_preview ON ranking_items(ranking_id,position,id)').run();
    const after = await plans();
    await writeFile('.wrangler/audit-logs/home-index-plans.json',JSON.stringify({before,after},null,2));
    console.log('EXPLAIN before/after saved to home-index-plans.json');
  }
  const output = {};
  for (const mode of ['trending', 'for_you', 'following', 'guest_trending']) {
    const entries = new Map();
    globalThis.caches = { default: {
      match: async key => entries.get(key.url)?.clone(),
      put: async (key, value) => entries.set(key.url, value.clone()),
      delete: async key => entries.delete(key.url),
    } };
    let cursor;
    for (const phase of ['cold', 'warm', 'next']) {
      const traces = [];
      const traced = { prepare(sql) {
        const wrap = statement => ({ bind: (...values) => wrap(statement.bind(...values)),
          all: async () => { const result = await statement.all(); traces.push({ sql, read: result.meta.rows_read }); return result; },
          first: async () => { const result = await statement.all(); traces.push({ sql, read: result.meta.rows_read }); return result.results[0] || null; },
        }); return wrap(db.prepare(sql));
      } };
      const params = new URLSearchParams({ feed_type: mode.replace('guest_', ''), seed: phase === 'warm' && mode === 'guest_trending' ? '999' : '9', limit: '12', page: phase === 'next' ? '2' : '1' });
      if (phase === 'next' && cursor) params.set('cursor', cursor);
      const tasks = [];
      const response = await onRequest({ request: new Request('https://benchmark.test/api/rankings?' + params), env: { tear_of_god_db: traced, CACHE_METRIC_SAMPLE_RATE: '0' }, data: { user: mode === 'guest_trending' ? null : { id: 'viewer' } }, waitUntil: promise => tasks.push(promise) });
      assert.equal(response.status, 200);
      const body = await response.json();
      await Promise.all(tasks);
      assert(body.data.length <= 12);
      if (phase === 'cold') cursor = body.nextCursor;
      output[mode + '_' + phase] = { rows: traces.reduce((n, row) => n + row.read, 0), queries: traces.length, cards: body.data.length, top: [...traces].sort((a,b) => b.read-a.read).slice(0,3) };
      console.log(`${mode} ${phase}: ${output[mode + '_' + phase].rows} rows, ${traces.length} queries, ${body.data.length} cards`);
    }
  }
  const destination = process.argv[2];
  if (destination) await writeFile(destination, JSON.stringify(output, null, 2));
} finally { delete globalThis.caches; await mf.dispose(); }
