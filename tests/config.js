import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8788';

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
