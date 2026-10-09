import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as comments } from '../../functions/api/comments.js';
import { onRequest as templateComments } from '../../functions/api/template-comments.js';
import { onRequest as notifications } from '../../functions/api/notifications.js';
import { onRequest as votes } from '../../functions/api/votes.js';
import { onRequest as templateVotes } from '../../functions/api/template-votes.js';
import { onRequestGet as socialState } from '../../functions/api/social-state.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default { fetch() { return new Response("test"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  const sql = schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(SQL_SCRIPT_SEPARATOR).map(s => s.trim()).filter(Boolean);
  await db.batch(sql.map(s => db.prepare(s)));
  await db.prepare("INSERT INTO profiles (id, username) VALUES ('author', 'Author'), ('reader', 'Reader')").run();
  await db.prepare("INSERT INTO templates (id, creator_id) VALUES ('topic', 'author')").run();
  await db.prepare("INSERT INTO rankings (id, user_id, template_id) VALUES ('post', 'author', 'topic')").run();
  const env = { tear_of_god_db: db };
  async function call(handler, path, body, user = 'reader', method = body ? 'POST' : 'GET') {
    const response = await handler({ request: new Request('http://localhost/api/' + path, {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    }), env, data: { user: user ? { id: user } : null } });
    return { status: response.status, cache: response.headers.get('Cache-Control'), body: await response.json() };
  }

  // Reader comments; the author can see it and their unread badge immediately
  // via the next GET, without revisiting or rebuilding a full ranking.
  const created = await call(comments, 'comments', { ranking_id: 'post', content: 'A fresh comment' });
  assert.equal(created.status, 201);
  assert.equal(created.body.comments_count, 1);
  const refreshed = await call(comments, 'comments?ranking_id=post', null, 'author');
  assert.equal(refreshed.body.data[0].id, created.body.data.id);
  assert.equal(refreshed.body.stats.comments, 1);
  assert.equal(refreshed.cache, 'private, no-store');
  const notice = await call(notifications, 'notifications', null, 'author');
  assert.equal(notice.body.unreadCount, 1);
  assert.equal(notice.body.data[0].comment_id, created.body.data.id);
  assert.equal((await call(notifications, 'notifications', null, 'reader')).body.unreadCount, 0);

  await call(votes, 'votes', { rankingId: 'post', voteType: 'like' });
  const ownState = await call(socialState, 'social-state?ranking_ids=post', null, 'reader');
  assert.deepEqual(ownState.body.data[0], { id: 'post', likes: 1, dislikes: 0, comments: 1, user_vote: 'like' });
  const guestState = await call(socialState, 'social-state?ranking_ids=post', null, null);
  assert.equal(guestState.body.data[0].user_vote, null, 'never leak another viewer’s vote');
  assert.equal(guestState.cache, 'private, no-store');
  assert.equal((await call(socialState, 'social-state?ranking_ids=' + Array.from({ length: 41 }, (_, i) => 'p' + i).join(','))).status, 400);
  assert.equal((await call(socialState, 'social-state?ranking_ids=' + 'x'.repeat(129))).status, 400);

  const discussion = await call(templateComments, 'template-comments', { template_id: 'topic', content: 'Community discussion' });
  assert.equal(discussion.body.comments_count, 1);
  const community = await call(templateComments, 'template-comments?template_id=topic', null, 'author');
  assert.equal(community.body.data[0].id, discussion.body.data.id);
  assert.equal(community.body.comments_count, 1);
  assert.equal(community.cache, 'private, no-store');
  assert.equal(community.body.reactionResult, undefined, 'existing comments-only response remains compatible');
  await call(templateVotes, 'template-votes', { template_id: 'topic', voteType: 'like' });
  await call(templateVotes, 'template-votes', { template_id: 'topic', voteType: 'dislike' }, 'author');
  for (const [user, vote] of [['reader', 'like'], ['author', 'dislike'], [null, null]]) {
    const combined = await call(templateComments, 'template-comments?template_id=topic&include_reactions=1&user_id=reader', null, user);
    assert.equal(combined.cache, 'private, no-store');
    assert.deepEqual(combined.body.data, community.body.data);
    assert.equal(combined.body.comments_count, 1);
    assert.deepEqual(combined.body.reactionResult, { success: true, likes: 1, dislikes: 1, userVote: vote });
  }

  const reply = await call(comments, 'comments', { ranking_id: 'post', parent_id: created.body.data.id, content: 'Reply from author' }, 'author');
  assert.equal(reply.body.comments_count, 2);
  const replyNotice = await call(notifications, 'notifications', null, 'reader');
  assert.equal(replyNotice.body.data[0].comment_id, reply.body.data.id);
  await call(notifications, 'notifications', { action: 'read_all' }, 'reader');
  assert.equal((await call(notifications, 'notifications', null, 'reader')).body.unreadCount, 0);

  await call(comments, 'comments', { id: created.body.data.id }, 'reader', 'DELETE');
  const deleted = await call(comments, 'comments?ranking_id=post', null, 'author');
  assert.equal(deleted.body.data.length, 1);
  assert.equal(deleted.body.data[0].id, reply.body.data.id);
  assert.equal(deleted.body.data[0].parent_id, null, 'a live reply survives parent deletion');
  assert.equal(deleted.body.stats.comments, 1);
  console.log('Social update checks passed: two users, comments/replies, notifications, vote privacy, counts, deletion, uncached reads.');
} finally { await mf.dispose(); }
