import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../../functions/api/rankings.js';
import { prioritizeUnseen } from '../../functions/lib/feed-refresh.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
const db = {
  prepare(sql) {
    let args = [];
    const statement = {
      bind(...values) { args = values; return statement; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async run() { return sqlite.prepare(sql).run(...args); },
    };
    return statement;
  },
};
try {
  sqlite.exec("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('author','Author')");
  for (let i = 0; i < 80; i++) sqlite.prepare('INSERT INTO rankings(id,title,user_id,hashtags,likes_count) VALUES (?,?,?,?,?)')
    .run(`r${String(i).padStart(3, '0')}`, `Ranking ${i}`, 'author', i < 40 ? '#food' : '#games', 80 - i);
  sqlite.exec("INSERT INTO votes(id,ranking_id,user_id,vote_type) VALUES ('interest','r000','viewer','like')");
  async function feed(params) {
    const response = await onRequest({ request: new Request(`https://test.local/api/rankings?${new URLSearchParams(params)}`), env: { tear_of_god_db: db }, data: { user: { id: 'viewer' } } });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body.data.map(row => row.id);
  }
  for (const feed_type of ['trending', 'for_you']) {
    const base = { feed_type, seed: '100', limit: '12' };
    const first = await feed(base);
    assert.deepEqual(await feed(base), first, 'same session must retain ordering');
    const second = await feed({ ...base, page: '2' });
    assert.equal(second.filter(id => first.includes(id)).length, 0, 'pages must not overlap');
    const refreshed = await feed({ ...base, seed: '200', exclude: first.join(',') });
    assert.equal(refreshed.filter(id => first.includes(id)).length, 0, 'refresh favors unseen candidates');
    if (feed_type === 'for_you') assert.ok([...first, ...second, ...refreshed].every(id => Number(id.slice(1)) < 40), 'refresh must retain hashtag interest filtering');
    const unseen = await feed({ ...base, exclude: Array.from({ length: 39 }, (_, i) => `r${String(i).padStart(3, '0')}`).join(',') });
    if (feed_type === 'for_you') {
      assert.deepEqual(unseen, ['r039'], 'small interest pool shows its only remaining unseen post without padding the page with seen posts');
    }
  }
  assert.deepEqual(prioritizeUnseen(['a', 'b', 'c'], new Set(['a', 'b'])), ['c'], 'short refresh page shows only unseen, never pads with seen');
  assert.deepEqual(prioritizeUnseen(['a', 'b'], new Set(['a', 'b'])), ['a', 'b'], 'fully-seen pool falls back to the full list so the feed never empties');
  console.log('Feed refresh passed: stable seed/pages, fresh unseen first, preserved interests, small/exhausted pools.');
} finally {
  sqlite.close();
}
