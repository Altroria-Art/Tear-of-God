// Trending candidate-pool cache (Batch 3 L1 + Batch 4 L2) — raw ranking IDs only.
//
// What is cached: `[rankingId, ...]` (≤ HOME_POOL_CAP entries), nothing else.
// NEVER cached here: full responses, user_vote, is_following, session/user
// data, profiles, affinity, or any personalized signal. After a hit the
// caller still runs page slicing, detail SELECT, enrichment, and per-user
// vote/follow lookups per request exactly as before, so authenticated
// responses stay private,no-store via the existing middleware.
//
// Layers:
//   L1 — per-seed (Batch 3): key pins the feed seed, TTL 180s. Serves page1→
//        page2→page3 of one feed session.
//   L2 — shared unfiltered home-trending (Batch 4): key has NO seed, TTL 5s.
//        Serves new seeds/sessions opened within seconds of each other.
// Scope: feed_type=trending ONLY. for_you/following candidate selection
// depends on user-specific state and must not use this path.
// Internal pool cache only — API response Cache-Control headers are untouched.

export const TRENDING_POOL_CACHE_VERSION = 'v2';

// Seed lifetime = one HomeFeed mount (a few minutes of scrolling; refresh or a
// new mount mints a new seed and therefore misses by construction). 180s
// covers any realistic infinite-scroll session while bounding garbage.
export const TRENDING_POOL_CACHE_TTL_SECONDS = 180;

// L2: shared unfiltered home-trending pool. 5s max (Batch 4 cap): L1 already
// covers infinite scroll, so L2 only absorbs bursts of new seeds/sessions
// opened within seconds of each other. A new session may reuse a pool stale
// by at most 5s — but shuffle still uses its own fresh seed, so ordering is
// always per-session.
export const SHARED_HOME_TRENDING_TTL_SECONDS = 5;
export const SHARED_HOME_TRENDING_VERSION = 'v3';

// Recent-result memory bridge (Phase 0 fix): covers the post-D1/pre-put
// window where the in-flight entry is already gone but the Cache API write
// has not committed yet. Short TTL (≤ L2 TTL so the shared freshness bound
// always holds) + size cap; a miss falls back to cache/D1. Feed correctness
// never depends on this memory.
const RECENT_POOL_TTL_MS = 5 * 1000;
const MAX_RECENT_POOLS = 200;
const recentPools = new Map(); // key -> { ids, expiresAt }

export function getRecentPool(key) {
  const entry = recentPools.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    recentPools.delete(key);
    return null;
  }
  return entry.ids;
}

export function setRecentPool(key, ids) {
  if (recentPools.size >= MAX_RECENT_POOLS) {
    const oldest = recentPools.keys().next().value;
    if (oldest !== undefined) recentPools.delete(oldest);
  }
  recentPools.set(key, { ids, expiresAt: Date.now() + RECENT_POOL_TTL_MS });
}

export function removeRecentPool(key) {
  recentPools.delete(key);
}

// Same-isolate in-flight dedup for concurrent cache misses (no distributed
// locking — correctness first; a stampede only costs duplicate D1 queries,
// never wrong data). Bounded so a missed cleanup can never leak memory.
const inflightPools = new Map();
const MAX_INFLIGHT_POOLS = 100;

// Cache key = every input that changes the pool SQL, and nothing else.
// Deliberately EXCLUDED (proven from functions/api/rankings.js):
//   - page/offset/limit: slicing happens after the pool is built.
//   - pin/exclude: applied in JS after the pool SQL (exclude filter, then
//     shuffle, then pin prepend) — same cached pool serves any pin/exclude.
//   - seed-adjacent shuffle: seed selects the shuffle order, not pool rows,
//     but IS included so manual refresh (new seed) always re-queries a fresh
//     pool — refresh behavior stays bit-identical to before this change.
//   - user/session/cookie: the trending pool SQL has no user-dependent input.
export function buildTrendingPoolKey({ feedType, seed, hashtag, authorId, templateId, days, poolCap }) {
  return [
    TRENDING_POOL_CACHE_VERSION,
    feedType ?? '',
    String((seed ?? 0) >>> 0),
    hashtag ?? '',
    authorId ?? '',
    templateId ?? '',
    String(days ?? 0),
    String(poolCap),
  ].join('|');
}

// L2 eligibility: EXACT unfiltered home trending only. Mirrors the pool
// builder conditions in functions/api/rankings.js one by one:
//   - feed_type must be trending (for_you/following carry user predicates)
//   - hashtag/authorId/templateId/days must all be filter-absent,
//     using the SAME truthiness the builder uses (empty hashtag string and
//     '' hashtag mean "no filter" there, so they mean eligible here).
export function isSharedHomeTrendingEligible({ feedType, hashtag, authorId, templateId, days }) {
  if (feedType !== 'trending') return false;
  if (hashtag) return false;
  if (authorId) return false;
  if (templateId) return false;
  if (days) return false;
  return true;
}

