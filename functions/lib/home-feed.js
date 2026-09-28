// Home reads bounded candidate windows and cached public preview cards. Full
// placements/community statistics belong to the detail APIs, never this path.
import { digest } from './session.js';
import { RequestError } from './request-guard.js';
import { emitCacheMetric, shouldSampleMetric, requestColo } from './pool-cache.js';

export const HOME_POOL_CAP = 48;
export const HOME_PREVIEW_ITEMS = 12;
const pending = new Map();
const VERSION = 'home-v1';
const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const tags = text => String(text || '').split(',').map(tag => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);
const encode = value => btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = value => JSON.parse(decodeURIComponent(escape(atob(value.replaceAll('-', '+').replaceAll('_', '/')))));

async function cached(context, key, seconds, read) {
  const cache = globalThis.caches?.default;
  const url = new URL(context.request.url);
  const cacheKey = new Request(`${url.origin}/api/__${VERSION}/${await digest(JSON.stringify(key))}`);
  try {
    const hit = await cache?.match(cacheKey);
    if (hit) {
      const entry = await hit.json();
      if (entry.expires > Date.now()) { context.homeMetrics.hits++; return entry.value; }
    }
  } catch { /* Cache outages must not break the feed. */ }
  const existing = pending.get(cacheKey.url);
  if (existing) { context.homeMetrics.coalesced++; return existing; }
  context.homeMetrics.misses++;
  const promise = (async () => {
    const value = await read();
    try {
      if (cache) await cache.put(cacheKey, Response.json({ value, expires: Date.now() + seconds * 1000 }, { headers: { 'Cache-Control': `public, max-age=${seconds}` } }));
    } catch { /* Best effort; query remains bounded without Cache API. */ }
    return value;
  })().finally(() => { if (pending.get(cacheKey.url) === promise) pending.delete(cacheKey.url); });
  if (pending.size < 256) pending.set(cacheKey.url, promise);
  return promise;
}

function readCursor(raw, mode, viewer) {
  if (!raw) return null;
  try {
    if (raw.length > 20000) throw Error();
    const value = decode(raw);
    const boundary = value.after;
    if (value.v !== 1 || value.mode !== mode || value.viewer !== viewer
      || !Array.isArray(value.ids) || value.ids.length > HOME_POOL_CAP + 1
      || value.ids.some(id => typeof id !== 'string' || !id || id.length > 200)
      || (boundary !== null && (!Array.isArray(boundary) || boundary.length !== 2
        || boundary.some(part => typeof part !== 'string' || part.length > 200)))
      || typeof value.more !== 'boolean' || !Number.isInteger(value.page) || value.page < 1) throw Error();
    return value;
  } catch { throw new RequestError('Invalid feed cursor', 400); }
}

async function interests(context, db, viewer) {
  return cached(context, ['interests', viewer], 300, async () => {
    const [own, liked, topics] = await Promise.all([
      db.prepare('SELECT hashtags, template_id FROM rankings WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 24').bind(viewer).all(),
      db.prepare(`SELECT r.hashtags, r.template_id FROM
        (SELECT ranking_id FROM votes WHERE user_id = ? AND vote_type = 'like' LIMIT 24) v
        JOIN rankings r ON r.id = v.ranking_id`).bind(viewer).all(),
      db.prepare(`SELECT topic_type, topic_key, created_at FROM
        (SELECT topic_type, topic_key, created_at FROM topic_follows
          WHERE user_id = ? AND topic_type = 'hashtag' ORDER BY created_at DESC LIMIT 50)
        UNION ALL SELECT topic_type, topic_key, created_at FROM
        (SELECT topic_type, topic_key, created_at FROM topic_follows
          WHERE user_id = ? AND topic_type = 'template' ORDER BY created_at DESC LIMIT 50)
        ORDER BY created_at DESC LIMIT 50`).bind(viewer,viewer).all(),
    ]);
    return { tags: [...new Set([...own.results, ...liked.results].flatMap(row => tags(row.hashtags)).concat(topics.results.filter(row => row.topic_type === 'hashtag').map(row => row.topic_key)))],
      templates: [...new Set([...own.results, ...liked.results].map(row => row.template_id).filter(Boolean).concat(topics.results.filter(row => row.topic_type === 'template').map(row => row.topic_key)))] };
  });
}

