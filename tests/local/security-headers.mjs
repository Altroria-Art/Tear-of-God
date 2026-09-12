import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../../functions/api/_middleware.js';

const expectedHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-frame-options': 'SAMEORIGIN',
};

const unusedDb = {
  prepare() {
    throw new Error('The database should not be read without a session cookie');
  },
};

function assertSecurityHeaders(response) {
  for (const [name, value] of Object.entries(expectedHeaders)) {
    assert.equal(response.headers.get(name), value, `${name} must be present`);
  }
  assert.equal(response.headers.has('content-security-policy'), false, 'CSP is intentionally deferred');
  assert.equal(response.headers.has('strict-transport-security'), false, 'HSTS is intentionally deferred');
}

async function callMiddleware({
  path = '/api/categories',
  method = 'GET',
  headers,
  body,
  next = async () => Response.json({ success: true, data: ['safe'] }),
} = {}) {
  const request = new Request(`https://example.test${path}`, { method, headers, body });
  return onRequest({
    request,
    env: { tear_of_god_db: unusedDb },
    data: {},
    next,
  });
}

const getResponse = await callMiddleware();
assert.equal(getResponse.status, 200);
assert.deepEqual(await getResponse.json(), { success: true, data: ['safe'] });
assertSecurityHeaders(getResponse);

const postResponse = await callMiddleware({
  path: '/api/admin/users',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'suspend', userId: 'test-user' }),
});
assert.equal(postResponse.status, 401);
assertSecurityHeaders(postResponse);

const crossOriginResponse = await callMiddleware({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.test' },
  body: '{}',
});
assert.equal(crossOriginResponse.status, 403);
assertSecurityHeaders(crossOriginResponse);

const wrongContentTypeResponse = await callMiddleware({
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: '{}',
});
assert.equal(wrongContentTypeResponse.status, 415);
assertSecurityHeaders(wrongContentTypeResponse);

const errorResponse = await callMiddleware({
  next: async () => {
    throw new Error('simulated internal failure');
  },
});
assert.equal(errorResponse.status, 503);
assert.deepEqual(await errorResponse.json(), { success: false, error: 'Service temporarily unavailable' });
assertSecurityHeaders(errorResponse);

const staticHeaders = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
for (const [name, value] of Object.entries(expectedHeaders)) {
  assert.match(staticHeaders, new RegExp(`^\\s*${name}: ${value.replace(/[()]/g, '\\$&')}\\s*$`, 'im'));
}
assert.doesNotMatch(staticHeaders, /^\s*Content-Security-Policy:/im);
assert.doesNotMatch(staticHeaders, /^\s*Strict-Transport-Security:/im);

console.log('Security header checks passed for static Pages rules and API middleware responses.');