// L2 key: NO seed (the pool SQL does not depend on it), NO page/pin/exclude
// (applied after the pool), NO user/session. Version + marker + pool cap only.
export function buildSharedHomeTrendingKey({ poolCap }) {
  return [SHARED_HOME_TRENDING_VERSION, 'shared-home-trending', String(poolCap)].join('|');
}

export function trendingPoolCacheRequest(origin, key) {
  return new Request(
    `${origin}/api/__trending_pool__?k=${encodeURIComponent(key)}`,
    { method: 'GET' },
  );
}

// Returns string[] on hit, null on miss/error. Cache failure never throws.
export async function readTrendingPool(cache, cacheRequest) {
  try {
    if (!cache) return null;
    const hit = await cache.match(cacheRequest);
    if (!hit) return null;
    const body = await hit.json();
    if (!body || !Array.isArray(body.ids)) return null;
    return body.ids.filter((id) => typeof id === 'string' && id.length > 0);
  } catch {
    return null;
  }
}

// Best-effort write. Cache failure never throws and never fails the feed.
// Returns true when the write was committed/initiated, false when there was
// no cache or the synchronous put failed (callers evict their recent bridge
// on false so the next request truly falls back to D1).
export async function writeTrendingPool(cache, cacheRequest, ids, waitUntil, ttlSeconds = TRENDING_POOL_CACHE_TTL_SECONDS) {
  try {
    if (!cache) return false;
    const response = new Response(JSON.stringify({ ids }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttlSeconds}`,
      },
    });
    if (typeof waitUntil === 'function') {
      waitUntil(cache.put(cacheRequest, response).catch(() => {}));
      return true;
    }
    await cache.put(cacheRequest, response);
    return true;
  } catch {
    // Cache is an optimization only — the feed works identically on miss.
    return false;
  }
}

// Share one D1 pool query between concurrent same-key misses in this isolate.
export async function runPoolQueryDeduped(key, queryFn) {
  const existing = inflightPools.get(key);
  if (existing) return existing;
  const pending = (async () => {
    try {
      return await queryFn();
    } finally {
      inflightPools.delete(key);
    }
  })();
  if (inflightPools.size < MAX_INFLIGHT_POOLS) inflightPools.set(key, pending);
  return pending;
}

// ---------------------------------------------------------------------------
// Cache observability (Batch 9): structured, sampled, PII-free summary logs.
//
// Rules enforced here, not by convention:
//   - field allowlist is fixed below: enums, booleans, counts, durations,
//     colo code, version strings. No ids, URLs, users, sessions, payloads.
//   - at most 1 log per measured request (callers emit one summary).
//   - sampling is the ONLY layer (no platform head sampling is configured in
//     this repo — verified: wrangler.toml has no observability section), so
//     no nested Math.random() stacking. Default 1%; override via the
//     CACHE_METRIC_SAMPLE_RATE runtime var (no config-file change needed).
//   - zero D1/KV/R2/queue writes. Logging can never fail a request.
// ---------------------------------------------------------------------------
export const CACHE_METRIC_SAMPLE_RATE = 0.01;
export const CACHE_METRIC_VERSION = 'v1';

function metricSampleRate(env, override) {
  if (override !== undefined) return override;
  const parsed = Number(env?.CACHE_METRIC_SAMPLE_RATE);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return CACHE_METRIC_SAMPLE_RATE;
}

export function shouldSampleMetric(env, override) {
  const rate = metricSampleRate(env, override);
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return Math.random() < rate;
}

export function requestColo(request) {
  try {
    return request?.cf?.colo || null;
  } catch {
    return null;
  }
}

// Trending pool summary. l1/l2 are HIT (served without D1, Cache API entry or
// the in-isolate bridge — both mean same-seed reuse), MISS, or SKIP (path
// does not consult that layer: non-trending feeds, filtered L2). Cache-layer
// errors surface as MISS + d1_build:true because the fallback D1 build is
// what actually happened — the error itself stays on the existing warn log.
export function trendingPoolMetric({ l1, l2, d1Build, eligible, feedType, poolSize, ms, colo }) {
  const entry = {
    event: 'cache_metric',
    component: 'trending_pool',
    version: CACHE_METRIC_VERSION,
    feed_type: feedType,
    eligible: !!eligible,
    l1,
    l2,
    d1_build: !!d1Build,
    pool_size: Number(poolSize) || 0,
    pool_ms: Math.max(0, Math.round(Number(ms) || 0)),
  };
  if (colo) entry.colo = String(colo);
  return entry;
}

export function spotlightsMetric({ result, colo }) {
  const entry = {
    event: 'cache_metric',
    component: 'spotlights',
    version: CACHE_METRIC_VERSION,
    layer: 'cache_api',
    result,
  };
  if (colo) entry.colo = String(colo);
  return entry;
}

export function emitCacheMetric(sink, entry) {
  try {
    sink.log(JSON.stringify(entry));
  } catch {
    // Telemetry must never break the request it measures.
  }
}
