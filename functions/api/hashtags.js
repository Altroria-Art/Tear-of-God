// ==========================================
// GET /api/hashtags?page=&limit=&sort=&q=
// รวม hashtag ทั้งหมดจาก templates.hashtags (คอลัมน์ CSV) ด้วย recursive CTE เดียว
// นับจำนวน distinct templates ที่มี tag นั้น (content_count = จำนวน templates ที่ติดแท็ก)
// ใช้ bound params ตายตัว 3 ตัว (q, limit, offset) ไม่ว่าจะมี template กี่แถวก็ตาม
// (ดู docs/feature-discover-view-all-pages.md §6 เรื่องลิมิต 100 bound params ของ D1)
// ==========================================
import { internalErrorResponse } from '../lib/request-guard.js';

// Bumped whenever the catalog's shape/TTL policy changes so deployments
// invalidate every previously-cached entry at once (the Cache API has no
// wildcard/delete-by-prefix — keys are full URLs, one per page/limit/sort/q/
// suggest variant). Included ONLY in the internal cache key, never sent to the
// client or used as a filter.
const CATALOG_CACHE_VERSION = 'v2';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // Only public catalog data. Normalize aliases/parameter ordering without
  // changing filter semantics; cookies never participate in this cache.
  url.pathname = '/api/hashtags';
  url.searchParams.set('catalog', CATALOG_CACHE_VERSION);
  url.searchParams.sort();
  const cacheKey = new Request(url, { method: 'GET' });
  const cache = globalThis.caches?.default;
  try {
    const hit = await cache?.match(cacheKey);
    if (hit) {
      const remaining = Math.floor((Number(hit.headers.get('X-Catalog-Expires')) - Date.now()) / 1000);
      if (remaining > 0) {
        const response = new Response(hit.body, hit);
        response.headers.delete('X-Catalog-Expires');
        response.headers.set('Cache-Control', `public, max-age=${remaining}`);
        return response;
      }
    }
  } catch { /* Cache availability must never affect catalog access. */ }

  const response = await queryHashtags(context);
  if (cache && response.ok) {
    const ttl = Number(/max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '')?.[1]);
    if (ttl > 0) {
      const copy = response.clone();
      copy.headers.set('X-Catalog-Expires', String(Date.now() + ttl * 1000));
      const pending = (async () => { try { await cache.put(cacheKey, copy); } catch { /* best effort */ } })();
      if (typeof context.waitUntil === 'function') context.waitUntil(pending);
      else await pending;
    }
  }
  return response;
}

