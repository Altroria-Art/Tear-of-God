import http from 'k6/http';
import { check } from 'k6';

const DEFAULT_BASE_URL = 'http://localhost:8788';
const PRODUCTION_HOSTNAMES = new Set([
  'tear-of-god.pages.dev',
]);

export const BASE_URL = (__ENV.BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

function hostnameFromUrl(value) {
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:?#]+)(?::\d+)?(?:[/?#]|$)/i.exec(value);
  return match ? match[1].replace(/^\[|\]$/g, '').toLowerCase() : null;
}

const targetHostname = hostnameFromUrl(BASE_URL);
const mutationFlag = (__ENV.ALLOW_MUTATIONS || '').trim().toLowerCase();
const isProductionHostname = targetHostname && (
  PRODUCTION_HOSTNAMES.has(targetHostname)
  || targetHostname.endsWith('.tear-of-god.pages.dev')
);
const isLoopbackHostname = ['localhost', '127.0.0.1', '::1'].includes(targetHostname);

if (!targetHostname) {
  throw new Error('BASE_URL must be an explicit http(s) URL');
}
if (mutationFlag && mutationFlag !== 'true' && mutationFlag !== 'false') {
  throw new Error('ALLOW_MUTATIONS must be exactly true or false');
}
if (mutationFlag === 'true' && isProductionHostname) {
  throw new Error(`Mutation tests are blocked for production hostname: ${targetHostname}`);
}
if (mutationFlag === 'true' && !isLoopbackHostname) {
  throw new Error('Mutation tests are allowed only against localhost/loopback targets');
}

// Mutation traffic is opt-in and local-only. The default test mix remains read-only.
export const MUTATIONS_ENABLED = mutationFlag === 'true';

function authPayload(body) {
  return JSON.stringify(body);
}

function createLocalAuthSessions(runId) {
  const requestedPoolSize = Number.parseInt(__ENV.AUTH_POOL_SIZE || '5', 10);
  if (!Number.isInteger(requestedPoolSize) || requestedPoolSize < 1 || requestedPoolSize > 10) {
    throw new Error('AUTH_POOL_SIZE must be an integer from 1 to 10');
  }

  const sessions = [];
  for (let index = 0; index < requestedPoolSize; index += 1) {
    const email = `k6-${runId}-${index}@example.test`;
    const password = `K6!Local-${runId}-${index}`;
    const register = http.post(`${BASE_URL}/api/auth`, authPayload({
      action: 'register',
      email,
      password,
      username: `k6-${runId}-${index}`.slice(0, 50),
    }), { headers: { 'Content-Type': 'application/json' } });
    const registered = check(register, {
      'local test account registered or already exists': (response) => response.status === 201 || response.status === 409,
    });
    if (!registered) throw new Error(`Unable to register isolated local test account ${index}`);

    const login = http.post(`${BASE_URL}/api/auth`, authPayload({ action: 'login', email, password }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const token = login.cookies.tog_session?.[0]?.value;
    const loggedIn = check(login, {
      'local test account login succeeds': (response) => response.status === 200 && response.json().success === true,
      'login returns tog_session cookie': () => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token),
    });
    if (!loggedIn) throw new Error(`Unable to create authenticated local test session ${index}`);

    const restored = http.get(`${BASE_URL}/api/auth`, { cookies: { tog_session: token } });
    const sessionRestored = check(restored, {
      'local test session restores': (response) => response.status === 200 && response.json().data?.email === email,
    });
    if (!sessionRestored) throw new Error(`Unable to restore authenticated local test session ${index}`);
    sessions.push(token);
  }
  return sessions;
}

function parseRows(body, key, fallback) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return key ? (parsed[key] || []) : (Array.isArray(parsed) ? parsed : []);
  } catch {
    return fallback || [];
  }
}

export function setup() {
  const rawRunId = String(__ENV.TEST_RUN_ID || Date.now());
  const runId = rawRunId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
  if (!runId) throw new Error('TEST_RUN_ID must contain at least one letter, number, underscore, or hyphen');
  const results = { rankingId: null, templateId: null, userId: null, runId, authSessions: [] };

  const res = http.get(`${BASE_URL}/api/rankings?sort=newest&limit=3`);
  if (res.status === 200) {
    const rows = parseRows(res.body, 'data');
    if (rows.length > 0) {
      results.rankingId = rows[0].id;
      results.userId = rows[0].user_id;
    }
  }

  const tplRes = http.get(`${BASE_URL}/api/templates?sort=popular&limit=3`);
  if (tplRes.status === 200) {
    const rows = parseRows(tplRes.body, 'data');
    if (rows.length > 0) {
      results.templateId = rows[0].id;
    }
  }

  if (MUTATIONS_ENABLED) results.authSessions = createLocalAuthSessions(runId);

  return results;
}

// ── Shared thresholds (override per scenario via export const options) ──
export const defaultThresholds = {
  http_req_duration: ['p(95)<800', 'p(99)<1500'],
  http_req_failed: ['rate<0.1'],
  http_reqs: ['rate>3'],
};

// ── Seed helpers: fetch real IDs from DB so tests hit real rows ──
// Called inside default() with data from setup(). No HTTP in init context.
export function getSeedIds(data) {
  const rankingId = data?.rankingId;
  const templateId = data?.templateId;
  const userId = data?.userId;
  return { rankingId, templateId, userId };
}

// ── Check helpers ──
export function checkOk(res, label) {
  return check(res, {
    [`${label} status 200`]: (r) => r.status === 200,
    [`${label} has success=true`]: (r) => {
      try { return r.json().success === true; } catch { return false; }
    },
    [`${label} response < 2s`]: (r) => r.timings.duration < 2000,
  });
}

// ── Authenticated local mutation helper ──
export function getMutationSession(data) {
  if (!MUTATIONS_ENABLED) throw new Error('Mutation session requested without ALLOW_MUTATIONS=true');
  const sessions = data?.authSessions;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new Error('Mutation tests require exported setup() and authenticated local sessions');
  }
  const token = sessions[(__VU - 1) % sessions.length];
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('Invalid local mutation session');
  return { cookies: { tog_session: token } };
}
