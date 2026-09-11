// Shared authentication utilities for Cloudflare Pages Functions.
// Sessions are opaque, random bearer tokens. Only a SHA-256 digest is stored
// in D1, so a database export cannot be replayed as a user session.

const PASSWORD_ITERATIONS = 310000;
const FIREBASE_PROJECT_ID = 'tear-of-god';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let firebaseKeysCache = null;
let firebaseKeysPromise = null;

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash) return { valid: false, needsUpgrade: false };

  const parts = storedHash.split('$');
  if (parts.length === 4 && parts[0] === 'pbkdf2-sha256') {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000) return { valid: false, needsUpgrade: false };
    try {
      const salt = base64UrlDecode(parts[2]);
      const expected = base64UrlDecode(parts[3]);
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const actual = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8,
      ));
      return { valid: constantTimeEqual(actual, expected), needsUpgrade: iterations < PASSWORD_ITERATIONS };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // Existing users used unsalted SHA-256. Let them sign in once, then upgrade
  // their stored password immediately to PBKDF2 without forcing a reset.
  const legacy = await sha256Hex(password);
  return { valid: constantTimeEqual(new TextEncoder().encode(legacy), new TextEncoder().encode(storedHash)), needsUpgrade: true };
}

function newSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createSession(db, userId) {
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  await db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))",
  ).bind(crypto.randomUUID(), userId, tokenHash).run();
  return token;
}

function bearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

export async function getSessionUser(request, env) {
  const token = bearerToken(request);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  return env.tear_of_god_db.prepare(`
    SELECT p.id, p.username, p.email, p.bio, p.avatar_url, p.university, p.faculty, p.major, p.year, p.role,
           s.id AS session_id
    FROM sessions s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first();
}

export async function revokeSession(request, env) {
  const token = bearerToken(request);
  if (!token) return;
  await env.tear_of_god_db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
}

export async function requireUser(request, env) {
  return getSessionUser(request, env);
}

export async function requireAdmin(request, env) {
  const user = await getSessionUser(request, env);
  return user?.role === 'admin' ? user : null;
}

async function firebaseJwks() {
  const now = Date.now();
  if (firebaseKeysCache?.expiresAt > now) return firebaseKeysCache.keys;
  if (!firebaseKeysPromise) {
    firebaseKeysPromise = fetch(FIREBASE_JWKS_URL)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to retrieve Firebase signing keys');
        const data = await response.json();
        if (!Array.isArray(data.keys)) throw new Error('Firebase signing keys are invalid');
        firebaseKeysCache = { keys: data.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
        return data.keys;
      })
      .finally(() => { firebaseKeysPromise = null; });
  }
  return firebaseKeysPromise;
}

export async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== 'string') throw new Error('Missing Firebase ID token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase ID token');

  let header;
  let claims;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    throw new Error('Invalid Firebase ID token');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== 'RS256' || !header.kid ||
    claims.aud !== FIREBASE_PROJECT_ID ||
    claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
    typeof claims.sub !== 'string' || !claims.sub ||
    !Number.isFinite(claims.exp) || claims.exp <= now ||
    !Number.isFinite(claims.iat) || claims.iat > now + 300
  ) {
    throw new Error('Firebase ID token validation failed');
  }

  const jwk = (await firebaseJwks()).find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256');
  if (!jwk) throw new Error('Firebase signing key was not found');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error('Firebase ID token signature is invalid');
  return claims;
}
