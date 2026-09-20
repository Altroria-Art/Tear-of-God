import { prioritizeUnseen } from '../lib/feed-refresh.js';
import { feedCommunityStats } from '../lib/community-cache.js';
// 📍 [ใหม่]: ranking_items.tier เก็บแค่ "ชื่อ tier" เป็นสตริง — สี/id ของ tier อยู่ที่
// templates.tiers เท่านั้น (ดู functions/api/templates.js). ก่อนหน้านี้ endpoint นี้ไม่เคย
// ส่ง tiers กลับมาเลย ทำให้ Home Feed / Feed Detailed โชว์ tier ไม่มีสี ต่างจาก Discover
// Detailed ที่อ่านจาก /api/templates โดยตรง — parseTiers() คัดลอกมาจาก templates.js เพราะ
// ยังไม่มี shared-helper module ในโปรเจกต์นี้ (ดู docs/tier-list-feed-debug-plan.md §7/§8)
import {
  INPUT_LIMITS,
  RequestError,
  assertHashtags,
  assertId,
  assertInteger,
  assertString,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
} from '../lib/request-guard.js';

import {
  buildSharedHomeTrendingKey,
  buildTrendingPoolKey,
  emitCacheMetric,
  getRecentPool,
  isSharedHomeTrendingEligible,
  readTrendingPool,
  removeRecentPool,
  requestColo,
  runPoolQueryDeduped,
  setRecentPool,
  SHARED_HOME_TRENDING_TTL_SECONDS,
  shouldSampleMetric,
  trendingPoolCacheRequest,
  trendingPoolMetric,
  writeTrendingPool,
} from '../lib/pool-cache.js';

