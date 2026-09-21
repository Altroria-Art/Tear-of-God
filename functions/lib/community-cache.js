// Cache only public community aggregates, never viewer state. Per-template keys
// let different feed pages reuse the same work. Five seconds bounds staleness.
// Share only pending public reads, with the same origin/template isolation as
// Cache API keys. Fresh pinned requests must never join an older pending read.
const pendingTemplates = new Map();
const MAX_PENDING_TEMPLATES = 256;

async function loadCommunityEntries(db, ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [{ results: uses }, { results: histogram }] = await Promise.all([
    db.prepare(`SELECT template_id, COUNT(*) AS uses FROM rankings
      WHERE template_id IN (${placeholders}) GROUP BY template_id`).bind(...ids).all(),
    db.prepare(`SELECT r.template_id, ri.item_id, ri.tier, COUNT(*) AS placements
      FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
      WHERE r.template_id IN (${placeholders}) AND ri.tier IS NOT NULL
      GROUP BY r.template_id, ri.item_id, ri.tier`).bind(...ids).all(),
  ]);
  const byId = new Map(ids.map(id => [id, { uses: 0, histogram: [], expiresAt: Date.now() + 5000 }]));
  for (const row of uses) byId.get(row.template_id).uses = Number(row.uses) || 0;
  for (const row of histogram) byId.get(row.template_id).histogram.push(row);
  return byId;
}

export async function feedCommunityStats(context, db, templateIds, { fresh = false } = {}) {
  if (!templateIds.length) return { templateUseRows: [], communityHistogram: [] };
  const cache = fresh ? null : globalThis.caches?.default;
  const origin = new URL(context.request.url).origin;
  const keys = templateIds.map(id => new Request(`${origin}/api/__community_stats_v1?template=${encodeURIComponent(id)}`));
  const entries = await Promise.all(keys.map(async key => {
    try {
      const hit = await cache?.match(key);
      if (hit) {
        const entry = await hit.json();
        if (entry.expiresAt > Date.now() && Array.isArray(entry.histogram) && Number.isFinite(entry.uses)) return entry;
      }
    } catch { /* Cache failure falls back to D1. */ }
    return null;
  }));
  const missing = templateIds.filter((_, index) => !entries[index]);
  if (missing.length) {
    const keyFor = id => `${origin}/api/__community_stats_v1?template=${encodeURIComponent(id)}`;
    const waiting = new Map();
    const own = [];
    for (const id of missing) {
      const pending = !fresh && pendingTemplates.get(keyFor(id));
      if (pending) waiting.set(id, pending);
      else own.push(id);
    }
    if (own.length) {
      const batch = loadCommunityEntries(db, own);
      for (const id of own) {
        const key = keyFor(id);
        const pending = batch.then(rows => rows.get(id)).finally(() => {
          if (pendingTemplates.get(key) === pending) pendingTemplates.delete(key);
        });
        waiting.set(id, pending);
        if (!fresh && pendingTemplates.size < MAX_PENDING_TEMPLATES) pendingTemplates.set(key, pending);
      }
    }
    const byId = new Map(await Promise.all([...waiting].map(async ([id, pending]) => [id, await pending])));
    for (let index = 0; index < templateIds.length; index++) {
      if (entries[index]) continue;
      const entry = byId.get(templateIds[index]);
      entries[index] = entry;
      if (cache) {
        const pending = (async () => {
          try {
            await cache.put(keys[index], Response.json(entry, { headers: { 'Cache-Control': 'public, max-age=5' } }));
          } catch { /* Best effort only. */ }
        })();
        if (typeof context.waitUntil === 'function') context.waitUntil(pending);
        else await pending;
      }
    }
  }
  return {
    templateUseRows: entries.map((entry, index) => ({ template_id: templateIds[index], uses: entry.uses })),
    communityHistogram: entries.flatMap(entry => entry.histogram),
  };
}
