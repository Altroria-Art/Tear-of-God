import { clientAddress, consumeMemoryRateLimit } from './request-guard.js';

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const COOKIE = 'tog_session';
const encoder = new TextEncoder();

let lastAttemptCleanup = 0;

export const PROFILE_FIELDS = 'id, username, email, bio, avatar_url, university, faculty, major, year, role';

export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}

export function sessionToken(request) {
  const value = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}

export function sessionCookie(request, token, seconds = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

export async function readSession(request, db) {
  const token = sessionToken(request);
  if (!token) return null;
  return db.prepare(`SELECT ${PROFILE_FIELDS.split(', ').map(f => `p.${f}`).join(', ')}
    FROM auth_sessions s JOIN profiles p ON p.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(await digest(token), Date.now()).first();
}

export async function createSession(request, db, userId) {
  const token = randomToken();
  const old = sessionToken(request);
  const statements = [db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(Date.now())];
  if (old) statements.push(db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(old)));
  statements.push(db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(token), userId, Date.now() + SESSION_SECONDS * 1000));
  await db.batch(statements);
  return sessionCookie(request, token);
}

export async function hashPassword(password, salt = randomToken().slice(0, 32), iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  // Workers Web Crypto supports PBKDF2 natively, without Node dependencies.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256);
  const hash = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (/^[a-f0-9]{64}$/.test(stored)) return equal(await digest(password), stored);
  const match = /^pbkdf2-sha256\$(\d+)\$([a-f0-9]{32})\$[a-f0-9]{64}$/.exec(stored);
  return !!match && equal(await hashPassword(password, match[2], parseInt(match[1], 10)), stored);
}

export async function allowAuthAttempt(request, db, identity, { scope = 'auth', limit = 20, windowSeconds = 900 } = {}) {
  const now = Date.now();
  const ipGate = consumeMemoryRateLimit(`auth-ip:${scope}`, clientAddress(request), {
    limit: Math.max(limit * 4, 20),
    windowSeconds,
  });
  if (!ipGate.allowed) return ipGate;

  const windowMs = windowSeconds * 1000;
  const window = Math.floor(now / windowMs);
  const expiresAt = (window + 1) * windowMs;
  const key = await digest(`${scope}:${identity}:${window}`);
  const [result] = await db.batch([
    db.prepare(`INSERT INTO auth_attempts (key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`).bind(key, expiresAt),
  ]);

  // Cleanup is best-effort and sampled so cold starts do not add a second D1 write to every auth request.
  if (now - lastAttemptCleanup > 60 * 60 * 1000 && Math.random() < 0.01) {
    lastAttemptCleanup = now;
    await db.prepare('DELETE FROM auth_attempts WHERE expires_at < ?').bind(now).run();
  }

  return {
    allowed: (result.results[0]?.attempts || 0) <= limit,
    retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
}
