// Acceptance smoke against Wrangler Pages + isolated local D1/R2.
// Never point this test at a remote host: it creates real accounts and content.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:8799';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local server required');
const id = randomUUID().slice(0, 8);
const password = `LocalQA-${randomUUID()}!`;
const checks = [];

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function check(name, condition, detail) {
  assert(condition, `${name}: ${JSON.stringify(detail)}`);
  checks.push(name);
}

const people = [
  { email: `rank-accept-a-${id}@example.test`, username: `Rank QA ${id}` },
  { email: `rank-accept-b-${id}@example.test`, username: `รสนิยม ${id}` },
];
for (const person of people) {
  const registered = await request('/api/auth', { method: 'POST', body: { action: 'register', ...person, password } });
  check('register', registered.status === 201 && registered.data.success, registered);
}
const invalid = await request('/api/auth', { method: 'POST', body: { action: 'login', email: people[0].email, password: 'wrong-password' } });
check('invalid login', invalid.status === 401 && !invalid.data.success, invalid);
for (const person of people) {
  const loggedIn = await request('/api/auth', { method: 'POST', body: { action: 'login', email: person.email, password } });
  check('login', loggedIn.status === 200 && loggedIn.cookie && loggedIn.data.data?.id, loggedIn);
  person.cookie = loggedIn.cookie;
  person.id = loggedIn.data.data.id;
  const restored = await request('/api/auth', { cookie: person.cookie });
  check('session restore', restored.data.data?.id === person.id, restored);
}
const guestMutation = await request('/api/bookmarks', { method: 'POST', body: { template_id: 'x', saved: true } });
check('guest mutation blocked', guestMutation.status === 401, guestMutation);

const title = `Acceptance drinks ${id}`;
const tiers = [{ id: 'top', label: 'สุดยอดมาก', color: '#ff7f7f' }, { id: 'mid', label: 'A', color: '#ffbf7f' }, { id: 'low', label: 'B', color: '#ffff7f' }];
const names = [`ชาไทย ${id}`, `Coffee ${id}`, `Matcha ${id}`];
const first = await request('/api/rankings', { method: 'POST', cookie: people[0].cookie, body: {
  payload: { title, description: 'Local acceptance only', hashtags: '#Acceptance,#Drinks' },
  template: { title, description: 'Local acceptance only', hashtags: '#Acceptance,#Drinks', tiers, items: names.map((name, position) => ({ name, position, tier: tiers[position].label })) },
  items: names.map((item_id, position) => ({ item_id, position, tier: tiers[position].label })),
} });
check('create template and first ranking', first.status === 201 && first.data.data?.id && first.data.data?.template_id, first);
const rankingId = first.data.data.id;
const templateId = first.data.data.template_id;
const detail = await request(`/api/rankings?id=${encodeURIComponent(rankingId)}`, { cookie: people[0].cookie });
check('persisted ranking detail', detail.data.data?.ranking_items?.length === 3 && detail.data.data?.tiers?.[0]?.label === tiers[0].label, detail);
const templateDetail = await request(`/api/templates?id=${encodeURIComponent(templateId)}`, { cookie: people[0].cookie });
check('persisted template detail', templateDetail.data.data?.id === templateId, templateDetail);

const second = await request('/api/rankings', { method: 'POST', cookie: people[1].cookie, body: {
  payload: { title: `Second take ${id}`, hashtags: '#Acceptance,#Drinks', template_id: templateId },
  items: names.map((item_id, position) => ({ item_id, position, tier: tiers[(position + 1) % 3].label })),
} });
check('rank existing template as second account', second.status === 201 && second.data.data?.id, second);
const aggregated = await request(`/api/templates?id=${encodeURIComponent(templateId)}`, { cookie: people[1].cookie });
check('community average from two rankings', aggregated.data.data?.community_average?.tiers?.length > 0, aggregated.data.data?.community_average);
const home = await request('/api/rankings?feed_type=trending&limit=12&page=1', { cookie: people[0].cookie });
check('real home feed includes published ranking', home.data?.data?.some(row => row.id === rankingId), { status: home.status, ids: home.data?.data?.map(row => row.id) });

