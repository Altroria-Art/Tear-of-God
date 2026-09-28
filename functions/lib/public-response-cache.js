// Only call with a loader that cannot read viewer-specific data. Cookies and
// authorization headers must never be copied onto these internal cache keys.
const pendingByDatabase = new WeakMap();
const restore = entry => new Response(entry.body, { status: entry.status, headers: entry.headers });

export async function publicResponseCache(context, key, seconds, load) {
  if (/no-cache|no-store/i.test(context.request.headers.get('Cache-Control') || '')) return load();
  const cache = globalThis.caches?.default;
  try {
    const hit = await cache?.match(key);
    const remaining = Math.floor((Number(hit?.headers.get('X-Public-Expires')) - Date.now()) / 1000);
    if (hit && remaining > 0) {
      const response = new Response(hit.body, hit);
      response.headers.delete('X-Public-Expires');
      response.headers.set('Cache-Control', `public, max-age=${remaining}`);
      return response;
    }
  } catch { /* A cache outage must not take down the endpoint. */ }

  const db = context.env.tear_of_god_db;
  let pending = pendingByDatabase.get(db);
  if (!pending) { pending = new Map(); pendingByDatabase.set(db, pending); }
  if (pending.has(key.url)) return restore(await pending.get(key.url));
  const work = (async () => {
    const response = await load();
    if (cache && response.ok) {
      const copy = response.clone();
      copy.headers.set('X-Public-Expires', String(Date.now() + seconds * 1000));
      copy.headers.set('Cache-Control', `public, max-age=${seconds}`);
      try { await cache.put(key, copy); } catch { /* Best effort. */ }
    }
    // Share plain data, never a request-owned response stream across requests.
    return { body: await response.text(), status: response.status, headers: [...response.headers] };
  })();
  // Bound transient bookkeeping even under a burst of unique search terms.
  const tracked = pending.size < 256;
  if (tracked) pending.set(key.url, work);
  try { return restore(await work); }
  finally { if (tracked && pending.get(key.url) === work) pending.delete(key.url); }
}
