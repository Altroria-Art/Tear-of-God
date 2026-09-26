// Trending's persisted "seen" history. Previously seen cards were tracked only in
// HomeFeed's in-memory seenFeedIdsRef, so an F5 lost everything and a reload
// reshuffled already-seen cards back to the top. Now Trending remembers what the
// user actually saw (viewport-confirmed, see SeenCardObserver in HomeFeed.jsx) in
// localStorage, keyed per viewer. Entries are { id, seenAt } only — never the full
// ranking object. Keep every unexpired id: a count cap would resurrect seen cards.

export const TRENDING_SEEN_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const TRENDING_SEEN_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export const TRENDING_SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TRENDING_SEEN_EXCLUDE_MAX = 100;

const SQLITE_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/;
export function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const m = SQLITE_DATETIME.exec(raw);
  const d = new Date(m ? `${m[1]}T${m[2]}Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function trendingSeenKey(userId) {
  return `tog:trending-seen:${userId || 'guest'}`;
}

function readEntries(userId) {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(trendingSeenKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Drop entries older than the TTL, de-duplicate by ranking id (latest seenAt wins)
// without evicting unexpired ids. The returned list is
// sorted by seenAt ascending so slice(-N) always selects the most recently seen.
export function pruneTrendingSeen(entries, now = Date.now()) {
  const cutoff = now - TRENDING_SEEN_TTL_MS;
  const latestById = new Map();
  for (const entry of (entries || [])) {
    if (!entry || !entry.id) continue;
    const seenAt = Number(entry.seenAt);
    if (!Number.isFinite(seenAt) || seenAt <= 0 || seenAt < cutoff) continue;
    const prev = latestById.get(entry.id);
    if (!prev || seenAt > prev.seenAt) latestById.set(entry.id, { id: entry.id, seenAt });
  }
  const list = [...latestById.values()]
    .sort((a, b) => a.seenAt - b.seenAt)
    .slice(-2000); // cap max size to prevent localStorage bloat
  return list;
}

export function loadTrendingSeen(userId) {
  const raw = readEntries(userId);
  const pruned = pruneTrendingSeen(raw);
  if (pruned.length !== raw.length) {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(trendingSeenKey(userId), JSON.stringify(pruned));
      } catch {
        // storage full / blocked — history stays session-only
      }
    }
  }
  return pruned;
}

export function persistTrendingSeen(userId, entries) {
  const pruned = pruneTrendingSeen(entries);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(trendingSeenKey(userId), JSON.stringify(pruned));
    } catch {
      // storage full / blocked — seen history stays session-only
    }
  }
  return pruned;
}

// Comma-separated ids seen within the 6-hour cooldown window.
// Sent via `exclude` so they are strictly excluded from Trending.
export function trendingSeenExclude(target, limit = TRENDING_SEEN_EXCLUDE_MAX, now = Date.now()) {
  const entries = Array.isArray(target) ? target : loadTrendingSeen(target);
  const cooldownCutoff = now - TRENDING_SEEN_COOLDOWN_MS;
  return entries
    .filter((entry) => Number(entry.seenAt) >= cooldownCutoff)
    .slice(-limit)
    .map((entry) => entry.id)
    .join(',');
}

// Comma-separated ids seen before the 6-hour cooldown window (>= 6 hours ago).
// Sent via `seen` so the backend can serve them as fallback when unseen is exhausted.
export function trendingSeenFallback(target, limit = TRENDING_SEEN_EXCLUDE_MAX, now = Date.now()) {
  const entries = Array.isArray(target) ? target : loadTrendingSeen(target);
  const cooldownCutoff = now - TRENDING_SEEN_COOLDOWN_MS;
  return entries
    .filter((entry) => Number(entry.seenAt) < cooldownCutoff)
    .slice(-limit)
    .map((entry) => entry.id)
    .join(',');
}

export function filterUnseenTrending(posts, entries, existingIds = [], now = Date.now()) {
  const cooldownCutoff = now - TRENDING_SEEN_COOLDOWN_MS;
  const recentSeenIds = new Set(
    pruneTrendingSeen(entries || [], now)
      .filter((entry) => Number(entry.seenAt) >= cooldownCutoff)
      .map((entry) => entry.id)
  );
  const blocked = new Set([...recentSeenIds, ...(existingIds || [])]);
  return (posts || []).filter((post) => {
    if (!post?.id || blocked.has(post.id)) return false;
    if (post.created_at) {
      const d = parseDate(post.created_at);
      if (d && (now - d.getTime()) > TRENDING_SEEN_MAX_AGE_MS) {
        return false;
      }
    }
    blocked.add(post.id);
    return true;
  });
}

// Advance over entirely filtered pages, keeping seed/exclude fixed for stable offsets.
// Safeguarded with MAX_AUTO_REFILL_ATTEMPTS to strictly avoid request storms.
export async function fetchUnseenTrendingPage(fetchPage, { page = 1, limit, getSeen, existingIds = [], cancelled = () => false, maxAttempts = 2 }) {
  const visited = new Set();
  let attempts = 0;
  const MAX_AUTO_REFILL_ATTEMPTS = Math.max(1, maxAttempts || 2);
  while (!cancelled() && attempts < MAX_AUTO_REFILL_ATTEMPTS) {
    attempts += 1;
    const result = await fetchPage(page);
    if (cancelled() || result.error || result.success === false) return { ...result, page };
    const raw = result.data || [];
    // If backend returns empty [], stop immediately! Do NOT retry loop!
    if (raw.length === 0) {
      return { ...result, data: [], page, hasMore: false };
    }
    const data = filterUnseenTrending(raw, getSeen(), existingIds);
    const hasMore = raw.length === limit;
    if (data.length || !hasMore) return { ...result, data, page, hasMore };
    const signature = JSON.stringify(raw.map((post) => post.id));
    if (visited.has(signature)) return { ...result, data: [], page, hasMore: false };
    visited.add(signature);
    page += 1;
  }
  return { data: [], page, hasMore: false };
}