function trendingOrder(rows, seen, seed) {
  const now = Date.now();
  const age = row => (now - Date.parse(row.created_at.replace(' ', 'T') + 'Z')) / 86400000;
  const freshness = row => {
    const hours = (now - Date.parse((row.last_activity_at || row.created_at).replace(' ', 'T') + 'Z')) / 3600000;
    return hours <= 1 ? 5 : hours <= 6 ? 4 : hours <= 24 ? 3 : hours <= 72 ? 2 : 1;
  };
  const engagement = row => Math.min(row.likes_count || 0, 50) + Math.min(row.comments_count || 0, 25) * 2 - (row.dislikes_count || 0);
  const tie = row => { let hash = Number(seed) || 0; for (const c of row.id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return hash >>> 0; };
  const sorted = [...rows].sort((a,b) => Number(seen.has(a.id)) - Number(seen.has(b.id))
    || Number(age(a) > 7) - Number(age(b) > 7) || freshness(b) - freshness(a)
    || engagement(b) - engagement(a) || (seed ? tie(a)-tie(b) : 0)
    || (b.last_activity_at || b.created_at).localeCompare(a.last_activity_at || a.created_at) || b.id.localeCompare(a.id));
  const primary = sorted.filter(row => age(row) <= 30);
  const older = sorted.filter(row => age(row) > 30 && age(row) <= 180);
  const result = [];
  while (primary.length) { result.push(...primary.splice(0,15)); if (older.length) result.push(older.shift()); }
  return [...result, ...older];
}

async function candidateRows(context, db, mode, after) {
  // Seed/seen never fragment the shared public candidate query cache.
  return cached(context, ['candidates', mode === 'trending' ? 'activity' : 'recent', after], 60, async () => {
    const order = mode === 'trending' ? 'COALESCE(last_activity_at, created_at)' : 'created_at';
    if (after && mode === 'trending') {
      // SQLite does not seek an expression index for a row-value inequality.
      // Split equal timestamps from older timestamps so both branches seek,
      // including large timestamp ties, instead of rescanning previous windows.
      const select = `SELECT id, user_id, template_id, hashtags, created_at, last_activity_at,
        likes_count, dislikes_count, comments_count FROM rankings`;
      const tied = await db.prepare(`${select} WHERE ${order} = ? AND id < ?
        ORDER BY ${order} DESC, id DESC LIMIT ?`).bind(...after, HOME_POOL_CAP + 1).all();
      if (tied.results.length === HOME_POOL_CAP + 1) return tied.results;
      const older = await db.prepare(`${select} WHERE ${order} < ?
        ORDER BY ${order} DESC, id DESC LIMIT ?`).bind(after[0], HOME_POOL_CAP + 1 - tied.results.length).all();
      return [...tied.results, ...older.results];
    }
    const where = after ? `WHERE (${order}, id) < (?, ?)` : '';
    const result = await db.prepare(`SELECT id, user_id, template_id, hashtags, created_at, last_activity_at,
      likes_count, dislikes_count, comments_count FROM rankings ${where}
      ORDER BY ${order} DESC, id DESC LIMIT ?`).bind(...(after || []), HOME_POOL_CAP + 1).all();
    return result.results;
  });
}

async function candidateWindow(context, db, mode, viewer, after, seed, seen) {
  const rows = await candidateRows(context,db,mode,after);
  const window = rows.slice(0, HOME_POOL_CAP);
  const last = window.at(-1);
  let boundary = last ? [mode === 'trending' ? last.last_activity_at || last.created_at : last.created_at, last.id] : after;
  let more = rows.length > HOME_POOL_CAP;
  let ordered = window;
  let fallback = false;
  if (mode === 'trending') ordered = trendingOrder(window, seen, seed);
  else {
    const taste = await interests(context, db, viewer);
    const tagSet = new Set(taste.tags);
    const templateSet = new Set(taste.templates);
    const relevant = row => templateSet.has(row.template_id) || tags(row.hashtags).some(tag => tagSet.has(tag));
    const matches = window.filter(relevant);
    let scanAfter = boundary;
    let scanMore = more;
    // Sparse interests need a bounded look-ahead, once per snapshot (not per
    // 12 cards). At most 4 indexed windows / 196 rows; never a full-table filter.
    for (let pass = 1; pass < 4 && scanMore && matches.length < HOME_POOL_CAP; pass++) {
      const next = await candidateRows(context,db,mode,scanAfter);
      for (const row of next.slice(0,HOME_POOL_CAP)) {
        scanAfter = [row.created_at,row.id];
        if (relevant(row)) matches.push(row);
        if (matches.length === HOME_POOL_CAP) break;
      }
      scanMore = next.length > HOME_POOL_CAP || (matches.length === HOME_POOL_CAP && next.at(-1)?.id !== scanAfter?.[1]);
    }
    fallback = matches.length === 0;
    // Rank only this bounded window in memory; preserve a stable snapshot in
    // the cursor across four pages, even if cache expires or new posts arrive.
    ordered = fallback ? window : matches;
    if (!fallback) { boundary = scanAfter; more = scanMore; }
  }
  return { ids: ordered.map(row => row.id), after: boundary, more, fallback };
}

async function followingPage(context, db, viewer, after, limit) {
  // One indexed seek per followed author, each bounded to limit+1; merging
  // these small heads avoids scanning unrelated authors or a global OFFSET.
  const { results } = await db.prepare(`SELECT (
    SELECT json_group_array(json_object('id', page.id, 'created_at', page.created_at)) FROM (
      SELECT r.id, r.created_at FROM rankings r WHERE r.user_id = f.following_id
      ${after ? 'AND (r.created_at, r.id) < (?2, ?3)' : ''}
      ORDER BY r.created_at DESC, r.id DESC LIMIT ${limit + 1}
    ) page
  ) AS posts FROM follows f WHERE f.follower_id = ?1`).bind(viewer, ...(after || [])).all();
  const rows = results.flatMap(row => parse(row.posts, [])).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const selected = rows.slice(0,limit);
  const last = selected.at(-1);
  return { ids: selected.map(row => row.id), after: last ? [last.created_at,last.id] : after, more: rows.length > limit };
}

async function card(context, db, id, fresh = false) {
  const load = async () => {
    const r = await db.prepare(`SELECT r.id, r.title, r.hashtags, r.user_id, r.template_id,
      r.created_at, r.likes_count, r.dislikes_count, r.comments_count,
      p.username, p.avatar_url, t.tiers, t.creator_id, t.title AS template_title, t.use_count,
      (SELECT json_group_array(json_object('id', preview.id, 'item_id', preview.item_id,
        'tier', preview.tier, 'position', preview.position, 'item', json_object('id', preview.item_id,
          'name', COALESCE(i.name, legacy.name, preview.item_id), 'image_url', COALESCE(i.image_url, legacy.image_url))))
        FROM (SELECT id, item_id, tier, position FROM ranking_items WHERE ranking_id = r.id
          ORDER BY position, id LIMIT ${HOME_PREVIEW_ITEMS}) preview
        LEFT JOIN items i ON i.id = preview.item_id
        LEFT JOIN items legacy ON i.id IS NULL AND legacy.id = (SELECT id FROM items WHERE name = preview.item_id LIMIT 1)
      ) AS preview_items
      FROM rankings r LEFT JOIN profiles p ON p.id = r.user_id
      LEFT JOIN templates t ON t.id = r.template_id WHERE r.id = ?`).bind(id).first();
    if (!r) return null;
    // Existing installations can have synthetic/stale mirror counters. Keep
    // this release compatible without a remote migration: count only the
    // indexed ranking IDs once per template/cache interval, never placements.
    // Enable the mirror only after explicitly reconciling migration 0025.
    let templateUses = r.use_count || 0;
    if (r.template_id && context.env.HOME_PRECOMPUTED_TEMPLATE_COUNTS !== 'true') {
      const count = async () => (await db.prepare('SELECT COUNT(*) AS uses FROM rankings WHERE template_id = ?').bind(r.template_id).first()).uses;
      templateUses = fresh ? await count() : await cached(context, ['template-uses',r.template_id], 300, count);
    }
    return { id:r.id, title:r.title, hashtags:r.hashtags, user_id:r.user_id, template_id:r.template_id, created_at:r.created_at,
      template_title:r.template_title, is_original:!r.template_id || r.creator_id === r.user_id,
      profile:{id:r.user_id, username:r.username || 'Unknown', avatar_url:r.avatar_url, is_following:false},
      stats:{likes:r.likes_count, dislikes:r.dislikes_count, comments:r.comments_count, templateUses, communityDisagreement:null},
      user_vote:null, tiers:parse(r.tiers,null), ranking_items:parse(r.preview_items,[]), preview:true };
  };
  return fresh ? load() : cached(context, ['card',id], 30, load);
}

export async function homeFeed(context, mode) {
  context = { ...context, homeMetrics: { hits:0, misses:0, coalesced:0 } };
  const started = Date.now();
  const respond = (body, headers) => {
    if (shouldSampleMetric(context.env)) emitCacheMetric(console, {
      event:'cache_metric', component:'home_feed', version:'v1', feed_type:mode,
      cache_hits:context.homeMetrics.hits, cache_misses:context.homeMetrics.misses,
      cache_coalesced:context.homeMetrics.coalesced, cards:body.data.length, duration_ms:Date.now()-started,
      ...(requestColo(context.request) ? {colo:requestColo(context.request)} : {}),
    });
    return Response.json(body,{headers});
  };
  const db = context.env.tear_of_god_db;
  const url = new URL(context.request.url);
  const viewer = context.data.user?.id || null;
  const limit = Math.min(12, Math.max(1, parseInt(url.searchParams.get('limit'),10) || 12));
  const requestedMode = mode;
  if (mode === 'for_you' && !viewer) mode = 'trending';
  if (mode === 'following' && !viewer) return Response.json({success:true,data:[],hasMore:false,nextCursor:null,feedLocked:true,page:1,limit});
  const cursor = readCursor(url.searchParams.get('cursor'), mode, viewer);
  const excluded = new Set((url.searchParams.get('exclude') || '').split(',').filter(Boolean).slice(0,1000));
  const seen = new Set((url.searchParams.get('seen') || '').split(',').filter(Boolean).slice(0,1000));
  const seed = viewer ? parseInt(url.searchParams.get('seed'),10) || 0 : 0;
  // Legacy callers may use pages within the first snapshot. Deep pagination
  // requires a cursor; never emulate it with an expensive OFFSET/rebuild loop.
  const legacyPage = Math.max(1,parseInt(url.searchParams.get('page'),10) || 1);
  if (!cursor && legacyPage > Math.ceil(HOME_POOL_CAP / limit)) throw new RequestError('Continue with nextCursor', 400);
  const pin = !cursor && viewer ? url.searchParams.get('pin') : null;
  const getPublicPage = async () => {
    let state = cursor;
    let fallback = requestedMode === 'for_you' && !viewer;
    let ids;
    let after;
    let more;
    if (mode === 'following') {
      const page = await followingPage(context,db,viewer,cursor?.after || null,limit);
      ids = page.ids; after = page.after; more = page.more;
      state = { ids:[], after, more };
    } else {
      if (!state || !state.ids.length) {
        const pool = await cached(context, ['pool', mode, viewer, seed, cursor?.after || null, [...seen].sort()], mode === 'trending' ? 60 : 300,
          () => candidateWindow(context,db,mode,viewer,cursor?.after || null,seed,seen));
        state = { ...pool, ids:[...pool.ids] };
        fallback ||= pool.fallback;
      } else state = { ...state, ids:[...state.ids] };
      if (mode === 'trending') state.ids = state.ids.filter(id => !excluded.has(id));
      else if (!cursor) {
        const unseen = state.ids.filter(id => !excluded.has(id));
        if (unseen.length) state.ids = unseen;
      }
      if (!cursor && legacyPage > 1) state.ids = state.ids.slice((legacyPage-1)*limit);
      if (pin) {
        const owned = await db.prepare('SELECT id FROM rankings WHERE id = ? AND user_id = ?').bind(pin,viewer).first();
        if (owned) state.ids = [owned.id,...state.ids.filter(id => id !== owned.id)];
      }
      ids = state.ids.slice(0,limit);
      state.ids = state.ids.slice(limit);
      more = state.ids.length > 0 || state.more;
    }
    const data = (await Promise.all(ids.map(id => card(context,db,id,id === pin)))).filter(Boolean);
    const nextCursor = more ? encode({v:1,mode,viewer,ids:state.ids,after:state.after,more:state.more,page:(cursor?.page || legacyPage)+1}) : null;
    return {success:true,data,page:cursor?.page || legacyPage,limit,total:null,hasMore:more,nextCursor,feedLocked:false,personalizationFallback:fallback};
  };
  // Guest seeds/fresh flags are deliberately excluded from shared response keys.
  // Per-viewer overlays are applied only AFTER retrieving public card data.
  const result = !viewer ? await cached(context,['guest-response',mode,limit,cursor,[...excluded].sort(),[...seen].sort(),legacyPage],30,getPublicPage) : await getPublicPage();
  if (!viewer) return respond(result,{'Cache-Control':'public, max-age=15'});
  const ids = result.data.map(row => row.id);
  if (ids.length) {
    const authors = [...new Set(result.data.map(row => row.user_id).filter(Boolean))];
    const [votes, follows] = await Promise.all([
      db.prepare(`SELECT ranking_id, vote_type FROM votes WHERE user_id = ? AND ranking_id IN (${ids.map(()=>'?').join(',')})`).bind(viewer,...ids).all(),
      authors.length ? db.prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${authors.map(()=>'?').join(',')})`).bind(viewer,...authors).all() : {results:[]},
    ]);
    const byId = new Map(votes.results.map(row => [row.ranking_id,row.vote_type]));
    const followed = new Set(follows.results.map(row => row.following_id));
    return respond({...result,data:result.data.map(row=>({...row,user_vote:byId.get(row.id)||null,profile:{...row.profile,is_following:followed.has(row.user_id)}}))},{'Cache-Control':'private, no-store'});
  }
  return respond(result,{'Cache-Control':'private, no-store'});
}
