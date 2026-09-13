import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/_middleware.js';

const expectedSecurityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-frame-options': 'SAMEORIGIN',
};
const maintenanceBody = {
  success: false,
  error: 'Service temporarily read-only',
  code: 'MAINTENANCE_READ_ONLY',
};
const validSessionCookie = `tog_session=${'a'.repeat(64)}`;

function assertSecurityHeaders(response) {
  for (const [name, value] of Object.entries(expectedSecurityHeaders)) {
    assert.equal(response.headers.get(name), value, `${name} must be preserved`);
  }
}

async function callMiddleware({
  method = 'GET',
  path = '/api/categories',
  maintenanceValue,
  headers,
  body,
  nextResponse = () => Response.json({ success: true, source: 'handler' }),
} = {}) {
  let databaseCalls = 0;
  let handlerCalls = 0;
  const env = {
    tear_of_god_db: {
      prepare() {
        databaseCalls += 1;
        throw new Error('Database access was not expected');
      },
    },
  };
  if (maintenanceValue !== undefined) env.MAINTENANCE_READ_ONLY = maintenanceValue;

  const data = {};
  const response = await onRequest({
    request: new Request(`https://example.test${path}`, { method, headers, body }),
    env,
    data,
    next: async () => {
      handlerCalls += 1;
      return nextResponse(data);
    },
  });

  return {
    response,
    databaseCalls,
    handlerCalls,
  };
}

const defaultOffGet = await callMiddleware();
assert.equal(defaultOffGet.response.status, 200);
assert.deepEqual(await defaultOffGet.response.json(), { success: true, source: 'handler' });
assert.equal(defaultOffGet.handlerCalls, 1);
assert.equal(defaultOffGet.databaseCalls, 0);
assertSecurityHeaders(defaultOffGet.response);

for (const maintenanceValue of [undefined, '0', 'true', 'TRUE', ' 1 ', true]) {
  const authPost = await callMiddleware({
    method: 'POST',
    path: '/api/auth',
    maintenanceValue,
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    nextResponse: () => Response.json({ success: true, source: 'auth-handler' }, { status: 202 }),
  });
  assert.equal(authPost.response.status, 202, `Maintenance must stay off for ${String(maintenanceValue)}`);
  assert.deepEqual(await authPost.response.json(), { success: true, source: 'auth-handler' });
  assert.equal(authPost.handlerCalls, 1);
  assert.equal(authPost.databaseCalls, 0);
  assertSecurityHeaders(authPost.response);
}

const adminPostWhileOff = await callMiddleware({
  method: 'POST',
  path: '/api/admin/users',
  maintenanceValue: '0',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
assert.equal(adminPostWhileOff.response.status, 401);
assert.equal(adminPostWhileOff.handlerCalls, 0);
assert.equal(adminPostWhileOff.databaseCalls, 0);
assert.notEqual((await adminPostWhileOff.response.json()).code, 'MAINTENANCE_READ_ONLY');
assertSecurityHeaders(adminPostWhileOff.response);

for (const method of ['GET', 'HEAD', 'OPTIONS']) {
  const allowed = await callMiddleware({
    method,
    maintenanceValue: '1',
    nextResponse: () => new Response(null, { status: 204 }),
  });
  assert.equal(allowed.response.status, 204, `${method} must remain available`);
  assert.equal(allowed.handlerCalls, 1);
  assert.equal(allowed.databaseCalls, 0);
  assertSecurityHeaders(allowed.response);
}

const blockedRequests = [
  { method: 'POST', path: '/api/report', scope: 'public mutation' },
  { method: 'POST', path: '/api/auth', scope: 'auth mutation' },
  { method: 'POST', path: '/api/admin/users', scope: 'admin mutation' },
  { method: 'PUT', path: '/api/users', scope: 'PUT mutation' },
  { method: 'PATCH', path: '/api/templates', scope: 'PATCH mutation' },
  { method: 'DELETE', path: '/api/rankings', scope: 'DELETE mutation' },
];

for (const { method, path, scope } of blockedRequests) {
  const blocked = await callMiddleware({
    method,
    path,
    maintenanceValue: '1',
    headers: {
      'Content-Type': 'application/json',
      Cookie: validSessionCookie,
    },
    body: '{}',
  });
  assert.equal(blocked.response.status, 503, `${scope} must be blocked`);
  assert.deepEqual(await blocked.response.json(), maintenanceBody);
  assert.equal(blocked.response.headers.get('retry-after'), '300');
  assert.equal(blocked.response.headers.get('cache-control'), 'no-store');
  assert.equal(blocked.handlerCalls, 0, `${scope} must not reach its handler`);
  assert.equal(blocked.databaseCalls, 0, `${scope} must not access D1`);
  assertSecurityHeaders(blocked.response);
}

console.log('Maintenance read-only middleware checks passed.');
