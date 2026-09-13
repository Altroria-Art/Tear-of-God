import assert from 'node:assert/strict';

import { onRequest as authEndpoint } from '../../functions/api/auth.js';
import { onRequest as uploadEndpoint } from '../../functions/api/upload.js';

function noDatabaseAccess() {
  return {
    prepare() {
      throw new Error('Preview safety rejection must happen before D1 access');
    },
  };
}

async function callPreviewAuth(body, extraEnv = {}) {
  const request = new Request('https://new-v18.tear-of-god.pages.dev/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.81' },
    body: JSON.stringify(body),
  });
  const response = await authEndpoint({
    request,
    env: { APP_ENV: 'preview', tear_of_god_db: noDatabaseAccess(), ...extraEnv },
    data: { user: null },
  });
  return { response, body: await response.json() };
}

const google = await callPreviewAuth({ action: 'google_sync', idToken: 'not-called' });
assert.equal(google.response.status, 403);
assert.match(google.body.error, /disabled in Preview/);

for (const action of ['register', 'forgot_password']) {
  const realEmail = await callPreviewAuth({
    action,
    email: 'person@example.com',
    password: 'Synthetic!Password123',
    username: 'Synthetic User',
  });
  assert.equal(realEmail.response.status, 403);
  assert.match(realEmail.body.error, /synthetic test accounts only/);
}

const uploadRequest = new Request('https://new-v18.tear-of-god.pages.dev/api/upload', {
  method: 'POST',
});
let storageWrites = 0;
const uploadResponse = await uploadEndpoint({
  request: uploadRequest,
  env: {
    APP_ENV: 'preview',
    PREVIEW_UPLOADS_ENABLED: 'false',
    tear_of_god_db: noDatabaseAccess(),
    STORAGE: {
      put() {
        storageWrites += 1;
        throw new Error('Preview R2 write was not expected');
      },
    },
  },
  data: { user: { id: 'preview-user-001' } },
});
assert.equal(uploadResponse.status, 503);
assert.deepEqual(await uploadResponse.json(), { error: 'Uploads are disabled in Preview' });
assert.equal(storageWrites, 0);

console.log('Preview auth and upload isolation safety checks passed.');
