import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest } from '../../functions/api/auth.js';
import { digest, hashPassword, verifyPassword } from '../../functions/lib/session.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default { fetch() { return new Response("reset code test"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
const originalFetch = globalThis.fetch;
let deliveredCode;
let deliveryFails = false;
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.brevo.com/v3/smtp/email') return originalFetch(url, options);
  const message = JSON.parse(options.body);
  deliveredCode = message.htmlContent.match(/margin: 24px 0;">(\d{6})</)[1];
  return Response.json(deliveryFails ? { code: 'test_failure' } : {}, { status: deliveryFails ? 500 : 201 });
};

try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const email = 'otp@example.test';
  await db.prepare('INSERT INTO profiles (id, username, email, password) VALUES (?, ?, ?, ?)')
    .bind('otp-user', 'OTP user', email, await hashPassword('Original-password-123')).run();
  let calls = 0;
  async function call(body) {
    const response = await onRequest({ request: new Request('https://reset.test/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `test-${++calls}` },
      body: JSON.stringify(body) }), env: { tear_of_god_db: db, BREVO_API_KEY: 'test-key' }, data: { user: null } });
    return { status: response.status, body: await response.json() };
  }
  const reset = (code, address = email) => call({ action: 'reset_password', email: address, code, password: 'Updated-password-123' });
  const clearAttempts = () => db.prepare('DELETE FROM auth_attempts').run();

  const issued = await call({ action: 'forgot_password', email });
  assert.equal(issued.body.success, true);
  assert.match(deliveredCode, /^\d{6}$/);
  const firstCode = deliveredCode;
  const row = await db.prepare('SELECT * FROM password_resets').first();
  assert.equal(row.token_hash, await digest(`reset-code:${email}:${firstCode}`));
  assert.ok(Date.parse(row.expires_at) - Date.now() <= 600000);
  assert.ok(Date.parse(row.expires_at) - Date.now() > 590000);
  assert.equal((await reset(firstCode, 'other@example.test')).body.success, false);
  assert.equal((await reset('abc123')).body.success, false);

  await db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind('old-session', 'otp-user', Date.now() + 600000).run();
  assert.equal((await reset(firstCode)).body.success, true);
  assert.ok(await verifyPassword('Updated-password-123', (await db.prepare('SELECT password FROM profiles').first()).password));
  assert.equal(await db.prepare('SELECT * FROM auth_sessions').first(), null);
  assert.equal((await reset(firstCode)).body.success, false);

  await clearAttempts();
  await call({ action: 'forgot_password', email });
  await db.prepare("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00Z'").run();
  assert.equal((await reset(deliveredCode)).body.success, false);
  assert.equal(await db.prepare('SELECT * FROM password_resets').first(), null);

  await clearAttempts();
  await call({ action: 'forgot_password', email });
  const oldHash = (await db.prepare('SELECT token_hash FROM password_resets').first()).token_hash;
  await call({ action: 'forgot_password', email });
  assert.equal(await db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').bind(oldHash).first(), null);
  const currentCode = deliveredCode;
  for (let index = 0; index < 5; index++) {
    const wrongCode = String((Number(currentCode) + index + 1) % 1000000).padStart(6, '0');
    assert.equal((await reset(wrongCode)).body.success, false);
  }
  assert.equal((await reset(currentCode)).status, 429);

  await clearAttempts();
  deliveryFails = true;
  assert.equal((await call({ action: 'forgot_password', email })).body.success, true);
  assert.equal(await db.prepare('SELECT * FROM password_resets').first(), null);
  assert.deepEqual((await call({ action: 'forgot_password', email: 'missing@example.test' })).body, issued.body);
  await clearAttempts();
  deliveryFails = false;
  await call({ action: 'forgot_password', email });
  const verificationCode = deliveredCode;
  const exchange = () => call({ action: 'verify_reset_code', email, code: verificationCode });
  const exchanges = await Promise.all([exchange(), exchange()]);
  const successful = exchanges.filter(result => result.body.success);
  assert.equal(successful.length, 1, 'Only one verification can consume the code');
  const grant = successful[0].body.token;
  assert.match(grant, /^[a-f0-9]{64}$/);
  assert.equal((await db.prepare('SELECT token_hash FROM password_resets').first()).token_hash, await digest(grant));
  assert.equal((await call({ action: 'reset_password', token: grant, password: 'Verified-password-456' })).body.success, true);
  assert.equal((await call({ action: 'reset_password', token: grant, password: 'Another-password-789' })).body.success, false);
  assert.ok(await verifyPassword('Verified-password-456', (await db.prepare('SELECT password FROM profiles').first()).password));
  await clearAttempts();
  await call({ action: 'forgot_password', email });
  await db.prepare("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00Z'").run();
  assert.equal((await call({ action: 'verify_reset_code', email, code: deliveredCode })).body.success, false);
  console.log('PASS: atomic code verification, expiring reset grant and single-use password update');
  console.log('PASS: code delivery, email binding, expiry, single use, session revocation, resend, rate limit, delivery failure, generic response');
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}