function parseTiers(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// จัดรูปแบบ hashtag CSV ที่เพิ่งสร้างให้เป็น "token เริ่มต้นด้วย #" เสมอ (#anime,ไม่ใช่ anime)
// + ตัดช่องว่าง/แท็กซ้ำ (เคส insensitive) — เพื่อให้ข้อมูลที่เก็บเป็น canonical เดียวกันกับ
// seed และฝั่ง matcher ของ /api/templates?hashtag กับ /api/hashtags (count) ตรงกันเสมอ
function canonicalizeHashtags(raw) {
  if (!raw) return '';
  const seen = new Set();
  return raw
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((tag) => `#${tag}`)
    .join(',');
}

// FNV-1a 32-bit hash — ใช้ประกอบ seed ของ Home Feed (ดูทรงด้านล่าง: ลำดับสุ่มต้อง
// deterministic บน Workers runtime, SQLite/D1 ไม่มี seeded-random ให้ใช้)
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 PRNG — deterministic จาก seed เดียว
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Windowed Fisher–Yates: สับเปลี่ยนตำแหน่งภายในกลุ่ม (window) ขนาด windowSize ตาม seed
// ช่วยให้ feed แต่ละประเภท (Trending, For You, Following) สลับเปลี่ยน tier list ในหัวแถว
// ทุกครั้งที่กดรีเฟรช โดยที่ยังคงรักษาอันดับความสดใหม่ (โพสต์ใหม่ๆ ขึ้นก่อน) และเกณฑ์ของแต่ละฟีด
// ไม่ให้โพสต์เก่าหรือโพสต์ที่ไม่เกี่ยวข้องกระโดดขึ้นมาแซงหัวแถว และไม่ทำให้ pagination ซ้ำหรือข้าม
function windowedShuffle(list, windowSize, seed) {
  if (!seed || !list || list.length <= 1) return list;
  const rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const result = [];
  for (let i = 0; i < list.length; i += windowSize) {
    const chunk = list.slice(i, i + windowSize);
    for (let j = chunk.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      const tmp = chunk[j];
      chunk[j] = chunk[k];
      chunk[k] = tmp;
    }
    result.push(...chunk);
  }
  return result;
}

export async function onRequest(context) {
  const { request, env, data: auth, waitUntil } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const db = env.tear_of_god_db;

  const jsonResponse = (data, status = 200, extraHeaders = {}) => {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
  };

  try {
    // 🟢 [GET] ดึงข้อมูล
    if (request.method === 'GET') {
      if (id) {
        // user_id ที่ส่งมาคือ "คนที่กำลังดู" (ไม่ใช่เจ้าของโพสต์) ใช้เพื่อรู้ว่าคนนี้เคยโหวตไว้ยังไง
        const viewerId = auth.user?.id || null;
        const { results: rankings } = await db.prepare(`
          SELECT r.*, p.username, p.avatar_url,
            ${viewerId ? `(SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?)` : `NULL`} as user_vote,
            ${viewerId ? `(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = r.user_id)` : `NULL`} as is_following
          FROM rankings r
          LEFT JOIN profiles p ON r.user_id = p.id
          WHERE r.id = ?
        `).bind(...(viewerId ? [viewerId, viewerId, id] : [id])).all();

        if (rankings.length === 0) return jsonResponse({ success: false, error: 'Not found' }, 404);
        const ranking = rankings[0];
        
        const { results: items } = await db.prepare(`
          SELECT ri.*, i.name as item_name, i.image_url as item_image
          FROM ranking_items ri
          LEFT JOIN items i ON (ri.item_id = i.id OR ri.item_id = i.name)
          WHERE ri.ranking_id = ?
          ORDER BY ri.position ASC
        `).bind(id).all();

        // 📍 [ใหม่]: เอา tier definition (label+color+id) ของ template ที่ผูกกับ ranking นี้มาด้วย
        // — ไม่งั้นฝั่งหน้าบ้านมีแต่ ranking_items.tier ที่เป็นสตริงเฉยๆ ไม่รู้สี
        let tiersDef = null;
        let templateCreatorId = null;
        let templateTitle = null;
        if (ranking.template_id) {
          const { results: tplRows } = await db.prepare(
            `SELECT creator_id, title, tiers FROM templates WHERE id = ?`
          ).bind(ranking.template_id).all();
          if (tplRows[0]) {
            tiersDef = parseTiers(tplRows[0].tiers);
            templateCreatorId = tplRows[0].creator_id ?? null;
            templateTitle = tplRows[0].title ?? null;
          }
        }
        const isOriginal = !ranking.template_id || (templateCreatorId !== null && templateCreatorId === ranking.user_id);

        // 📍 ดึงข้อมูลคอมเมนต์ของโพสต์นี้พร้อมข้อมูลผู้ใช้
        // กัน unbounded growth (ดู docs/row-read-optimization-plan.md §4 hypothesis H4) — ตอนนี้
        // ไม่มีโพสต์ไหนเกิน ~12 คอมเมนต์ แต่ query นี้ไม่มี LIMIT มาก่อนเลย ถ้าโพสต์ไหนคอมเมนต์
        // เยอะมากในอนาคตจะอ่านทุกแถวไม่จำกัดทุกครั้งที่เปิดโพสต์ ใส่เพดานกว้างๆ ไว้กันไว้ก่อน
        const { results: comments } = await db.prepare(`
          SELECT c.*, p.username, p.avatar_url
          FROM comments c
          LEFT JOIN profiles p ON c.user_id = p.id
          WHERE c.ranking_id = ?
          ORDER BY c.created_at DESC
          LIMIT 200
        `).bind(id).all();

        const result = {
          ...ranking,
          is_original: isOriginal,
          template_title: templateTitle,
          profile: {
            id: ranking.user_id,
            username: ranking.username || 'Unknown',
            avatar_url: ranking.avatar_url,
            is_following: !!ranking.is_following,
          },
          stats: { likes: ranking.likes_count, dislikes: ranking.dislikes_count, comments: ranking.comments_count },
          user_vote: ranking.user_vote ?? null,
          tiers: tiersDef, // 📍 [ใหม่]: null เมื่อ ranking ไม่มี template (ดูหมายเหตุด้านบน)
          ranking_items: items.map(ri => ({
            ...ri, item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
          })),
          comments: comments // 📍 ส่งคอมเมนต์กลับไปให้หน้าบ้าน
        };
        return jsonResponse({ success: true, data: result });
      } 
      else {
        const hashtag = url.searchParams.get('hashtag') || url.searchParams.get('category'); // legacy filter alias
        const currentUserId = auth.user?.id || null;
        // author_id = "กรองเฉพาะโพสต์ของคนนี้" (หน้าโปรไฟล์) — ต่างจาก user_id ที่แปลว่า "คนกำลังดู"
        const authorId = url.searchParams.get('author_id');
        const templateId = url.searchParams.get('template_id');
        const sort = url.searchParams.get('sort'); // 'recent' | 'liked'
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit')) || 12), 50);
        const offset = (page - 1) * limit;
        // Home feed mode. Keep the old names as aliases so frontend/backend rollouts do not
        // briefly break one another, but expose only the clearer names in the current UI.
        const requestedFeedType = url.searchParams.get('feed_type');
        const feedTypeAliases = { general: 'trending', kindred: 'for_you' };
        const normalizedFeedType = feedTypeAliases[requestedFeedType] || requestedFeedType;
        const feedType = ['trending', 'for_you', 'following'].includes(normalizedFeedType)
          ? normalizedFeedType
          : null;
        // seed สุ่มจาก client (ใหม่ทุก mount) → ลำดับเปลี่ยนทุก reload แต่คงที่ใน session.
        // อันเป็น 0 = deterministic เหมือนเดิม (default)
        const seed = Math.max(0, parseInt(url.searchParams.get('seed') || '0', 10) || 0) >>> 0;
        // optional: กรอง pool แค่ช่วงเวลาที่ผ่านมา 'days' วัน (เชิงไวยากรณ์; Home ปัจจุบันไม่ส่ง).
        // ระวัง Math.max(1, 0)=1 — ถ้าไม่ส่งต้องเป็น 0 (ไม่กรอง) ไม่ใช่ 1 วัน
        const daysParam = parseInt(url.searchParams.get('days') || '', 10);
        const days = (!Number.isNaN(daysParam) && daysParam > 0) ? daysParam : 0;
        // 🟡 [ใหม่]: pin = ranking ที่ "เพิ่ง publish" ของ currentUser — client จาก
        // src/lib/lastPublished.js ส่งมาเฉพาะ mount แรกหลัง publish; ให้การ์ดนั้นขึ้นอันแรก
        // อีกครั้ง (ถ้ารีโหลดหน้าใหม่ client ส่งไม่มา → กลับไปสุ่มแบบเดิม) — ตรวจเจ้าของเอง
        const runPin = url.searchParams.get('pin');
        // รายการ ranking IDs ที่เพิ่งแสดงผลไปในการรีเฟรชครั้งล่าสุด เพื่อนำมาคัดออกจากหน้าแรกไม่ให้วนซ้ำ
        const excludeParam = url.searchParams.get('exclude');
        const excludeIds = excludeParam ? new Set(excludeParam.split(',').filter(Boolean)) : null;

        // 📍 mine=1: ranking ล่าสุดของ "ตัวเอง" บน template นี้ (CommunityAveragePage
        // "ของฉัน vs ชุมชน" — เดิมใช้ template_id+author_id+limit=1 ซึ่งรัน enrich
        // เต็มชุด: tiers/uses/histogram/follows ทั้งที่หน้านี้ใช้แค่ ranking_items
        // tier+ชื่อ item) ใช้ session user ฝั่ง server เท่านั้น ไม่เชื่อ author_id
        // จาก client; คืน ranking + ranking_items (ชื่อ/รูป item ครบ) ไม่รัน
        // histogram/follows/live-uses — ordering เดิม: ใหม่สุดก่อน (created_at,id)
        if (url.searchParams.get('mine') === '1') {
          if (!currentUserId) return jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง / Please log in again' }, 401);
          if (!templateId) return jsonResponse({ success: false, error: 'Missing template_id' }, 400);
          const mineRow = await db.prepare(
            `SELECT r.* FROM rankings r WHERE r.template_id = ? AND r.user_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 1`
          ).bind(templateId, currentUserId).first();
          if (!mineRow) return jsonResponse({ success: true, data: [], page: 1, limit: 1, total: 0 });
          const { results: mineItems } = await db.prepare(`
            SELECT ri.*, i.name as item_name, i.image_url as item_image
            FROM ranking_items ri
            LEFT JOIN items i ON (ri.item_id = i.id OR ri.item_id = i.name)
            WHERE ri.ranking_id = ?
            ORDER BY ri.position ASC
          `).bind(mineRow.id).all();
          return jsonResponse({
            success: true,
            data: [{
              ...mineRow,
              profile: null,
              stats: { likes: mineRow.likes_count, dislikes: mineRow.dislikes_count, comments: mineRow.comments_count },
              user_vote: null,
              tiers: null,
              ranking_items: mineItems.map(ri => ({
                ...ri, item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
              })),
            }],
            page: 1, limit: 1, total: 1,
          });
        }

        // sort ที่ระบุมาชัดเจนต้องชนะ personalized order เสมอ — ไม่งั้นหน้าที่ส่ง user_id มา
        // เพื่อขอ user_vote (เช่น Template Detail) จะโดนแย่ง ORDER BY ไปแบบไม่ได้ตั้งใจ
        // และเมื่อกรองด้วย author_id (หน้าโปรไฟล์) เราต้องการลำดับใหม่→เก่าของเจ้าของโพสต์
        // เสมอ จึงปิด personalized order ไปด้วย
        const usePersonalized = !sort && !!currentUserId && !authorId;

        let orderExpr;
        if (sort === 'liked') {
          orderExpr = `r.likes_count DESC, r.created_at DESC, r.id DESC`;
        } else if (sort === 'recent') {
          orderExpr = `r.created_at DESC, r.id DESC`;
        } else {
          orderExpr = `r.created_at DESC, r.id DESC`;
        }
        // r.id เป็น tiebreaker เสมอ — created_at ละเอียดแค่วินาที ข้อมูลหลักร้อยแถวชนกันได้ง่าย
        // ไม่มี tiebreaker แล้ว OFFSET จะเลื่อนหน้าซ้ำ/ข้ามแถวได้เวลา paginate

        let pageWhere = `WHERE 1=1`;
        const pageWhereParams = [];
        if (hashtag && hashtag !== 'null') { pageWhere += ` AND EXISTS (SELECT 1 FROM ranking_hashtags rh WHERE rh.ranking_id = r.id AND rh.hashtag = lower(trim(ltrim(trim(?), '#'))))`; pageWhereParams.push(hashtag); }
        if (authorId) { pageWhere += ` AND r.user_id = ?`; pageWhereParams.push(authorId); }
        if (templateId) { pageWhere += ` AND r.template_id = ?`; pageWhereParams.push(templateId); }

        // Home Feed (feedType != null) builds one ordered id pool, then slices it per page:
        //   trending: freshness + likes/comments/dislikes, with a stable tiebreaker
        //   for_you: posts matching hashtag interests or template history
        //   following: newest posts from accounts the viewer follows
        // Guests may browse Trending; the other two feeds intentionally require login.
        // rows-read: pool อ่านแค่ id (≤ HOME_POOL_CAP) ต่อหน้าใหม่; หน้าถัดๆ ไปอ่านแต่ detail ของ 1 หน้า
        // (HomeFeed cache ผลต่อ tab+user ไว้ที่ client → pool scan เกิดขึ้นครั้งเดียวต่อครั้ง mount)
        const HOME_POOL_CAP = 600;    // เพดาน pool ที่จะนำมาสับ — กัน pool โตเกินเหตุ

        let homePoolIds = null;       // null = ไม่ใช่ home path
        let feedLocked = false;
        let personalizationFallback = false;
        if (feedType) {
          if (feedType === 'following' && !currentUserId) {
            feedLocked = true;
            homePoolIds = [];
          } else {
            let poolWhere = pageWhere;
            const poolParams = [...pageWhereParams];

            if (feedType === 'for_you' && !currentUserId) {
              personalizationFallback = true;
            } else if (feedType === 'for_you' && currentUserId) {
              // normalize แฮชแท็กจากโพสต์ที่ฉันสร้าง ∪ โพสต์ที่ฉันไลก์ (ตัด '#')
              // — ใช้เป็นสัญญาณที่ (3) ของเกณฑ์ความเกี่ยวข้อง
              const tagRows = await db.prepare(`
                SELECT r.hashtags FROM rankings r WHERE r.user_id = ?
                UNION
                SELECT fav.hashtags FROM votes v JOIN rankings fav ON v.ranking_id = fav.id
                WHERE v.user_id = ? AND v.vote_type = 'like'
              `).bind(currentUserId, currentUserId).all();
              const tagSet = new Set();
              (tagRows.results || []).forEach((row) => {
                (row.hashtags || '').split(',').forEach((raw) => {
                  const tag = raw.trim().replace(/^#/, '');
                  if (tag) tagSet.add(tag);
                });
              });
              // จำกัดแฮชแท็กไม่เกิน 50 อันเพื่อป้องกัน SQLite/D1 bound parameter limit
              const myTags = [...tagSet].slice(0, 50);
              // Hashtag interests and template history are independent signals.
              const tagCond = myTags.length
                ? `EXISTS (SELECT 1 FROM ranking_hashtags rh WHERE rh.ranking_id = r.id AND rh.hashtag IN (${myTags.map(() => '?').join(',')}))`
                : '0';
              const scoreExpr = `
                CASE WHEN r.template_id IS NOT NULL AND r.template_id IN (
                  SELECT template_id FROM rankings WHERE user_id = ? AND template_id IS NOT NULL
                  UNION
                  SELECT fav.template_id FROM votes v JOIN rankings fav ON v.ranking_id = fav.id
                  WHERE v.user_id = ? AND v.vote_type = 'like' AND fav.template_id IS NOT NULL
                  UNION
                  SELECT topic_key FROM topic_follows WHERE user_id = ? AND topic_type = 'template'
                ) THEN 1 ELSE 0 END
                + CASE WHEN ${tagCond}
                  OR EXISTS (SELECT 1 FROM topic_follows tf JOIN ranking_hashtags rh ON rh.hashtag = tf.topic_key
                    WHERE tf.user_id = ? AND tf.topic_type = 'hashtag' AND rh.ranking_id = r.id)
                  THEN 1 ELSE 0 END
              `;
              // One matching hashtag or template is sufficient after removing category.
              poolWhere += ` AND (${scoreExpr}) >= 1`;
              poolParams.push(currentUserId, currentUserId, currentUserId,
                ...myTags.map(tag => tag.toLowerCase()), currentUserId);
            }

            if (feedType === 'following' && currentUserId) {
              poolWhere += `\n              AND r.user_id IN (
                SELECT following_id FROM follows WHERE follower_id = ?
              )`;
              poolParams.push(currentUserId);
            }

            if (days) {
              poolWhere += ` AND r.created_at >= datetime('now', '-' || ? || ' days')`;
              poolParams.push(String(days));
            }

            const trendingOrder = `(
              CASE
                WHEN r.created_at >= datetime('now', '-3 days') THEN 50
                WHEN r.created_at >= datetime('now', '-7 days') THEN 35
                WHEN r.created_at >= datetime('now', '-14 days') THEN 20
                WHEN r.created_at >= datetime('now', '-30 days') THEN 10
                WHEN r.created_at >= datetime('now', '-90 days') THEN 3
                ELSE 0
              END
              + COALESCE(r.likes_count, 0) * 3
              + COALESCE(r.comments_count, 0) * 2
              - COALESCE(r.dislikes_count, 0)
            ) DESC, r.created_at DESC, r.id DESC`;
            const poolOrder = (feedType === 'trending' || personalizationFallback)
              ? trendingOrder
              : `r.created_at DESC, r.id DESC`;
            const runPoolQuery = async () => {
              const { results: poolRows } = await db.prepare(`
                SELECT r.id FROM rankings r
                ${poolWhere}
                ORDER BY ${poolOrder}
                LIMIT ?
              `).bind(...poolParams, HOME_POOL_CAP).all();
              return (poolRows || []).map((row) => row.id);
            };
            // Batch 3 L1 (per-seed) + Batch 4 L2 (shared unfiltered home
            // trending): raw IDs only — for_you/following candidate selection
            // is user-specific and keeps querying (see pool-cache.js).
            // L1 key pins the seed so manual refresh (new seed) still misses
            // L1; page slicing, exclude, shuffle and pin below run on whatever
            // pool is returned, hit or miss.
            // Batch 9: one sampled summary log per home-feed request (no PII,
            // pool size only) — cache/D1 behavior untouched.
            const poolStartedAt = Date.now();
            let poolIds;
            let poolOutcome = null;
            if (feedType === 'trending') {
              const poolKey = buildTrendingPoolKey({
                feedType, seed, hashtag, authorId, templateId, days,
                poolCap: HOME_POOL_CAP,
              });
              const poolCache = typeof caches !== 'undefined' ? caches.default : null;
              const poolCacheRequest = trendingPoolCacheRequest(url.origin, poolKey);
              const eligible = isSharedHomeTrendingEligible({ feedType, hashtag, authorId, templateId, days });
              let l1 = 'MISS';
              let l2 = 'SKIP';
              let d1Build = false;
              poolIds = await readTrendingPool(poolCache, poolCacheRequest);
              // Phase 0 bridge: post-D1/pre-put window (in-flight entry gone,
              // Cache API write not committed yet) — memory only, falls back.
              if (!poolIds) poolIds = getRecentPool(poolKey);
              if (poolIds) {
                l1 = 'HIT';
              } else if (eligible) {
                const sharedKey = buildSharedHomeTrendingKey({ poolCap: HOME_POOL_CAP });
                const sharedRequest = trendingPoolCacheRequest(url.origin, sharedKey);
                let sharedIds = await readTrendingPool(poolCache, sharedRequest);
                if (!sharedIds) sharedIds = getRecentPool(sharedKey);
                if (sharedIds) {
                  l2 = 'HIT';
                } else {
                  // Shared in-flight dedup keyed by the L2 key (not the
                  // seed): concurrent new seeds share one D1 pool query.
                  sharedIds = await runPoolQueryDeduped(sharedKey, runPoolQuery);
                  d1Build = true;
                  l2 = 'MISS';
                  setRecentPool(sharedKey, sharedIds);
                  const sharedStored = await writeTrendingPool(
                    poolCache, sharedRequest, sharedIds, waitUntil,
                    SHARED_HOME_TRENDING_TTL_SECONDS,
                  );
                  if (!sharedStored) removeRecentPool(sharedKey);
                }
                poolIds = sharedIds;
                // Populate L1(seed) so the session's next pages hit L1.
                setRecentPool(poolKey, poolIds);
                const l1Stored = await writeTrendingPool(poolCache, poolCacheRequest, poolIds, waitUntil);
                if (!l1Stored) removeRecentPool(poolKey);
              } else {
                // Filtered trending: L1 per-seed only, exactly Batch 3.
                poolIds = await runPoolQueryDeduped(poolKey, runPoolQuery);
                d1Build = true;
                setRecentPool(poolKey, poolIds);
                const l1Stored = await writeTrendingPool(poolCache, poolCacheRequest, poolIds, waitUntil);
                if (!l1Stored) removeRecentPool(poolKey);
              }
              poolOutcome = { l1, l2, d1Build, eligible };
            } else {
              poolIds = await runPoolQuery();
              poolOutcome = { l1: 'SKIP', l2: 'SKIP', d1Build: false, eligible: false };
            }
            if (poolOutcome && shouldSampleMetric(env)) {
              emitCacheMetric(console, trendingPoolMetric({
                ...poolOutcome,
                feedType,
                poolSize: (poolIds || []).length,
                ms: Date.now() - poolStartedAt,
                colo: requestColo(request),
              }));
            }

            // A new account has no useful interest signals yet. Show Trending until its
            // hashtag/template history is strong enough; Following stays empty.
            if (feedType === 'for_you' && poolIds.length === 0) {
              personalizationFallback = true;
              let fbWhere = pageWhere;
              const fbParams = [...pageWhereParams];
              if (days) { fbWhere += ` AND r.created_at >= datetime('now', '-' || ? || ' days')`; fbParams.push(String(days)); }
              const { results: fbRows } = await db.prepare(`
                SELECT r.id FROM rankings r
                ${fbWhere}
                ORDER BY ${trendingOrder}
                LIMIT ?
              `).bind(...fbParams, HOME_POOL_CAP).all();
              poolIds = (fbRows || []).map((row) => row.id);
            }

            // เวลากด refresh (seed > 0):
            // สุ่มสลับตำแหน่งแบบกลุ่มใหญ่ (windowed shuffle):
            // - Trending: สุ่มสลับจากกลุ่ม Top 60 รายการยอดนิยม/สดใหม่ เพื่อให้เวลารีเฟรชไม่เห็นเฉพาะ 12 อันดับเดิมซ้ำๆ
            // - For You: สุ่มสลับจากกลุ่ม 48 รายการที่ตรงกับความชอบของ account นั้น
            // - Following: สุ่มสลับจากกลุ่ม 36 รายการล่าสุดจากคนที่ติดตาม
            // ช่วยให้การรีเฟรชได้การ์ดชุดใหม่ที่หลากหลายขึ้นมาก ไม่วนซ้ำเฉพาะ 12 การ์ดเดิม
            const SHUFFLE_WINDOWS = {
              trending: 60,
              for_you: 48,
              following: 36,
            };
            const windowSize = SHUFFLE_WINDOWS[feedType] || 48;
            const orderedIds = prioritizeUnseen(seed > 0
              ? windowedShuffle(poolIds, windowSize, seed ^ fnv1a(feedType))
              : poolIds, excludeIds);

            // A freshly published ranking is pinned once at the top of Trending. Ownership
            // is checked server-side so an arbitrary URL cannot pin somebody else's post.
            let pinnedId = null;
            if (feedType === 'trending' && runPin && currentUserId) {
              const { results: owned } = await db.prepare(
                `SELECT id FROM rankings WHERE id = ? AND user_id = ? LIMIT 1`
              ).bind(runPin, currentUserId).all();
              if (owned.length > 0) pinnedId = owned[0].id;
            }
            if (pinnedId) {
              homePoolIds = [pinnedId, ...orderedIds.filter((id) => id !== pinnedId)];
            } else {
              homePoolIds = orderedIds;
            }
          }
        }

        // แก้ปัญหา row-read สูงผิดปกติ (ดู docs/row-read-optimization-plan.md §3, §8):
        // เดิม query นี้ห่อด้วย "page" CTE + ROW_NUMBER() OVER (ORDER BY ...) เสมอ แม้แต่ตอน
        // ORDER BY เป็นคอลัมน์ตรงๆ ที่มี index รองรับอยู่แล้ว (created_at/user_id/
        // template_id+likes_count จาก migrations/0004) — ทำให้ SQLite ต้อง SCAN ทั้งตาราง
        // แล้ว sort ลง temp B-tree 2 รอบ (ครั้งในและครั้งนอก page.rn) ก่อนค่อยตัด LIMIT
        // วัดจริงจาก D1 trace (.wrangler observability): ~2,718 rows เพื่อคืนแค่ 5 แถว
        //
        // ตอนนี้แยกเป็น 2 รูปแบบ:
        // (A) ไม่ personalized (มี sort ระบุมาชัดเจน หรือไม่ล็อกอิน หรือกรอง author_id) —
        //     ตัด CTE/ROW_NUMBER ออกหมด เหลือ SELECT เดียว ORDER BY ตรงๆ + LIMIT/OFFSET
        //     ให้ index ที่เพิ่มใน migrations/0004_feed_indexes.sql ทำงานเป็น index-order
        //     scan ล้วนๆ ไม่มี temp sort เลย (ยืนยันด้วย EXPLAIN QUERY PLAN แล้ว)
        // (B) personalized (COALESCE(aff.affinity,0) DESC) — sort บนค่าที่มาจาก LEFT JOIN กับ
        //     CTE รวมยอด ไม่มีทางมี index รองรับได้ไม่ว่าจะเพิ่ม index อะไรก็ตาม (ยืนยันแล้วว่า
        //     ยังคง SCAN + TEMP B-TREE แม้เพิ่ม index ครบ) จึงต้อง "bound" ขอบเขตที่จะจัดอันดับ
        //     ก่อน: ดึงเฉพาะโพสต์ใหม่ล่าสุด CAND_LIMIT แถว (index-order scan, ถูก) มา join กับ
        //     affinity แล้วค่อย sort แค่ในกลุ่มนั้น — ไม่ scan ทั้งตารางอีกต่อไป
        //     ⚠️ trade-off ที่ตั้งใจ (บันทึกไว้ตามแผน): โพสต์เก่ามากที่ affinity สูงจะไม่ถูกดันขึ้น
        //     มาอีก เพราะไม่อยู่ใน CAND_LIMIT แถวล่าสุด — ยอมแลกเพราะ personalized order เป็นแค่
        //     "จัดลำดับใหม่ในกลุ่มโพสต์ใหม่ล่าสุด" ไม่ใช่ full ranking ทั้งระบบ
        //     CAND_LIMIT โตตาม offset+limit เสมอ (ไม่ตายตัวที่ 100) เพื่อไม่ให้ infinite scroll
        //     ตัน — scroll ลึกแค่ไหนก็ยังได้โพสต์ใหม่ๆ ต่อไปเรื่อยๆ ตามลำดับวันที่ปกติ
        //     (แค่ personalize เฉพาะช่วงที่ยัง "ใหม่" พอจะติด CAND_LIMIT เท่านั้น)
        const PERSONALIZE_CANDIDATE_MIN = 100;

        let query;
        let params;

        if (!usePersonalized) {
          query = `
            SELECT r.*, p.username, p.avatar_url,
              ${currentUserId ? `(SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?)` : `NULL`} as user_vote
            FROM rankings r
            LEFT JOIN profiles p ON r.user_id = p.id
            ${pageWhere}
            ORDER BY ${orderExpr}
            LIMIT ? OFFSET ?
          `;
          // ลำดับ "?" ในข้อความ query: user_vote -> pageWhere -> LIMIT/OFFSET
          params = [
            ...(currentUserId ? [currentUserId] : []),
            ...pageWhereParams,
            limit, offset,
          ];
        } else {
          const candLimit = Math.max(PERSONALIZE_CANDIDATE_MIN, offset + limit);
          query = `
            WITH
            mine AS (
              -- 📍 [ใหม่]: โพสต์ล่าสุดของ "คนที่กำลังดู" เอง ถ้าสร้างมาไม่เกิน 24 ชม. — pin ให้
              -- ขึ้นบนสุดเสมอในฟีดของตัวเอง กันปัญหา "สร้าง Tier List ใหม่แล้วไม่เห็นในฟีด"
              -- (affinity ตาม hashtag คำนวณจาก like เก่า ไม่รู้จัก hashtag ใหม่ที่เพิ่งสร้าง
              -- เลยเรียงโพสต์ใหม่ไปอยู่ลึกได้) ตั้งเพดาน 24 ชม. กันไม่ให้โพสต์เก่าค้างบนสุดถาวร
              -- ถ้า pin ไม่ตรงกับ cand ด้านล่าง (เช่นโดน pageWhere กรองออก) จะไม่มีผลอะไรเลย
              -- เพราะใช้แค่เทียบเท่ากันใน ORDER BY ไม่ได้ยัดแถวเพิ่ม
              SELECT id FROM rankings
              WHERE user_id = ? AND created_at > datetime('now', '-1 day')
              ORDER BY created_at DESC, id DESC
              LIMIT 1
            ),
            aff AS (
              SELECT rh.hashtag, COUNT(*) AS affinity
              FROM votes v JOIN ranking_hashtags rh ON v.ranking_id = rh.ranking_id
              WHERE v.user_id = ? AND v.vote_type = 'like'
              GROUP BY rh.hashtag
            ),
            cand AS (
              SELECT r.id, r.created_at
              FROM rankings r
              ${pageWhere}
              ORDER BY r.created_at DESC, r.id DESC
              LIMIT ?
            )
            SELECT r.*, p.username, p.avatar_url,
              (SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?) as user_vote
            FROM cand c
            JOIN rankings r ON r.id = c.id
            LEFT JOIN profiles p ON r.user_id = p.id
            ORDER BY (c.id = (SELECT id FROM mine)) DESC,
              (SELECT COALESCE(SUM(aff.affinity), 0) FROM ranking_hashtags rh JOIN aff ON aff.hashtag = rh.hashtag WHERE rh.ranking_id = c.id) DESC,
              c.created_at DESC, c.id DESC
            LIMIT ? OFFSET ?
          `;
          // ลำดับ "?" ในข้อความ query: mine.user_id -> aff.user_id -> cand(pageWhere, candLimit) ->
          // user_vote(currentUserId) -> LIMIT/OFFSET
          params = [
            currentUserId,
            currentUserId,
            ...pageWhereParams, candLimit,
            currentUserId,
            limit, offset,
          ];
        }

        // Home path: rankings = แถวในลำดับ homePoolIds ที่ slice ได้ (เรียงคืนตาม sliceIds)
        // path เก่า: rankings = ผลจาก query ตามปกติ (author/hashtag/template/sort …)
        let rankings;
        if (homePoolIds) {
          const sliceIds = homePoolIds.slice(offset, offset + limit);
          if (sliceIds.length === 0) {
            rankings = [];
          } else {
            const placeholders = sliceIds.map(() => '?').join(',');
            const { results: homeRows } = await db.prepare(`
              SELECT r.*, p.username, p.avatar_url,
                ${currentUserId ? `(SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?)` : `NULL`} as user_vote
              FROM rankings r
              LEFT JOIN profiles p ON r.user_id = p.id
              WHERE r.id IN (${placeholders})
            `).bind(...(currentUserId ? [currentUserId, ...sliceIds] : sliceIds)).all();
            // IN (...) ไม่การันตีลำดับ → เรียงเองให้ตรงหน้าของฟีด
            const rowById = {};
            (homeRows || []).forEach((row) => { rowById[row.id] = row; });
            rankings = sliceIds.map((id) => rowById[id]).filter(Boolean);
          }
        } else {
          const { results: legacyRows } = await db.prepare(query).bind(...params).all();
          rankings = legacyRows;
        }

        let total = null;
        if (templateId) {
          const { results: totalRows } = await db.prepare(
            `SELECT COUNT(*) as n FROM rankings WHERE template_id = ?`
          ).bind(templateId).all();
          total = totalRows[0]?.n || 0;
        }

        let formattedRankings = [];
        if (rankings.length > 0) {
          const rankingIds = rankings.map(r => r.id);
          const placeholders = rankingIds.map(() => '?').join(',');

          // 📍 [ใหม่]: ดึง tier definition (label+color+id) ของ template ที่แต่ละ ranking ในหน้านี้
          // ผูกอยู่ — เดิม endpoint นี้ไม่เคยส่ง tiers กลับมาเลย ทำให้ Home Feed/Feed Detailed ต้อง
          // เดาสี tier จากแค่ label เฉยๆ (ดู docs/tier-list-feed-debug-plan.md) แตะแค่ template ของ
          // หน้านี้เท่านั้น (≤ limit แถว ไม่ใช่ทุก template ในระบบ) ยิงคู่กับ ranking_items ด้วย
          // Promise.all ลด round-trip แทนที่จะรอทีละ query
          const templateIds = [...new Set(rankings.map(r => r.template_id).filter(Boolean))];
          const authorIds = [...new Set(rankings.map(r => r.user_id).filter(Boolean))];
          const [{ results: allItems }, tplRows, { templateUseRows, communityHistogram }, followedRows] = await Promise.all([
            db.prepare(`
              SELECT ri.*, i.name as item_name, i.image_url as item_image
              FROM ranking_items ri
              LEFT JOIN items i ON (ri.item_id = i.id OR ri.item_id = i.name)
              WHERE ri.ranking_id IN (${placeholders})
              ORDER BY ri.position ASC
            `).bind(...rankingIds).all(),
            templateIds.length > 0
              ? db.prepare(
                  `SELECT id, creator_id, title, tiers FROM templates WHERE id IN (${templateIds.map(() => '?').join(',')})`
                ).bind(...templateIds).all().then(res => res.results)
              : Promise.resolve([]),
            // A just-published pinned post must see its new contribution immediately.
            feedCommunityStats(context, db, templateIds, { fresh: !!runPin }),
            currentUserId && authorIds.length > 0
              ? db.prepare(`
                  SELECT following_id FROM follows
                  WHERE follower_id = ? AND following_id IN (${authorIds.map(() => '?').join(',')})
                `).bind(currentUserId, ...authorIds).all().then(res => res.results || [])
              : Promise.resolve([]),
          ]);

          const followedSet = new Set((followedRows || []).map(f => f.following_id));

          const itemsMap = {};
          allItems.forEach(ri => {
            if (!itemsMap[ri.ranking_id]) itemsMap[ri.ranking_id] = [];
            itemsMap[ri.ranking_id].push({
              ...ri,
              item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
            });
          });

          const tiersByTemplateId = {};
          const templateMetaById = {};
          tplRows.forEach(t => {
            tiersByTemplateId[t.id] = parseTiers(t.tiers);
            templateMetaById[t.id] = { creator_id: t.creator_id ?? null, title: t.title ?? null };
          });

          const usesByTemplateId = {};
          (templateUseRows || []).forEach((row) => {
            usesByTemplateId[row.template_id] = Number(row.uses) || 0;
          });

          // Community disagreement is the average distance between an item's tier
          // and the community's average tier for that item, normalized to 0–100.
          // 0 = follows the community average; 100 = maximally different.
          const communityByItem = {};
          (communityHistogram || []).forEach((row) => {
            const tierDefinitions = tiersByTemplateId[row.template_id] || [];
            const tierIndex = tierDefinitions.findIndex((tier) => String(tier.label) === String(row.tier));
            if (tierIndex < 0) return;
            const key = `${row.template_id}:${row.item_id}`;
            if (!communityByItem[key]) communityByItem[key] = { sum: 0, count: 0 };
            const placements = Number(row.placements) || 0;
            communityByItem[key].sum += tierIndex * placements;
            communityByItem[key].count += placements;
          });

          const disagreementByRankingId = {};
          rankings.forEach((ranking) => {
            const tierDefinitions = tiersByTemplateId[ranking.template_id] || [];
            const divisor = Math.max(1, tierDefinitions.length - 1);
            const placementRows = itemsMap[ranking.id] || [];
            let totalDistance = 0;
            let samples = 0;
            placementRows.forEach((placement) => {
              const ownIndex = tierDefinitions.findIndex((tier) => String(tier.label) === String(placement.tier));
              const aggregate = communityByItem[`${ranking.template_id}:${placement.item_id}`];
              if (ownIndex < 0 || !aggregate?.count) return;
              const averageIndex = aggregate.sum / aggregate.count;
              totalDistance += Math.abs(ownIndex - averageIndex) / divisor;
              samples += 1;
            });
            disagreementByRankingId[ranking.id] = samples > 0
              ? Math.round((totalDistance / samples) * 100)
              : null;
          });

          formattedRankings = rankings.map(r => {
            const tpl = r.template_id ? templateMetaById[r.template_id] : null;
            const isOriginal = !r.template_id || (tpl && tpl.creator_id !== null && tpl.creator_id === r.user_id);
            return {
              ...r,
              is_original: isOriginal,
              template_title: tpl?.title || null,
              profile: {
                id: r.user_id,
                username: r.username || 'Unknown',
                avatar_url: r.avatar_url,
                is_following: followedSet.has(r.user_id),
              },
              stats: {
                likes: r.likes_count,
                dislikes: r.dislikes_count,
                comments: r.comments_count,
                templateUses: r.template_id ? (usesByTemplateId[r.template_id] || 0) : 0,
                communityDisagreement: disagreementByRankingId[r.id],
              },
              user_vote: r.user_vote ?? null,
              tiers: r.template_id ? (tiersByTemplateId[r.template_id] ?? null) : null,
              ranking_items: itemsMap[r.id] || []
            };
          });
        }

        // 📍 cache ที่ edge ได้เฉพาะตอนไม่มี currentUserId เท่านั้น — มี user_vote ฝังอยู่ใน response
        // ทุกแถวถ้ามี currentUserId ซึ่งเป็นข้อมูลเฉพาะผู้ชม ห้าม cache แบบ public เด็ดขาด
        // (ดู docs/row-read-optimization-plan.md §6/§8 — คำเตือนสำคัญเรื่องการรั่วข้อมูลข้ามผู้ใช้)
        const cacheHeaders = currentUserId
          ? { 'Cache-Control': 'private, no-store' }
          : { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' };
        return jsonResponse({
          success: true,
          data: formattedRankings,
          page,
          limit,
          total,
          ...(homePoolIds !== null ? {
            feedType,
            feedLocked,
            personalizationFallback,
            // Temporary compatibility for a frontend deployed before this rename.
            kindredLocked: requestedFeedType === 'kindred' && feedLocked,
          } : {}),
        }, 200, cacheHeaders);
      }
    }

    // 🟢 [POST] สร้าง Ranking ใหม่
    if (request.method === 'POST') {
      const createGate = consumeMemoryRateLimit('ranking-create', auth.user.id, { limit: 10, windowSeconds: 3600 });
      if (!createGate.allowed) return rateLimitResponse(createGate, 'กรุณารอสักครู่ก่อนสร้างโพสต์ใหม่');

      const body = await readJsonBody(request, INPUT_LIMITS.rankingJson);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const { payload, items, template } = body;
      if (!isPlainObject(payload) || !Array.isArray(items) || !items.length) {
        return jsonResponse({ success: false, error: 'Ranking and ranked items are required' }, 400);
      }
      if (items.length > INPUT_LIMITS.items) {
        return jsonResponse({ success: false, error: `จำนวนไอเทมเกิน ${INPUT_LIMITS.items}` }, 400);
      }

      const cleanPayload = {
        title: payload.title == null ? 'Untitled' : assertString(payload.title, 'payload.title', { min: 1, max: INPUT_LIMITS.title, trim: true }),
        description: payload.description == null ? '' : assertString(payload.description, 'payload.description', { max: INPUT_LIMITS.description }),
        hashtags: payload.hashtags == null ? '' : assertString(payload.hashtags, 'payload.hashtags', { max: INPUT_LIMITS.hashtags * (INPUT_LIMITS.hashtag + 2) }),
        template_id: assertId(payload.template_id, 'payload.template_id', { optional: true }) || null,
        user_id: auth.user.id,
      };
      assertHashtags(cleanPayload.hashtags, 'payload.hashtags');
      cleanPayload.hashtags = canonicalizeHashtags(cleanPayload.hashtags);
      const challengeSourceId = assertId(body.challenge_source_id, 'challenge_source_id', { optional: true }) || null;
      let challengeSource = null;
      if (challengeSourceId) {
        challengeSource = await db.prepare(`
          SELECT id, user_id, template_id FROM rankings WHERE id = ?
        `).bind(challengeSourceId).first();
        if (!challengeSource || !cleanPayload.template_id || challengeSource.template_id !== cleanPayload.template_id) {
          return jsonResponse({ success: false, error: 'Invalid challenge source' }, 400);
        }
      }

      const cleanItems = items.map((item, index) => {
        if (!isPlainObject(item)) throw new RequestError(`items[${index}] must be an object`);
        return {
          item_id: assertString(item.item_id, `items[${index}].item_id`, { min: 1, max: INPUT_LIMITS.itemName, trim: true }),
          tier: assertString(item.tier, `items[${index}].tier`, { min: 1, max: INPUT_LIMITS.tierLabel, trim: true }),
          position: assertInteger(item.position, `items[${index}].position`, { min: 0, max: INPUT_LIMITS.items - 1 }),
        };
      });
      if (cleanItems.some((item, index) => cleanItems.findIndex(other => other.item_id === item.item_id) !== index)) {
        return jsonResponse({ success: false, error: 'Ranking items must be unique' }, 400);
      }

      let cleanTemplate = null;
      if (template !== undefined && template !== null) {
        if (!isPlainObject(template)) return jsonResponse({ success: false, error: 'template must be an object' }, 400);
        if (!Array.isArray(template.tiers) || !template.tiers.length || template.tiers.length > INPUT_LIMITS.tiers) {
          return jsonResponse({ success: false, error: `template.tiers must contain 1-${INPUT_LIMITS.tiers} tiers` }, 400);
        }
        if (!Array.isArray(template.items) || template.items.length > INPUT_LIMITS.items) {
          return jsonResponse({ success: false, error: `template.items must contain at most ${INPUT_LIMITS.items} items` }, 400);
        }
        cleanTemplate = {
          title: assertString(template.title, 'template.title', { min: 1, max: INPUT_LIMITS.title, trim: true }),
          description: template.description == null ? '' : assertString(template.description, 'template.description', { max: INPUT_LIMITS.description }),
          hashtags: template.hashtags == null ? '' : assertString(template.hashtags, 'template.hashtags', { max: INPUT_LIMITS.hashtags * (INPUT_LIMITS.hashtag + 2) }),
          tiers: template.tiers.map((tier, index) => {
            if (!isPlainObject(tier)) throw new RequestError(`template.tiers[${index}] must be an object`);
            return {
              id: tier.id == null ? undefined : assertString(tier.id, `template.tiers[${index}].id`, { min: 1, max: INPUT_LIMITS.id, trim: true }),
              label: assertString(tier.label, `template.tiers[${index}].label`, { min: 1, max: INPUT_LIMITS.tierLabel, trim: true }),
              color: assertString(tier.color, `template.tiers[${index}].color`, { min: 1, max: INPUT_LIMITS.tierColor, trim: true }),
            };
          }),
          items: template.items.map((item, index) => {
            if (!isPlainObject(item)) throw new RequestError(`template.items[${index}] must be an object`);
            return {
              name: assertString(item.name, `template.items[${index}].name`, { min: 1, max: INPUT_LIMITS.itemName, trim: true }),
              position: item.position == null ? index : assertInteger(item.position, `template.items[${index}].position`, { min: 0, max: INPUT_LIMITS.items - 1 }),
              tier: item.tier == null
                ? null
                : assertString(item.tier, `template.items[${index}].tier`, { min: 1, max: INPUT_LIMITS.tierLabel, trim: true }),
            };
          }),
        };
        assertHashtags(cleanTemplate.hashtags, 'template.hashtags');
        cleanTemplate.hashtags = canonicalizeHashtags(cleanTemplate.hashtags);
        const tierLabels = cleanTemplate.tiers.map(tier => tier.label);
        if (new Set(tierLabels).size !== tierLabels.length) return jsonResponse({ success: false, error: 'Tier labels must be unique' }, 400);
      }

      const rankingId = crypto.randomUUID();
      const statements = [];
      let templateId = null;

      // tiers ปัจจุบันของ template (ตัวที่ใช้จัดอันดับ) — ใช้ map ชื่อ tier → index แล้วให้คะแนน
      // แถวบนสุดสูงสุด (score = tierCount - index) บันทึกลง ranking_item_scores ตอน publish
      let tiersDef = null;
      let existingTemplateCreatorId = null;
      if (cleanTemplate) {
        tiersDef = cleanTemplate.tiers;
      } else if (cleanPayload.template_id) {
        const tr = await db.prepare(`SELECT tiers, creator_id FROM templates WHERE id = ?`).bind(cleanPayload.template_id).first();
        if (!tr) return jsonResponse({ success: false, error: 'Template not found' }, 404);
        existingTemplateCreatorId = tr.creator_id || null;
        const storedTiers = parseTiers(tr.tiers);
        tiersDef = Array.isArray(storedTiers) ? storedTiers.filter(tier => isPlainObject(tier) && typeof tier.label === 'string') : [];
      }
      const tierIndexByLabel = {};
      (tiersDef || []).forEach((t, i) => { tierIndexByLabel[String(t.label)] = i; });
      const tierCount = tiersDef?.length || 0;
      if (tierCount && cleanItems.some(item => tierIndexByLabel[item.tier] === undefined)) {
        return jsonResponse({ success: false, error: 'Ranking item references an unknown tier' }, 400);
      }

      // 📍 [ใหม่]: publish จากหน้า Create จะส่ง `template` มาด้วย → สร้าง Template + template_items
      // ใน batch เดียวกับ ranking (atomic ตาม SDS §8.2/§9.2) ทำให้ template เข้าหน้า Discover
      // และ hashtag ที่เลือก/สร้างใหม่ถูกนับบน PopularHashtags (ซึ่งนับ tag จาก templates.hashtags)
      if (cleanTemplate) {
        templateId = crypto.randomUUID();
        statements.push(db.prepare(
          `INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        ).bind(
          templateId,
          cleanPayload.user_id,
          cleanTemplate.title,
          cleanTemplate.description,
          cleanTemplate.hashtags,
          JSON.stringify(cleanTemplate.tiers)
        ));

        // item pool ของ template = item ทุกชิ้นที่ user เพิ่มมา — เก็บ tier label ที่ user จัดไว้ด้วย
        // (แบบเดียวกับ template เดิม/seed) ไม่งั้น TemplateCard พรีวิวใน Discover แยก item ออกเป็น
        // tier rows ไม่ได้ก็โชว์ fallback แค่ "N items" (ดู docs วิธีแสดง: src/components/template/TemplateCard.jsx
        // กลุ่ม tier จาก template_items.tier) — ถ้า caller เก่าส่ง payload ไม่มี tier ให้ map จาก ranking
        // item ที่ชื่อเดียวกันใน batch นี้แทน; dedupe ด้วยชื่อ กัน item ซ้ำชื่อเดียวกันโผล่สองการ์ดตอน remix
        const tierByRankingItem = new Map(cleanItems.map((item) => [item.item_id, item.tier]));
        const seenNames = new Set();
        const templateItems = [];
        cleanTemplate.items.forEach((item) => {
          const name = item.name;
          if (!name || seenNames.has(name)) return;
          seenNames.add(name);
          templateItems.push({
            id: crypto.randomUUID(),
            item_id: name,
            tier: item.tier ?? tierByRankingItem.get(name) ?? null,
            position: item.position,
          });
        });
        if (templateItems.length > 0) {
          statements.push(db.prepare(
            `INSERT INTO template_items (id, template_id, item_id, tier, position)
             SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.item_id'),
                    json_extract(value, '$.tier'), CAST(json_extract(value, '$.position') AS INTEGER)
             FROM json_each(?2)`
          ).bind(templateId, JSON.stringify(templateItems)));
        }
      }

      statements.push(db.prepare(
        `INSERT INTO rankings (id, template_id, title, description, hashtags, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      ).bind(
        rankingId, cleanPayload.template_id || templateId, cleanPayload.title, cleanPayload.description,
        cleanPayload.hashtags, cleanPayload.user_id
      ));

      const effectiveTemplateId = cleanPayload.template_id || templateId;

      // แจ้งคนที่ติดตามเจ้าของโพสต์หรือหัวข้อที่เกี่ยวข้องเมื่อมี Ranking ใหม่
      // (ใช้ UNION รวมผู้รับซ้ำ และ INSERT OR IGNORE กันการยิงซ้ำจาก retry)
      statements.push(db.prepare(`
        INSERT OR IGNORE INTO notifications
          (id, user_id, actor_id, type, ranking_id)
        SELECT lower(hex(randomblob(16))), recipient_id, ?, 'following_rank', ?
        FROM (
          SELECT f.follower_id AS recipient_id
          FROM follows f
          WHERE f.following_id = ?
          UNION
          SELECT tf.user_id AS recipient_id
          FROM topic_follows tf
          WHERE tf.topic_type = 'template' AND tf.topic_key = ?
          UNION
          SELECT tf.user_id AS recipient_id
          FROM topic_follows tf
          WHERE tf.topic_type = 'hashtag'
            AND EXISTS (SELECT 1 FROM ranking_hashtags rh WHERE rh.ranking_id = ? AND rh.hashtag = tf.topic_key)
        ) recipients
        WHERE recipient_id != ?
      `).bind(
        cleanPayload.user_id, rankingId,
        cleanPayload.user_id, effectiveTemplateId,
        rankingId, cleanPayload.user_id
      ));

      if (effectiveTemplateId) {
        // เจ้าของ Template จะรู้ว่ามีคนหยิบไปจัดใหม่
        if (existingTemplateCreatorId && existingTemplateCreatorId !== cleanPayload.user_id) {
          statements.push(db.prepare(`
            INSERT OR IGNORE INTO notifications
              (id, user_id, actor_id, type, ranking_id, template_id)
            VALUES (?, ?, ?, 'template_use', ?, ?)
          `).bind(
            crypto.randomUUID(), existingTemplateCreatorId, cleanPayload.user_id, rankingId, effectiveTemplateId
          ));
        }

        // ผู้สร้าง Template และผู้ที่ติดตาม Template จะได้รับแจ้งว่า Community Average เปลี่ยน
        statements.push(db.prepare(`
          INSERT OR IGNORE INTO notifications
            (id, user_id, actor_id, type, ranking_id, template_id)
          SELECT lower(hex(randomblob(16))), recipient_id, ?, 'community_average', ?, ?
          FROM (
            SELECT creator_id AS recipient_id
            FROM templates
            WHERE id = ? AND creator_id IS NOT NULL
            UNION
            SELECT user_id AS recipient_id
            FROM topic_follows
            WHERE topic_type = 'template' AND topic_key = ?
          ) recipients
          WHERE recipient_id != ?
        `).bind(
          cleanPayload.user_id, rankingId, effectiveTemplateId,
          effectiveTemplateId, effectiveTemplateId, cleanPayload.user_id
        ));
      }

      if (challengeSource?.user_id && challengeSource.user_id !== cleanPayload.user_id) {
        statements.push(db.prepare(`
          INSERT OR IGNORE INTO notifications
            (id, user_id, actor_id, type, ranking_id, source_ranking_id)
          VALUES (?, ?, ?, 'challenge', ?, ?)
        `).bind(
          crypto.randomUUID(), challengeSource.user_id, cleanPayload.user_id, rankingId, challengeSource.id
        ));
      }

      if (effectiveTemplateId) {
        statements.push(db.prepare(
          `UPDATE templates SET use_count = use_count + 1 WHERE id = ?`
        ).bind(effectiveTemplateId));
      }

      if (cleanItems.length > 0) {
        const effTemplateId = cleanPayload.template_id || templateId;
        const rankingItems = [];
        const scoreItems = [];
        cleanItems.forEach(item => {
          rankingItems.push({
            id: crypto.randomUUID(),
            item_id: item.item_id,
            tier: item.tier,
            position: item.position,
          });

          // 📍 บันทึกสถิติความนิยม: เฉพาะ item ที่จัดลง tier ที่ตรงกับ template เท่านั้น
          // (item ใน pool ที่ยังไม่จัด = tier null → ไม่นับ) — freeze คะแนน ณ เวลาสร้าง
          const tierIdx = tierIndexByLabel[String(item.tier)];
          if (tierIdx !== undefined) {
            scoreItems.push({
              id: crypto.randomUUID(),
              item_id: item.item_id,
              tier_index: tierIdx,
              score: tierCount - tierIdx,
            });
          }
        });

        statements.push(db.prepare(
          `INSERT INTO ranking_items (id, ranking_id, item_id, tier, position)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.item_id'),
                  json_extract(value, '$.tier'), CAST(json_extract(value, '$.position') AS INTEGER)
           FROM json_each(?2)`
        ).bind(rankingId, JSON.stringify(rankingItems)));

        if (scoreItems.length > 0) {
          statements.push(db.prepare(
            `INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score)
             SELECT json_extract(value, '$.id'), ?1, ?2, json_extract(value, '$.item_id'),
                    CAST(json_extract(value, '$.tier_index') AS INTEGER),
                    CAST(json_extract(value, '$.score') AS INTEGER)
             FROM json_each(?3)`
          ).bind(rankingId, effTemplateId, JSON.stringify(scoreItems)));
        }
      }

      // D1 batch is a transaction: one failed statement rolls back the entire publish.
      await db.batch(statements);
      return jsonResponse({ success: true, data: { ...cleanPayload, id: rankingId, template_id: cleanPayload.template_id || templateId } }, 201);
    }

    // 🟢 [DELETE] ลบ Ranking ของตัวเอง
    if (request.method === 'DELETE') {
      const currentUserId = auth.user?.id;
      if (!currentUserId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      const deleteGate = consumeMemoryRateLimit('ranking-delete', currentUserId, { limit: 10, windowSeconds: 3600 });
      if (!deleteGate.allowed) return rateLimitResponse(deleteGate);
      const payload = await readJsonBody(request);
      if (!isPlainObject(payload)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const targetId = assertId(payload.id, 'id');

      const ranking = await db.prepare('SELECT user_id FROM rankings WHERE id = ?').bind(targetId).first();
      if (!ranking) return jsonResponse({ success: false, error: 'Not found' }, 404);
      if (ranking.user_id !== currentUserId) return jsonResponse({ success: false, error: 'Forbidden' }, 403);

      await db.batch([
        db.prepare('DELETE FROM ranking_items WHERE ranking_id = ?').bind(targetId),
        db.prepare('DELETE FROM votes WHERE ranking_id = ?').bind(targetId),
        db.prepare('DELETE FROM comments WHERE ranking_id = ?').bind(targetId),
        db.prepare('DELETE FROM ranking_item_scores WHERE ranking_id = ?').bind(targetId),
        db.prepare('DELETE FROM reports WHERE ranking_id = ?').bind(targetId),
        db.prepare('DELETE FROM rankings WHERE id = ?').bind(targetId),
      ]);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Ranking request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
