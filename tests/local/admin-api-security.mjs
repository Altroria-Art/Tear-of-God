import assert from 'node:assert/strict';

import { onRequest as adminComments } from '../../functions/api/admin/comments.js';
import { onRequest as adminRankings } from '../../functions/api/admin/rankings.js';
import { onRequest as adminReports } from '../../functions/api/admin/reports.js';
import { onRequest as adminTemplates } from '../../functions/api/admin/templates.js';
import { onRequest as adminUsers } from '../../functions/api/admin/users.js';
import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { onRequestGet as categories } from '../../functions/api/categories.js';
import { onRequestGet as hashtags } from '../../functions/api/hashtags.js';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as users } from '../../functions/api/users.js';

const INTERNAL_DETAIL = 'D1_ERROR: no such table secret_schema';

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes('SELECT role FROM profiles')) {
      return { role: this.db.roles.get(this.values[0]) || 'user' };
    }
    if (this.db.failReads) throw new Error(INTERNAL_DETAIL);
    if (this.sql.includes('SELECT ranking_id FROM comments')) return { ranking_id: 'ranking-1' };
    if (this.sql.includes('COUNT(*) as count FROM comments')) return { count: 0 };
    return null;
  }

  async all() {
    if (this.db.failReads) throw new Error(INTERNAL_DETAIL);
    return { results: [] };
  }

  async run() {
    if (this.db.failWrites) throw new Error(INTERNAL_DETAIL);
    this.db.writeCount += 1;
    return { success: true, meta: { changes: 1 } };
  }
}

class FakeDb {
  constructor({ failReads = false, failWrites = false } = {}) {
    this.failReads = failReads;
    this.failWrites = failWrites;
    this.roles = new Map();
    this.writeCount = 0;
  }

  prepare(sql) {
    if (this.failReads && !sql.includes('SELECT role FROM profiles')) {
      throw new Error(INTERNAL_DETAIL);
    }
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    if (this.failWrites) throw new Error(INTERNAL_DETAIL);
    this.writeCount += statements.length;
    return statements.map(() => ({ success: true, results: [], meta: { changes: 1 } }));
  }
}

