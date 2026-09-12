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

function parseRows(body, key, fallback) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return key ? (parsed[key] || []) : (Array.isArray(parsed) ? parsed : []);
  } catch {
    return fallback || [];
  }
}

export function setup() {
  const results = { rankingId: null, templateId: null, userId: null };

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

// ── Unique user ID per VU for write operations ──
export function vuUserId() {
  return `loadtest-vu-${__VU}-${__ITER}`;
}

export function vuUserIdStable() {
  return `loadtest-vu-${__VU}`;
}
