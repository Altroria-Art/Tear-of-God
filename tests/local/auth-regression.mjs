import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as authEndpoint } from '../../functions/api/auth.js';
import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { digest } from '../../functions/lib/session.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

async function createLocalD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local auth test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function callAuth(db, { method = 'POST', body, cookie } = {}) {
  const headers = { 'CF-Connecting-IP': '127.0.0.42' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const request = new Request('http://localhost:8788/api/auth', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const env = { tear_of_god_db: db };
  const context = {
    request,
    env,
    data: {},
    next: () => authEndpoint({ request, env, data: context.data }),
  };
  const response = await apiMiddleware(context);
  return { response, body: await response.json() };
}

function sessionCookie(response) {
  const header = response.headers.get('Set-Cookie') || '';
  const match = /(?:^|;\s*)(tog_session=[a-f0-9]{64})(?:;|$)/.exec(header);
  assert.ok(match, 'expected a tog_session cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  return match[1];
}

const { mf, db } = await createLocalD1();
try {
  const submittedEmail = 'Phase5A-Auth@Local.Test';
  const email = submittedEmail.toLowerCase();
  const originalPassword = 'Original!Password123';
  const newPassword = 'Replacement!Password456';

  const registered = await callAuth(db, {
    body: { action: 'register', email: submittedEmail, password: originalPassword, username: 'Phase 5A User' },
  });
  assert.equal(registered.response.status, 201);
  assert.deepEqual(registered.body, { success: true });
  const profile = await db.prepare('SELECT id, password FROM profiles WHERE email = ?').bind(email).first();
  assert.ok(profile.id);
  assert.match(profile.password, /^pbkdf2-sha256\$100000\$/);

  const duplicateDifferentCase = await callAuth(db, {
    body: { action: 'register', email: email.toUpperCase(), password: originalPassword, username: 'Duplicate User' },
  });
  assert.equal(duplicateDifferentCase.response.status, 409);
  assert.equal(duplicateDifferentCase.body.success, false);

  const invalidPassword = await callAuth(db, {
    body: { action: 'login', email, password: 'Incorrect!Password' },
  });
  assert.equal(invalidPassword.response.status, 401);
  assert.equal(invalidPassword.body.success, false);
  assert.equal(invalidPassword.response.headers.has('Set-Cookie'), false);

  const loggedIn = await callAuth(db, {
    body: { action: 'login', email: `  ${email.toUpperCase()}  `, password: originalPassword },
  });
  assert.equal(loggedIn.response.status, 200);
  assert.equal(loggedIn.body.data.id, profile.id);
  assert.equal('password' in loggedIn.body.data, false);
  const firstCookie = sessionCookie(loggedIn.response);

  const restored = await callAuth(db, { method: 'GET', cookie: firstCookie });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.body.data.id, profile.id);
  assert.equal(restored.body.data.email, email);

  const invalidSession = await callAuth(db, { method: 'GET', cookie: `tog_session=${'d'.repeat(64)}` });
  assert.equal(invalidSession.response.status, 200);
  assert.equal(invalidSession.body.data, null);

  const expiredToken = 'e'.repeat(64);
  await db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(expiredToken), profile.id, Date.now() - 1000).run();
  const expiredSession = await callAuth(db, { method: 'GET', cookie: `tog_session=${expiredToken}` });
  assert.equal(expiredSession.response.status, 200);
  assert.equal(expiredSession.body.data, null);

  const loggedOut = await callAuth(db, { body: { action: 'logout' }, cookie: firstCookie });
  assert.equal(loggedOut.response.status, 200);
  assert.equal(loggedOut.body.success, true);
  assert.match(loggedOut.response.headers.get('Set-Cookie') || '', /tog_session=;.*Max-Age=0/);
  const restoredAfterLogout = await callAuth(db, { method: 'GET', cookie: firstCookie });
  assert.equal(restoredAfterLogout.body.data, null);

  const secondLogin = await callAuth(db, {
    body: { action: 'login', email, password: originalPassword },
  });
  assert.equal(secondLogin.response.status, 200);
  const secondCookie = sessionCookie(secondLogin.response);

  const forgotExisting = await callAuth(db, { body: { action: 'forgot_password', email: email.toUpperCase() } });
  const forgotMissing = await callAuth(db, {
    body: { action: 'forgot_password', email: 'missing-phase5a@local.test' },
  });
  assert.equal(forgotExisting.response.status, 200);
  assert.equal(forgotMissing.response.status, 200);
  assert.deepEqual(forgotExisting.body, forgotMissing.body);

  const expiredResetToken = 'a'.repeat(64);
  await db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind('expired-reset', profile.id, await digest(expiredResetToken), new Date(Date.now() - 60_000).toISOString()).run();
  const expiredReset = await callAuth(db, {
    body: { action: 'reset_password', token: expiredResetToken, password: newPassword },
  });
  assert.equal(expiredReset.response.status, 400);
  assert.equal(expiredReset.body.success, false);
  assert.match(expiredReset.body.error, /หมดอายุ/);
  assert.equal(
    await db.prepare('SELECT id FROM password_resets WHERE token_hash = ?').bind(await digest(expiredResetToken)).first(),
    null,
  );

  const validResetToken = 'b'.repeat(64);
  await db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind('valid-reset', profile.id, await digest(validResetToken), new Date(Date.now() + 60_000).toISOString()).run();
  const reset = await callAuth(db, {
    body: { action: 'reset_password', token: validResetToken, password: newPassword },
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.success, true);

  const reusedReset = await callAuth(db, {
    body: { action: 'reset_password', token: validResetToken, password: newPassword },
  });
  assert.equal(reusedReset.response.status, 400);
  assert.equal(reusedReset.body.success, false);
  assert.match(reusedReset.body.error, /ไม่ถูกต้อง|ใช้งานไปแล้ว/);

  const oldSessionAfterReset = await callAuth(db, { method: 'GET', cookie: secondCookie });
  assert.equal(oldSessionAfterReset.body.data, null);
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?').bind(profile.id).first()).count,
    0,
  );

  const oldPasswordAfterReset = await callAuth(db, {
    body: { action: 'login', email, password: originalPassword },
  });
  assert.equal(oldPasswordAfterReset.response.status, 401);
  const newPasswordLogin = await callAuth(db, {
    body: { action: 'login', email, password: newPassword },
  });
  assert.equal(newPasswordLogin.response.status, 200);
  sessionCookie(newPasswordLogin.response);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    users: [{
      localId: 'preview-google-subject-001',
      email: '  Google.Mixed@Example.Test  ',
      emailVerified: true,
      disabled: false,
      displayName: 'Synthetic Google User',
      photoUrl: null,
      providerUserInfo: [{ providerId: 'google.com' }],
    }],
  });
  try {
    const googleSync = await callAuth(db, { body: { action: 'google_sync', idToken: 'synthetic-local-token' } });
    assert.equal(googleSync.response.status, 200);
    assert.equal(googleSync.body.success, true);
    const googleProfile = await db.prepare('SELECT email FROM profiles WHERE id = ?').bind(googleSync.body.data.id).first();
    assert.equal(googleProfile.email, 'google.mixed@example.test');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Authentication regression checks passed against local Miniflare D1 without sending email.');
} finally {
  await mf.dispose();
}
