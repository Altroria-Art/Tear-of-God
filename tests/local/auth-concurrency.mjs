import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as auth } from '../../functions/api/auth.js';
import { digest, hashPassword, verifyPassword } from '../../functions/lib/session.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("auth races"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));

// Deliberately control the gap between a read and its later write. This makes
// stale token/password races reproducible instead of depending on CPU timing.
function intercept(db, { afterFirst = async () => {}, beforeBatch = async () => {} } = {}) {
  const wrap = (statement, sql) => ({
    statement, sql,
    bind(...values) { return wrap(statement.bind(...values), sql); },
    async first(...args) {
      const result = await statement.first(...args);
      await afterFirst(sql, result);
      return result;
    },
    all: (...args) => statement.all(...args),
    run: (...args) => statement.run(...args),
  });
  return {
    prepare: sql => wrap(db.prepare(sql), sql),
    async batch(statements) {
      await beforeBatch(statements.map(statement => statement.sql));
      return db.batch(statements.map(statement => statement.statement));
    },
  };
}

let requestNumber = 0;
async function call(db, body, user = null) {
  const request = new Request('https://auth-concurrency.test/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `local-test-${++requestNumber}` },
    body: JSON.stringify(body),
  });
  const response = await auth({ request, env: { tear_of_god_db: db }, data: { user } });
  return { response, body: await response.json() };
}

try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const originalPassword = 'Initial-password-123';
  const originalHash = await hashPassword(originalPassword);
  const profile = { id: 'race-user', email: 'race@example.test' };
  await db.prepare('INSERT INTO profiles (id, username, email, password) VALUES (?, ?, ?, ?)')
    .bind(profile.id, 'Race user', profile.email, originalHash).run();

  const seedReset = async (token, expiresAt = new Date(Date.now() + 60_000).toISOString()) => {
    await db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), profile.id, await digest(token), expiresAt).run();
  };
  const storedPassword = async () => (await db.prepare('SELECT password FROM profiles WHERE id = ?').bind(profile.id).first()).password;
  const seedSession = () => db.prepare('INSERT OR REPLACE INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind('session-before-password-change', profile.id, Date.now() + 60_000).run();

  const sharedToken = 'a'.repeat(64);
  await seedReset(sharedToken);
  await seedSession();
  let readers = 0;
  let releaseReads;
  const bothRead = new Promise(resolve => { releaseReads = resolve; });
  const racingDb = intercept(db, { afterFirst: async sql => {
    if (sql.includes('FROM password_resets WHERE token_hash')) {
      if (++readers === 2) releaseReads();
      await bothRead;
    }
  } });
  const passwords = ['First-reset-password-123', 'Second-reset-password-123'];
  const results = await Promise.all(passwords.map(password => call(racingDb, { action: 'reset_password', token: sharedToken, password })));
  assert.deepEqual(results.map(result => result.response.status).sort(), [200, 400], 'only one simultaneous reset can succeed');
  const winner = results.findIndex(result => result.response.status === 200);
  assert.equal(await verifyPassword(passwords[winner], await storedPassword()), true);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first()).n, 0);

  // Expiry can occur while PBKDF2 is running; the mutation must recheck it.
  const expiresDuringHash = 'b'.repeat(64);
  await seedReset(expiresDuringHash);
  const beforeExpiredReset = await storedPassword();
  const expiringDb = intercept(db, { afterFirst: async sql => {
    if (sql.includes('FROM password_resets WHERE token_hash')) {
      await db.prepare("UPDATE password_resets SET expires_at = datetime('now', '-1 minute') WHERE token_hash = ?")
        .bind(await digest(expiresDuringHash)).run();
    }
  } });
  assert.equal((await call(expiringDb, { action: 'reset_password', token: expiresDuringHash, password: 'Too-late-password-123' })).response.status, 400);
  assert.equal(await storedPassword(), beforeExpiredReset);

  // Invalid stored expiry is rejected rather than becoming a never-expiring link.
  const malformedToken = 'c'.repeat(64);
  await seedReset(malformedToken, 'not-a-date');
  assert.equal((await call(db, { action: 'reset_password', token: malformedToken, password: 'Malformed-expiry-123' })).response.status, 400);

  await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(originalHash, profile.id).run();
  const outstandingToken = 'd'.repeat(64);
  await seedReset(outstandingToken);
  await seedSession();
  const changed = await call(db, { action: 'update_profile', currentPassword: originalPassword, password: 'Changed-password-123' }, profile);
  assert.equal(changed.response.status, 200);
  assert.ok(changed.response.headers.get('Set-Cookie'));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ?').bind(profile.id).first()).n, 0);
  assert.equal(await db.prepare('SELECT token_hash FROM auth_sessions WHERE token_hash = ?').bind('session-before-password-change').first(), null);
  assert.equal((await call(db, { action: 'reset_password', token: outstandingToken, password: originalPassword })).response.status, 400);

  // A stale current-password read cannot overwrite a completed password reset.
  await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(originalHash, profile.id).run();
  const replacedHash = await hashPassword('Password-set-by-another-reset-123');
  const staleChangeDb = intercept(db, { afterFirst: async sql => {
    if (sql === 'SELECT password FROM profiles WHERE id = ?') {
      await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(replacedHash, profile.id).run();
    }
  } });
  assert.equal((await call(staleChangeDb, { action: 'update_profile', currentPassword: originalPassword, password: 'Stale-change-123' }, profile)).response.status, 409);
  assert.equal(await storedPassword(), replacedHash);

  // Nor can a login verified before a reset create a session afterward.
  await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(originalHash, profile.id).run();
  await db.prepare('DELETE FROM auth_sessions').run();
  const staleLoginDb = intercept(db, { beforeBatch: async statements => {
    if (statements.some(sql => sql.includes('INSERT INTO auth_sessions'))) {
      await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(replacedHash, profile.id).run();
    }
  } });
  const staleLogin = await call(staleLoginDb, { action: 'login', email: profile.email, password: originalPassword });
  assert.equal(staleLogin.response.status, 401);
  assert.equal(staleLogin.response.headers.has('Set-Cookie'), false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first()).n, 0);
  console.log('Auth concurrency passed: single-use reset, expiry at commit, malformed expiry, outstanding reset revocation, stale password change and stale login rejection.');
} finally {
  await mf.dispose();
}