const followed = await request('/api/follows', { method: 'POST', cookie: people[1].cookie, body: { action: 'follow', following_id: people[0].id } });
check('follow', followed.data?.is_following === true, followed);
const liked = await request('/api/votes', { method: 'POST', cookie: people[1].cookie, body: { rankingId, voteType: 'like' } });
check('like', liked.data?.userVote === 'like' && liked.data?.likes === 1, liked);
const disliked = await request('/api/votes', { method: 'POST', cookie: people[1].cookie, body: { rankingId, voteType: 'dislike' } });
check('dislike', disliked.data?.userVote === 'dislike' && disliked.data?.likes === 0, disliked);
const undone = await request('/api/votes', { method: 'POST', cookie: people[1].cookie, body: { rankingId, voteType: null } });
check('undo vote', undone.data?.userVote === null && undone.data?.dislikes === 0, undone);
const bookmarked = await request('/api/bookmarks', { method: 'POST', cookie: people[1].cookie, body: { template_id: templateId, saved: true } });
check('bookmark', bookmarked.data?.saved === true, bookmarked);
const savedList = await request('/api/bookmarks', { cookie: people[1].cookie });
check('bookmark persisted', savedList.data?.data?.includes(templateId), savedList);
const removed = await request('/api/bookmarks', { method: 'POST', cookie: people[1].cookie, body: { template_id: templateId, saved: false } });
check('remove bookmark', removed.data?.saved === false, removed);
const comment = await request('/api/comments', { method: 'POST', cookie: people[1].cookie, body: { ranking_id: rankingId, content: `Local comment ${id}` } });
check('comment', comment.status === 201 && comment.data.data?.id, comment);
const reply = await request('/api/comments', { method: 'POST', cookie: people[0].cookie, body: { ranking_id: rankingId, parent_id: comment.data.data.id, content: `Local reply ${id}` } });
check('reply', reply.status === 201 && reply.data.data?.parent_id === comment.data.data.id, reply);
const pinned = await request('/api/profile-pins', { method: 'POST', cookie: people[0].cookie, body: { action: 'pin', ranking_id: rankingId, position: 0 } });
check('pin ranking', pinned.data?.pinned === true, pinned);
const reported = await request('/api/report', { method: 'POST', cookie: people[1].cookie, body: { ranking_id: rankingId, reason: `Local test report ${id}` } });
check('report', reported.status === 201 && reported.data?.success, reported);
const notification = await request('/api/notifications', { cookie: people[0].cookie });
check('notification generated', notification.data?.data?.length > 0 && notification.data?.unreadCount > 0, notification);
const notificationId = notification.data.data[0].id;
const read = await request('/api/notifications', { method: 'POST', cookie: people[0].cookie, body: { action: 'read', id: notificationId } });
check('notification read', read.data?.success, read);
const deleted = await request('/api/notifications', { method: 'POST', cookie: people[0].cookie, body: { action: 'delete', id: notificationId } });
check('notification delete', deleted.data?.success, deleted);
const unfollowed = await request('/api/follows', { method: 'POST', cookie: people[1].cookie, body: { action: 'unfollow', following_id: people[0].id } });
check('unfollow', unfollowed.data?.is_following === false, unfollowed);
const logout = await request('/api/auth', { method: 'POST', cookie: people[0].cookie, body: { action: 'logout' } });
check('logout', logout.data?.success, logout);
const expired = await request('/api/auth', { cookie: people[0].cookie });
check('session invalid after logout', expired.data?.data === null, expired);

console.log(JSON.stringify({ checks: checks.length, passed: checks, rankingId, templateId, userId: people[1].id }, null, 2));
