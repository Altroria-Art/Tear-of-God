import { assertId, consumeMemoryRateLimit, internalErrorResponse, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';
import { checkTemplateCooldown } from '../lib/cooldown.js';
import { publicResponseCache } from '../lib/public-response-cache.js';
import { templateUsageSql } from '../lib/template-usage.js';
import { buildCommunityAverage } from '../lib/community-average.js';

function parseTiers(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // Saved lists and detail have live/private contracts. Cache only the public
  // catalog; bookmark overlays always come from D1 after the shared read.
  const suggest = url.searchParams.get('suggest') === '1';
  if (url.searchParams.get('id') || (!suggest && url.searchParams.get('saved') === 'true')) return queryTemplates(context);
  const keyUrl = new URL('/api/__template_catalog_v1', url);
  for (const name of ['q', 'hashtag', 'category', 'limit', 'page', 'sort', 'suggest', 'fields']) {
    if (url.searchParams.has(name)) keyUrl.searchParams.set(name, url.searchParams.get(name));
  }
  keyUrl.searchParams.sort();
  try {
    const response = await publicResponseCache(context, new Request(keyUrl), suggest ? 60 : 10,
      () => queryTemplates({ ...context, data: { ...context.data, user: null } }));
    const viewerId = context.data?.user?.id;
    if (!response.ok || suggest || !viewerId) return response;
    const payload = await response.json();
    const ids = payload.data.map(template => template.id);
    const saved = new Set();
    // A list can contain 100 cards; keep each query below D1's bind limit.
    for (let start = 0; start < ids.length; start += 90) {
      const batch = ids.slice(start, start + 90);
      const { results } = await context.env.tear_of_god_db.prepare(
        `SELECT template_id FROM template_bookmarks WHERE user_id = ? AND template_id IN (${batch.map(() => '?').join(',')})`
      ).bind(viewerId, ...batch).all();
      for (const row of results) saved.add(row.template_id);
    }
    payload.data = payload.data.map(template => ({ ...template, is_saved: saved.has(template.id) }));
    return Response.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Template catalog failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}

async function queryTemplates(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get('id');
  const db = env.tear_of_god_db;

  try {
    // ==========================================
    // โหมด list: GET /api/templates?hashtag=..&category=..&limit=..
    // Uses come from rankings, or the exact trigger-maintained 0029 counter
    // after explicit activation. Views still come from template_views.
    // Never read the legacy templates.use_count/view_count mirrors here.
    // ==========================================
    if (!templateId) {
      const suggest = url.searchParams.get('suggest') === '1';
      const hashtag = url.searchParams.get('hashtag') || url.searchParams.get('category'); // legacy filter alias
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const savedOnly = !suggest && url.searchParams.get('saved') === 'true';
      const metadataOnly = url.searchParams.get('fields') === 'meta';
      const viewerId = context.data.user?.id || null;
      if (savedOnly && !viewerId) return Response.json({ success: false, error: 'Please log in' }, { status: 401 });
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const offset = (page - 1) * limit;
      const sort = url.searchParams.get('sort'); // 'popular' (default) | 'recent' | 'views'

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (q) { whereSql += " AND (instr(lower(t.title), lower(?)) > 0 OR instr(lower(COALESCE(t.description, '')), lower(?)) > 0 OR instr(lower(COALESCE(t.hashtags, '')), lower(?)) > 0)"; whereParams.push(q, q, q); }
      if (savedOnly) { whereSql += ' AND EXISTS (SELECT 1 FROM template_bookmarks b WHERE b.template_id = t.id AND b.user_id = ?)'; whereParams.push(viewerId); }
      if (hashtag) {
        // แมตช์แท็กแบบเป๊ะ (ไม่ใช่ substring) — ลบ '#' ออกจากทั้งสองฝั่ง (ข้อมูลเก่าเก็บ '#anime'
        // ข้อมูลที่เขียนมาใหม่อาจเก็บ 'anime' ได้) แล้วห่อทั้งสองฝั่งด้วย ',' ค้นหา ',tag,' — กัน
        // ปัญหา LIKE '%tag%' ที่ 'Pop' จะไปแมตช์ '#TPop' ด้วย (ดู docs/feature-discover-view-all-pages.md §4)
        // และทำให้ count จาก /api/hashtags กับ list นี้ใช้ source/filter เดียวกันเสมอ
        whereSql += ` AND EXISTS (SELECT 1 FROM template_hashtags th WHERE th.template_id = t.id AND th.hashtag = lower(trim(ltrim(trim(?), '#'))))`;
        whereParams.push(hashtag);
      }

      // 📍 Lightweight suggestion path for Navbar autocomplete (P2-B1):
      // Only runs a single query for id, title, hashtags, and live_uses.
      // Skips profiles JOIN, is_saved, live_views, total count, and template_items.
      if (suggest) {
        const suggestQuery = `
          SELECT t.id, t.title, t.hashtags,
            ${templateUsageSql(env)} AS live_uses
          FROM templates t
          ${whereSql}
          ORDER BY live_uses DESC, t.created_at DESC, t.id DESC
          LIMIT ? OFFSET ?
        `;
        const { results: templates } = await db.prepare(suggestQuery).bind(...whereParams, limit, offset).all();
        const data = templates.map(t => ({
          id: t.id,
          title: t.title,
          hashtags: t.hashtags,
          use_count: t.live_uses || 0,
          stats: { uses: t.live_uses || 0 }
        }));
        // M2: suggest response ไม่มี is_saved / ข้อมูลเฉพาะผู้ชม (_middleware ข้าม session
        // lookup ให้ path นี้อยู่แล้ว) — cache สาธารณะได้ ไม่แตะ logic search/query
        return Response.json({
          success: true,
          data,
          page,
          limit,
          total: data.length
        }, { headers: { 'Cache-Control': 'public, max-age=60' } });
      }

      // เรียงตามเลขจริง (live_uses/live_views) ไม่ใช่คอลัมน์ที่ seed ไว้ — ไม่งั้นลำดับการ์ด
      // จะไม่ตรงกับตัวเลขที่โชว์ (ดู docs/discover-template-uses-views-fix-plan.md)
      let orderSql = ` ORDER BY live_uses DESC, t.created_at DESC, t.id DESC`;
      if (sort === 'recent') orderSql = ` ORDER BY t.created_at DESC, t.id DESC`;
      else if (sort === 'views') orderSql = ` ORDER BY live_views DESC, live_uses DESC, t.id DESC`;

      const query = `
        SELECT t.*, p.username, p.avatar_url,
          EXISTS(SELECT 1 FROM template_bookmarks b WHERE b.template_id = t.id AND b.user_id = ?) AS is_saved,
          ${templateUsageSql(env)} AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views
        FROM templates t
        LEFT JOIN profiles p ON t.creator_id = p.id
        ${whereSql}
        ${orderSql}
        LIMIT ? OFFSET ?
      `;
      const params = [viewerId, ...whereParams, limit, offset];

      const { results: templates } = await db.prepare(query).bind(...params).all();

      const { results: totalRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM templates t${whereSql}`
      ).bind(...whereParams).all();
      const total = totalRows[0]?.n || 0;

      const itemsMap = Object.create(null);
      const itemCounts = Object.create(null);
      const rankingPreviews = Object.create(null);
      if (templates.length > 0 && !metadataOnly) {
        const templateIds = templates.map(t => t.id);
        const placeholders = templateIds.map(() => '?').join(',');
        // Bound each topic preview to 12 ordered items so lower tier rows can
        // appear without loading the complete item set for every card.
        const { results: allItems } = await db.prepare(
          `SELECT ti.*, i.name AS item_name, i.image_url AS item_image
           FROM template_items ti LEFT JOIN items i ON i.id = ti.item_id
           WHERE ti.template_id IN (${placeholders}) AND ti.position < 12
           ORDER BY ti.template_id, ti.position ASC`
        ).bind(...templateIds).all();
        const { results: counts = [] } = await db.prepare(
          `SELECT template_id, tier, COUNT(*) AS count FROM template_items WHERE template_id IN (${placeholders}) GROUP BY template_id, tier`
        ).bind(...templateIds).all();
        for (const row of counts) {
          if (!itemCounts[row.template_id]) itemCounts[row.template_id] = [];
          itemCounts[row.template_id].push({ tier: row.tier, count: Number(row.count) });
        }

        allItems.forEach(ti => {
          if (!itemsMap[ti.template_id]) itemsMap[ti.template_id] = [];
          itemsMap[ti.template_id].push({
            ...ti,
            // Older Create payloads store the name directly in item_id. Keep
            // that fallback; ID-backed items use the canonical item metadata.
            item: { id: ti.item_id, name: ti.item_name || ti.item_id, image_url: ti.item_image || null }
          });
        });
        const unassignedIds = templates.filter(t => !(itemsMap[t.id] || []).some(item => item.tier)).map(t => t.id);
        if (unassignedIds.length) {
          const slots = unassignedIds.map(() => '?').join(',');
          const latest = `SELECT t.id AS template_id, (SELECT r.id FROM rankings r WHERE r.template_id = t.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS ranking_id FROM templates t WHERE t.id IN (${slots})`;
          const { results: previewItems = [] } = await db.prepare(
            `WITH latest AS MATERIALIZED (${latest}) SELECT l.template_id, ri.item_id, ri.tier, ri.position, COALESCE(i.name, ri.item_id) AS name, i.image_url FROM latest l JOIN ranking_items ri ON ri.ranking_id = l.ranking_id LEFT JOIN items i ON i.id = ri.item_id WHERE ri.position < 12 ORDER BY l.template_id, ri.position, ri.id`
          ).bind(...unassignedIds).all();
          const { results: previewCounts = [] } = await db.prepare(
            `WITH latest AS MATERIALIZED (${latest}) SELECT l.template_id, ri.tier, COUNT(*) AS count FROM latest l JOIN ranking_items ri ON ri.ranking_id = l.ranking_id GROUP BY l.template_id, ri.tier`
          ).bind(...unassignedIds).all();
          for (const item of previewItems) {
            if (!rankingPreviews[item.template_id]) rankingPreviews[item.template_id] = { items: [], counts: [] };
            rankingPreviews[item.template_id].items.push({ item_id: item.item_id, tier: item.tier, item: { name: item.name, image_url: item.image_url } });
          }
          for (const row of previewCounts) {
            if (rankingPreviews[row.template_id]) rankingPreviews[row.template_id].counts.push({ tier: row.tier, count: Number(row.count) });
          }
        }
      }

      const data = templates.map(t => ({
        id: t.id,
        is_saved: !!t.is_saved,
        title: t.title,
        description: t.description,
        hashtags: t.hashtags,
        tiers: parseTiers(t.tiers),
        use_count: t.live_uses || 0,
        view_count: t.live_views || 0,
        profile: { id: t.creator_id, username: t.username, avatar_url: t.avatar_url },
        ...(!metadataOnly ? {
          template_items: itemsMap[t.id] || [],
          preview_item_counts: itemCounts[t.id] || [],
          item_count: (itemCounts[t.id] || []).reduce((sum, row) => sum + row.count, 0),
          ranking_preview: rankingPreviews[t.id] || null
        } : {})
      }));

      // The middleware marks authenticated responses private/no-store because is_saved is personal.
      // Guest responses may be cached at the edge with Vary: Cookie.
      // ได้ปลอดภัย (ดู docs/row-read-optimization-plan.md §6/§8) แต่ max-age เดิม 60s บวก
      // stale-while-revalidate=300s ทำให้ browser ค้าง response เก่าได้นานสุด ~360s — เคยเป็นบั๊กจริง:
      // Discover ยังโชว์ Views เก่าหลังกลับมาจากหน้า Template Detail ที่เพิ่งนับ view ไปแล้ว
      // (ดู docs/discover-template-view-refresh-and-tracking-plan.md) ตัด stale-while-revalidate
      // ทิ้งไปเลยเพราะมันคือตัวยืดหน้าต่างค้าง ไม่ใช่แค่ลด max-age เฉยๆ — เหลือ cache สั้นๆ 10s
      // พอดูดซับ burst ตอนสลับ Discover↔Detail เร็วๆ แต่ไม่ค้างนานเกินไป
      return Response.json(
        { success: true, data, page, limit, total },
        { headers: { 'Cache-Control': 'public, max-age=10' } }
      );
    }

    // ==========================================
    // โหมด detail: GET /api/templates?id=..
    // เอา rankings/comments ทั้งชุดออกจาก response นี้แล้ว (ไม่มี LIMIT มาก่อน = เสี่ยงเกิน
    // ลิมิต 100 bound params ของ D1 เมื่อ template มี ranking เกิน 100 อัน) — ฝั่งหน้าเว็บ
    // ดึงรายการ Community Rankings แบบแบ่งหน้าจาก GET /api/rankings?template_id=..&sort=..&page=..
    // แทน ส่วนตารางนี้คืนแค่ meta + Community Average ที่คำนวณด้วย query เดียว
    // ==========================================
    const viewerId = context.data?.user?.id || null;
    const { results: templateResults } = await db.prepare(
      `SELECT t.*, p.username, p.avatar_url,
         EXISTS(SELECT 1 FROM template_bookmarks b WHERE b.template_id = t.id AND b.user_id = ?) AS is_saved
       FROM templates t
       LEFT JOIN profiles p ON t.creator_id = p.id
       WHERE t.id = ?`
    ).bind(viewerId, templateId).all();

    if (templateResults.length === 0) {
      return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const template = templateResults[0];
    const tiersDef = parseTiers(template.tiers) || [];
    const tierCount = tiersDef.length;

    // 📍 ช่วงเวลา (popularity ตามช่วงเวลานั้นๆ) — กรองจาก created_at ของ ranking_item_scores
    // รับได้: days=N (N วันที่ผ่านมา) หรือ from/to (วันที่แบบ YYYY-MM-DD) / from may be omitted
    const daysParam = parseInt(url.searchParams.get('days') || '', 10);
    let period = null;
    if (!Number.isNaN(daysParam) && daysParam > 0) {
      const from = new Date(Date.now() - daysParam * 86400000);
      period = { from: from.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''), to: null };
    } else {
      const fromRaw = url.searchParams.get('from');
      const toRaw = url.searchParams.get('to');
      if (fromRaw || toRaw) {
        period = { from: fromRaw || null, to: toRaw || null };
      }
    }

    // 📍 ?fields=meta = โหมดย่อ ใช้โดย PostDetail (AboutTemplateCard) และ RankTierList
    // (pre-fill) ซึ่งอ่านแค่ title/description/tiers/template_items — ไม่เคยอ่าน
    // community_average เลย แต่โหมดเต็ม (TemplateDetailPage) ต้องคำนวณฮิสโตแกรมทุกครั้ง
    // วัดจริงจาก D1 trace: histogram query กิน ~292 rows/request เฉลี่ย (ดู
    // docs/row-read-optimization-plan.md §5/§8, C6) — โหมดย่อข้ามการคำนวณนี้ไปทั้งหมด
    const light = url.searchParams.get('fields') === 'meta';

    const { results: templateItems } = await db.prepare(
      `SELECT ti.*, i.name as item_name, i.image_url as item_image
       FROM template_items ti
       LEFT JOIN items i ON (ti.item_id = i.id OR ti.item_id = i.name)
       WHERE ti.template_id = ?
       ORDER BY ti.position ASC`
    ).bind(templateId).all();

    // รวม COUNT(*) กับ MAX(created_at) เป็น query เดียว (เดิมแยก 2 statement คนละ query)
    const { results: statsRows } = await db.prepare(
      env.TEMPLATE_USAGE_COUNTERS === 'true'
        ? `SELECT COALESCE((SELECT ranking_count FROM template_usage_counts WHERE template_id = ?1), 0) AS n,
            (SELECT created_at FROM rankings WHERE template_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1) AS latest`
        : `SELECT COUNT(*) as n, MAX(created_at) as latest FROM rankings WHERE template_id = ?`
    ).bind(templateId).all();
    const useCount = statsRows[0]?.n || 0;
    const lastRanked = statsRows[0]?.latest || null;

    // views นับสดจาก template_views เสมอ — ไม่อ่าน templates.view_count ตรงๆ เพราะเป็นแค่
    // mirror counter ที่ drift ได้ (ดู docs/discover-template-uses-views-fix-plan.md)
    const { results: viewRows } = await db.prepare(
      `SELECT COUNT(*) as n FROM template_views WHERE template_id = ?`
    ).bind(templateId).all();
    const viewCount = viewRows[0]?.n || 0;

    // like/dislike/comment ของ Community Average — นับสดจากตาราง template_reactions/template_comments
    const { results: reactionRows } = await db.prepare(
      `SELECT
         COALESCE(SUM(vote_type = 'like'), 0) AS likes,
         COALESCE(SUM(vote_type = 'dislike'), 0) AS dislikes,
         (SELECT COUNT(*) FROM template_comments WHERE template_id = ?1) AS comments
       FROM template_reactions WHERE template_id = ?1`
    ).bind(templateId).all();
    const reaction = reactionRows[0] || {};

    let communityAverage = null;
    if (!light && tierCount > 0) {
      // Community Average: อ่านจาก ranking_item_scores (บันทึกคะแนน freeze ตอนสร้าง) แล้ว
      // aggregate ตามช่วงเวลาที่ขอ — score เก็บค่า "แถวบนสุด = สูงสุด" อยู่แล้ว ไม่ต้อง map label ซ้ำ

      let whereSql = ` WHERE ris.template_id = ?`;
      const whereParams = [templateId];
      if (period?.from) { whereSql += ` AND ris.created_at >= ?`; whereParams.push(period.from); }
      if (period?.to) { whereSql += ` AND ris.created_at <= ?`; whereParams.push(period.to); }

      const { results: histogram } = await db.prepare(
        `SELECT ris.item_id, ris.score, COUNT(*) as n
         FROM ranking_item_scores ris
         JOIN template_user_contributions tuc ON tuc.current_ranking_id = ris.ranking_id
         ${whereSql}
         GROUP BY ris.item_id, ris.score`
      ).bind(...whereParams).all();

      communityAverage = buildCommunityAverage(tiersDef, histogram, lastRanked, period);
    }

    // has_community_average_all_time: บอกว่า template นี้มี community average
    // แบบ all-time หรือไม่ โดยไม่ต้อง fetch full รอบสอง (TemplateDetailPage ตอน
    // เลือก period เดิมยิง fetchTemplate(all-time) ซ้ำเพื่อหา boolean นี้ตัวเดียว)
    // source of truth เดียวกับ community_average: ranking_item_scores (score
    // freeze ตอน publish; ไม่ใช้ use_count/view_count mirror ที่ drift ได้)
    //  - period == null (all-time): derive จาก histogram ที่เพิ่งคำนวณ ไม่เพิ่ม query
    //  - มี period: EXISTS แบบ bound (idx_ris_template_time รองรับ template_id อยู่แล้ว)
    // boolean นี้เท่ากับ `(all_time_average.tiers||[]).some(items.length>0)` ทุกกรณี:
    // histogram จับทุก score row ลง tier แบบ clamp (idx 0..tierCount-1) เสมอ จึง
    // non-empty ก็ต่อเมื่อ tierCount>0 และมี score ≥1 แถว — ตรงกับ EXISTS พอดี
    let hasCommunityAverageAllTime = null;
    if (!light) {
      if (!period?.from && !period?.to) {
        hasCommunityAverageAllTime =
          tierCount > 0 &&
          (communityAverage?.tiers || []).some((t) => (t.items || []).length > 0);
      } else {
        const existsRow = await db.prepare(
          `SELECT 1 AS one FROM ranking_item_scores ris
           JOIN template_user_contributions tuc ON tuc.current_ranking_id = ris.ranking_id
           WHERE ris.template_id = ? LIMIT 1`
        ).bind(templateId).first();
        hasCommunityAverageAllTime = tierCount > 0 && !!existsRow;
      }
    }

    const cooldown = viewerId
      ? await checkTemplateCooldown(db, templateId, viewerId)
      : { active: false, cooldownUntil: null, remainingSeconds: 0 };

    const responseData = {
      id: template.id,
      is_saved: !!template.is_saved,
      title: template.title,
      description: template.description,
      hashtags: template.hashtags,
      tiers: tiersDef,
      profile: {
        id: template.creator_id,
        username: template.username,
        avatar_url: template.avatar_url
      },
      stats: {
        uses: useCount,
        views: viewCount,
        likes: reaction.likes || 0,
        dislikes: reaction.dislikes || 0,
        comments: reaction.comments || 0
      },
      template_items: templateItems.map(ti => ({
        ...ti,
        item: { id: ti.item_id, name: ti.item_name || ti.item_id, image_url: ti.item_image || null }
      })),
      community_average: communityAverage,
      has_community_average_all_time: hasCommunityAverageAllTime,
      cooldown
    };

    // 📍 เช่นเดียวกับโหมด list — ไม่มี field เฉพาะผู้ชมเลย cache ที่ edge ได้ปลอดภัย แต่ใช้ max-age
    // สั้นเท่ากัน (10s, ไม่มี stale-while-revalidate) ด้วยเหตุผลเดียวกัน — ให้ผู้ที่ไม่ได้ล็อกอิน
    // (ไม่มี overlay จาก POST) เห็นเลข views ที่ใกล้เคียงปัจจุบันด้วย
    return Response.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': viewerId ? 'private, no-store' : 'public, max-age=10' } }
    );

  } catch (error) {
    console.error('Template query failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}

// ==========================================
// POST /api/templates — บันทึกว่า user คนนี้เปิดดู template นี้แล้ว (นับ view ครั้งแรกเท่านั้น)
// body: { template_id, user_id }
// ==========================================
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.tear_of_god_db;

  try {
    const user_id = context.data.user.id;
    const gate = consumeMemoryRateLimit('template-view', user_id, { limit: 120, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
    const template_id = assertId(body.template_id, 'template_id');

    const insertResult = await db.prepare(
      `INSERT OR IGNORE INTO template_views (template_id, user_id)
       SELECT ?1, ?2 FROM templates WHERE id = ?1`
    ).bind(template_id, user_id).run();

    // Viewer เดิมไม่ก่อ COUNT/UPDATE ซ้ำ; อ่าน mirror ที่ถูกซิงค์จากการ insert ครั้งแรกแทน
    // ส่วน viewer ใหม่ยังคำนวณจาก source of truth เพื่อซ่อม counter ที่อาจ drift มาก่อนหน้านี้
    if (insertResult.meta.changes > 0) {
      await db.prepare(
        `UPDATE templates SET view_count = (SELECT COUNT(*) FROM template_views WHERE template_id = ?) WHERE id = ?`
      ).bind(template_id, template_id).run();
    }

    // ส่งเลข view_count ล่าสุดกลับไปด้วย — ฝั่ง client ต้องใช้ค่านี้แทนค่าที่ได้จาก GET
    // เพราะ GET (fetchTemplate) กับ POST (recordTemplateView) ยิงพร้อมกันตอน mount
    // ถ้า GET อ่านไปก่อน UPDATE ข้างบน commit จะได้เลขเก่ามาโชว์ (บั๊ก views ค้าง 0 จนกว่าจะรีเฟรช)
    const { results } = await db.prepare(
      `SELECT view_count FROM templates WHERE id = ?`
    ).bind(template_id).all();
    if (!results.length) return Response.json({ success: false, error: 'Template not found' }, { status: 404 });

    // counted อ้างอิงผลของ INSERT (statement แรกใน batch) — ต้องเป็นแถวใหม่จริงเท่านั้นถึงนับ
    // ว่า "view" นี้ถูกนับ ไม่ใช่ผลของ UPDATE ซึ่ง match แถว templates เสมอไม่ว่า INSERT จะถูก
    // IGNORE หรือไม่ก็ตาม
    return Response.json({ success: true, counted: insertResult.meta.changes > 0, views: results[0]?.view_count ?? 0 });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Template view request failed:', error.message);
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 500 });
  }
}
