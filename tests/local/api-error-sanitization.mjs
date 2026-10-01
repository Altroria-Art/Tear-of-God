import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { onRequest as follows } from '../../functions/api/follows.js';
import { onRequestGet as participants } from '../../functions/api/template-participants.js';

const internalDetail = 'SQLITE_ERROR: no such table: private_internal_table /srv/db.sqlite';
const genericError = 'Service temporarily unavailable';
const base = 'https://local.test';
const json = async pending => {
  const response = await pending;
  return { status: response.status, body: await response.json() };
};

async function captureServerErrors(run) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const result = await run();
    assert(logged.some(line => line.includes(internalDetail)), 'Internal detail stays in server logs');
    return result;
  } finally {
    console.error = original;
  }
}

function assertSafe500(result, expectedBody) {
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, expectedBody);
  const exposed = JSON.stringify(result.body);
  for (const fragment of ['SQLITE', 'private_internal_table', '/srv/', 'stack', internalDetail]) {
    assert(!exposed.includes(fragment), `500 response exposed ${fragment}`);
  }
}

function followsRequest(type) {
  return new Request(`${base}/api/follows?user_id=user-a&type=${type}`);
}

for (const type of ['followers', 'following']) {
  const normalDb = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ id: 'user-b' }] }) }) }) };
  const normal = await json(await follows({ request: followsRequest(type), env: { tear_of_god_db: normalDb }, data: { user: null } }));
  assert.deepEqual(normal, { status: 200, body: { success: true, data: [{ id: 'user-b' }], total: 1 } });

  const failedDb = { prepare: () => { throw Error(internalDetail); } };
  const failed = await captureServerErrors(() => json(follows({ request: followsRequest(type), env: { tear_of_god_db: failedDb }, data: { user: null } })));
  assertSafe500(failed, { error: genericError });
}

const missingFollowType = await json(await follows({ request: new Request(`${base}/api/follows?user_id=user-a`), env: { tear_of_god_db: {} }, data: { user: null } }));
assert.deepEqual(missingFollowType, { status: 400, body: { error: 'Missing params' } });

function participantsDb({ role = 'admin', fail = false, missing = false } = {}) {
  return {
    prepare(sql) {
      if (sql.includes('SELECT role FROM profiles')) {
        return { bind: () => ({ first: async () => ({ role }) }) };
      }
      if (fail) throw Error(internalDetail);
      let results;
      if (sql.includes('SELECT tiers FROM templates')) results = missing ? [] : [{ tiers: '[{"id":"s","label":"S"}]' }];
      else if (sql.includes('FROM rankings r')) results = [{ ranking_id: 'ranking-a', user_id: 'user-a', username: 'Alice', created_at: '2026-10-01 00:00:00' }];
      else if (sql.includes('FROM ranking_items ri')) results = [{ ranking_id: 'ranking-a', item_id: 'item-a', item_name: 'Apple', tier: 'S', position: 0 }];
      else throw Error(`Unexpected query: ${sql}`);
      return { bind: () => ({ all: async () => ({ results }) }) };
    },
  };
}

async function participantsResponse({ user = { id: 'admin-a' }, db = participantsDb(), templateId = 'template-a' } = {}) {
  const url = `${base}/api/template-participants${templateId === null ? '' : `?template_id=${templateId}`}`;
  return json(participants({ request: new Request(url), env: { tear_of_god_db: db }, data: { user } }));
}

assert.equal((await participantsResponse({ user: null })).status, 401);
assert.equal((await participantsResponse({ db: participantsDb({ role: 'user' }) })).status, 403);
assert.deepEqual(await participantsResponse({ templateId: null }), { status: 400, body: { success: false, error: 'Missing template_id' } });
assert.deepEqual(await participantsResponse({ db: participantsDb({ missing: true }) }), { status: 404, body: { success: false, error: 'Template not found' } });

const normalParticipants = await participantsResponse();
assert.equal(normalParticipants.status, 200);
assert.equal(normalParticipants.body.success, true);
assert.equal(normalParticipants.body.total, 1);
assert.deepEqual(normalParticipants.body.data[0].ranking_items, [{ item_id: 'item-a', item_name: 'Apple', tier: 'S', position: 0 }]);
assert.deepEqual(normalParticipants.body.data[0].tiers, [{ id: 's', label: 'S' }]);

const failedParticipants = await captureServerErrors(() => participantsResponse({ db: participantsDb({ fail: true }) }));
assertSafe500(failedParticipants, { success: false, error: genericError });

// Guard API response expressions only. Server-side logging and RequestError
// validation messages are intentionally outside this pattern.
const apiDir = fileURLToPath(new URL('../../functions/api/', import.meta.url));
async function checkRawErrorResponses(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await checkRawErrorResponses(file);
    else if (entry.name.endsWith('.js')) {
      const source = await readFile(file, 'utf8');
      const rawJsonResponse = /return\s+jsonResponse\(\s*\{[^}]*\berror:\s*(?:e|err|error)\.message\b[^}]*\}\s*,\s*500\s*\)/s;
      const rawResponseJson = /return\s+Response\.json\(\s*\{[^}]*\berror:\s*(?:e|err|error)\.message\b[^}]*\}\s*,\s*\{\s*status:\s*500\b/s;
      assert(!rawJsonResponse.test(source) && !rawResponseJson.test(source), `${file} returns a raw exception message in a 500 response`);
    }
  }
}
await checkRawErrorResponses(apiDir);

console.log('API 500 sanitization passed: follows GET (both types), template participants auth/success/failure, and source guard.');