async function queryHashtags(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const db = env.tear_of_god_db;

  try {
    const suggest = url.searchParams.get('suggest') === '1';
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;
    const sort = url.searchParams.get('sort'); // 'used' (default) | 'az'
    const q = (url.searchParams.get('q') || '').trim();

    const orderSql = sort === 'az' ? `tag ASC` : `content_count DESC, tag ASC`;

    // 📍 Lightweight suggestion path for Navbar autocomplete (P2-B2):
    // Filters templates before recursive split via push-down filter on raw hashtags.
    // Avoids window function COUNT(*) OVER() and never runs second CTE query on zero results.
    if (suggest) {
      const suggestCte = `
        WITH RECURSIVE split(tag, rest, tid) AS (
          SELECT '', hashtags || ',', id
            FROM templates
           WHERE hashtags IS NOT NULL
             AND hashtags <> ''
             AND (?1 = '' OR instr(lower(hashtags), lower(?1)) > 0)
          UNION ALL
          SELECT trim(substr(rest, 1, instr(rest, ',') - 1)),
                 substr(rest, instr(rest, ',') + 1),
                 tid
            FROM split
           WHERE rest <> ''
        ),
        tags AS (
          SELECT lower('#' || replace(tag, '#', '')) AS tag, COUNT(DISTINCT tid) AS content_count
            FROM split
           WHERE tag <> ''
           GROUP BY lower('#' || replace(tag, '#', ''))
          HAVING COUNT(DISTINCT tid) > 0
        )
        SELECT tag, content_count
          FROM tags
         WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
         ORDER BY ${orderSql}
         LIMIT ?2 OFFSET ?3
      `;
      const { results: rows = [] } = await db.prepare(suggestCte).bind(q, limit, offset).all();
      return Response.json({
        success: true,
        data: rows.map(r => ({ tag: r.tag, content_count: r.content_count })),
        page,
        limit,
        total: rows.length
      }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    }

    // 📍 แหล่งข้อมูล hashtag มาจาก templates เท่านั้น (content_count = distinct templates ที่มี tag นั้น)
    // ใช้ recursive split แกะ comma-separated hashtags เป็นแต่ละ tag แล้ว GROUP BY เพื่อคำนวณ content_count
    const cte = `
      WITH RECURSIVE split(tag, rest, tid) AS (
        SELECT '', hashtags || ',', id
          FROM templates
         WHERE hashtags IS NOT NULL AND hashtags <> ''
        UNION ALL
        SELECT trim(substr(rest, 1, instr(rest, ',') - 1)),
               substr(rest, instr(rest, ',') + 1),
               tid
          FROM split
         WHERE rest <> ''
      ),
      tags AS (
        SELECT lower('#' || replace(tag, '#', '')) AS tag, COUNT(DISTINCT tid) AS content_count
          FROM split
         WHERE tag <> ''
         GROUP BY lower('#' || replace(tag, '#', ''))
        HAVING COUNT(DISTINCT tid) > 0
      )
    `;

    // 📍 เดิม query นี้รัน recursive CTE เดียวกันซ้ำ 2 รอบ (rows + total แยกกันคนละ statement) —
    // วัดจริงจาก D1 trace: ~874 rows/request (457+417) ทั้งที่ควรรันแค่ครั้งเดียว (ดู
    // docs/row-read-optimization-plan.md §5/§8, C5) ใช้ COUNT(*) OVER() ให้ total ติดมากับ
    // แต่ละแถวของหน้าที่ขอแทน — รันซ้ำ CTE ก็ต่อเมื่อหน้าที่ขอไม่มีแถวเหลือ (เช่น page เกิน
    // ขอบเขตหลัง filter เปลี่ยน) ซึ่งเป็นกรณีหายากเท่านั้น
    const { results: rows } = await db.prepare(`
      ${cte}
      SELECT tag, content_count, COUNT(*) OVER() AS total_count FROM tags
       WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
       ORDER BY ${orderSql}
       LIMIT ?2 OFFSET ?3
    `).bind(q, limit, offset).all();

    let total = rows[0]?.total_count ?? (page === 1 ? 0 : null);
    if (total === null) {
      const { results: totalRows } = await db.prepare(`
        ${cte}
        SELECT COUNT(*) as n FROM tags
         WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
      `).bind(q).all();
      total = totalRows[0]?.n || 0;
    }

    // M2: ข้อมูล public ล้วน (ไม่มี field เฉพาะผู้ชม; page/limit/sort/q อยู่ใน URL จึงแยก
    // cache key กันอยู่แล้ว) — ทุก variant ใช้ TTL สั้น 30s เท่ากันเพราะ catalog ถูก rebuild
    // จาก templates.hashtags แบบ live: ลบ/สร้าง template แล้วต้องไม่ให้หน้า hashtag ค้างเกิน
    // 30s (เดิม browse q ว่าง cache 300s — หลังลบ template count/แท็กเก่าค้าง 5 นาที จึงลดเหลือ
    // 30s ซึ่งเท่ากับ search/suggest อยู่แล้ว; ดู docs/hashtag-catalog-cache-staleness-plan.md)
    // (เหตุผล TTL สั้นเดิม + การตัด SWR ดู docs/discover-template-view-refresh-and-tracking-plan.md)
    return Response.json(
      {
        success: true,
        data: rows.map(r => ({ tag: r.tag, content_count: r.content_count })),
        page,
        limit,
        total
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error) {
    console.error('Hashtag query failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}