function request(path, body, raw = false) {
  return new Request(`https://local.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
}

async function callAdmin(handler, body, { userId = `admin-${crypto.randomUUID()}`, db = new FakeDb(), raw = false } = {}) {
  db.roles.set(userId, 'admin');
  const response = await handler({
    request: request('/api/admin/test', body, raw),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json(), db };
}

async function expectStatus(call, status) {
  const result = await call;
  assert.equal(result.response.status, status);
  return result;
}

const validCases = [
  [adminUsers, { action: 'set_role', target_id: 'user-1', role: 'admin' }, { success: true, data: { id: 'user-1', role: 'admin' } }],
  [adminUsers, { action: 'delete', target_id: 'user-2' }, { success: true, data: { id: 'user-2' } }],
  [adminRankings, { action: 'delete', target_id: 'ranking-1' }, { success: true, data: { id: 'ranking-1' } }],
  [adminTemplates, { action: 'delete', target_id: 'template-1' }, { success: true, data: { id: 'template-1' } }],
  [adminReports, { action: 'set_status', target_id: 'report-1', status: 'resolved' }, { success: true, data: { id: 'report-1', status: 'resolved' } }],
  [adminReports, { action: 'delete', target_id: 'report-2' }, { success: true, data: { id: 'report-2' } }],
  [adminComments, { action: 'delete', target_id: 'comment-1', is_template_comment: false }, { success: true }],
  [adminComments, { action: 'delete', target_id: 'comment-2', is_template_comment: true }, { success: true }],
];

for (const [handler, payload, expected] of validCases) {
  const result = await expectStatus(callAdmin(handler, payload), 200);
  assert.deepEqual(result.body, expected);
}

{
  const db = new FakeDb();
  db.roles.set('member-1', 'user');
  const response = await adminUsers({
    request: request('/api/admin/users', { action: 'delete', target_id: 'user-1' }),
    env: { tear_of_god_db: db },
    data: { user: { id: 'member-1' } },
  });
  assert.equal(response.status, 403);
  assert.equal(db.writeCount, 0);
}

{
  const response = await apiMiddleware({
    request: request('/api/admin/users', { action: 'delete', target_id: 'user-1' }),
    env: { tear_of_god_db: new FakeDb() },
    data: {},
    next: () => { throw new Error('Unauthenticated request reached the endpoint'); },
  });
  assert.equal(response.status, 401);
}

const invalidCases = [
  [adminRankings, '{', { raw: true }],
  [adminRankings, [], {}],
  [adminRankings, { action: 'delete' }, {}],
  [adminRankings, { action: 'delete', target_id: 'bad id' }, {}],
  [adminRankings, { action: 'ban', target_id: 'ranking-1' }, {}],
  [adminRankings, { action: 'delete', target_id: 'ranking-1', unexpected: true }, {}],
  [adminUsers, { action: 'set_role', target_id: 'user-1', role: 'owner' }, {}],
  [adminUsers, { action: 'set_role', target_id: 'user-1', role: 1 }, {}],
  [adminUsers, { action: 'delete', target_id: 'user-1', role: 'user' }, {}],
  [adminReports, { action: 'set_status', target_id: 'report-1', status: 'closed' }, {}],
  [adminComments, { action: 'delete', target_id: 'comment-1', is_template_comment: 'false' }, {}],
];

for (const [handler, payload, options] of invalidCases) {
  const result = await expectStatus(callAdmin(handler, payload, options), 400);
  assert.equal(result.body.success, false);
  assert.equal(result.db.writeCount, 0);
}

{
  const oversized = { action: 'delete', target_id: 'ranking-1', padding: 'x'.repeat(2500) };
  const result = await expectStatus(callAdmin(adminRankings, oversized), 413);
  assert.equal(result.db.writeCount, 0);
}

{
  const userId = 'admin-rate-limit';
  for (let index = 0; index < 60; index += 1) {
    await expectStatus(callAdmin(adminRankings, { action: 'delete', target_id: `ranking-${index}` }, { userId }), 200);
  }
  const limited = await expectStatus(callAdmin(adminRankings, { action: 'delete', target_id: 'ranking-61' }, { userId }), 429);
  assert.equal(limited.body.error, 'Too many admin mutation requests');
  assert.ok(limited.response.headers.get('Retry-After'));
}

const originalConsoleError = console.error;
const errorLogs = [];
console.error = (...args) => errorLogs.push(args);
try {
  const adminFailure = await expectStatus(callAdmin(
    adminRankings,
    { action: 'delete', target_id: 'ranking-1' },
    { db: new FakeDb({ failWrites: true }) },
  ), 500);
  assert.equal(adminFailure.body.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(adminFailure.body).includes(INTERNAL_DETAIL), false);

  const publicCases = [
    [categories, { request: new Request('https://local.test/api/categories'), env: { tear_of_god_db: new FakeDb({ failReads: true }) } }],
    [hashtags, { request: new Request('https://local.test/api/hashtags'), env: { tear_of_god_db: new FakeDb({ failReads: true }) } }],
    [templates, { request: new Request('https://local.test/api/templates'), env: { tear_of_god_db: new FakeDb({ failReads: true }) }, data: {} }],
    [users, { request: new Request('https://local.test/api/users?id=user-1'), env: { tear_of_god_db: new FakeDb({ failReads: true }) }, data: {} }],
  ];

  for (const [handler, context] of publicCases) {
    const response = await handler(context);
    const responseBody = await response.json();
    assert.equal(response.status, 500);
    assert.equal(responseBody.code, 'INTERNAL_ERROR');
    assert.equal(JSON.stringify(responseBody).includes(INTERNAL_DETAIL), false);
  }
} finally {
  console.error = originalConsoleError;
}

assert.ok(JSON.stringify(errorLogs).includes(INTERNAL_DETAIL));
console.log('Admin API security checks passed');
