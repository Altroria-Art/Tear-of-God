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

function parseTiers(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

// Fisher–Yates ด้วย PRNG จาก seed — seed + ลำดับ input เดิม ⇒ ผลลัพธ์เดิมเสมอ
// ทำให้ pagination (page/limit) เลื่อนไปทีละหน้าได้โดยไม่ซ้ำ/ไม่ข้าม ภายใน seed เดียวกัน
function seededShuffle(list, seed) {
  const rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export async function onRequest({ request, env, data: auth }) {
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
            ${viewerId ? `(SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?)` : `NULL`} as user_vote
          FROM rankings r
          LEFT JOIN profiles p ON r.user_id = p.id
          WHERE r.id = ?
        `).bind(...(viewerId ? [viewerId, id] : [id])).all();

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
        if (ranking.template_id) {
          const { results: tplRows } = await db.prepare(
            `SELECT tiers FROM templates WHERE id = ?`
          ).bind(ranking.template_id).all();
          tiersDef = tplRows[0] ? parseTiers(tplRows[0].tiers) : null;
        }

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
          profile: { id: ranking.user_id, username: ranking.username || 'Unknown', avatar_url: ranking.avatar_url },
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
        const category = url.searchParams.get('category');
        const hashtag = url.searchParams.get('hashtag');
        const currentUserId = auth.user?.id || null;
        // author_id = "กรองเฉพาะโพสต์ของคนนี้" (หน้าโปรไฟล์) — ต่างจาก user_id ที่แปลว่า "คนกำลังดู"
        const authorId = url.searchParams.get('author_id');
        const templateId = url.searchParams.get('template_id');
        const sort = url.searchParams.get('sort'); // 'recent' | 'liked'
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit')) || 12), 50);
        const offset = (page - 1) * limit;
        // 🟡 [ใหม่]: Home feed mode — 'general' | 'kindred' (มีแค่หน้า Home ส่งมา; จุดเรียกอื่น
        // ไม่มี feed_type จึงไม่เข้ากระแสนี้ ไม่กระทบ behavior เดิม — ดู docs/row-read-optimization-plan.md §14.7 #11)
        const feedType = ['general', 'kindred'].includes(url.searchParams.get('feed_type')) ? url.searchParams.get('feed_type') : null;
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
        } else if (usePersonalized) {
          orderExpr = `COALESCE(aff.affinity, 0) DESC, r.created_at DESC, r.id DESC`;
        } else {
          orderExpr = `r.created_at DESC, r.id DESC`;
        }
        // r.id เป็น tiebreaker เสมอ — created_at ละเอียดแค่วินาที ข้อมูลหลักร้อยแถวชนกันได้ง่าย
        // ไม่มี tiebreaker แล้ว OFFSET จะเลื่อนหน้าซ้ำ/ข้ามแถวได้เวลา paginate

        let pageWhere = `WHERE 1=1`;
        const pageWhereParams = [];
        if (category && category !== 'null') { pageWhere += ` AND r.category = ?`; pageWhereParams.push(category); }
        if (hashtag) { pageWhere += ` AND instr(',' || lower(r.hashtags) || ',', lower(?)) > 0`; pageWhereParams.push(`,#${hashtag.replace(/^#/, '')},`); }
        if (authorId) { pageWhere += ` AND r.user_id = ?`; pageWhereParams.push(authorId); }
        if (templateId) { pageWhere += ` AND r.template_id = ?`; pageWhereParams.push(templateId); }

        // 🟡 [ใหม่] Home Feed (feedType != null) — สร้าง "ordered id list" แล้ว slice เป็นหน้า
        // (เลื่อนใน JS ไม่ใช่ OFFSET ของ SQL ทั้งตาราง — สอดคล้อง NFR-1):
        //   general: สุ่ม seeded ทั้ง pool (ทุกยุค) — สับทั้ง pool ตั้งแต่หน้าแรก; seed ใหม่
        //            ต่อ mount (จาก client) → ทุกรีโหลดลำดับเปลี่ยน เห็นผล random ทันที;
        //            seed เดียวใน session → เลื่อนหน้าไม่ซ้ำ/ไม่ข้าม (ดู §14.7 #11)
        //   kindred: pool = โพสต์ที่ "เกี่ยวข้องกับฉัน" จริงๆ — ต้องตรง ≥ 2 สัญญาณจาก:
        //            (1) หมวดที่เคยสร้าง/เคยไลก์, (2) template ที่เคยจัด/เคยไลก์,
        //            (3) แฮชแท็กที่เคยใช้ → pool เล็กลง เห็นต่างกับ General ชัดเจน
        //            guest (!currentUserId) → kindredLocked (ชวนล็อกอิน) แทน fallback เงียบๆ
        //            ล็อกอินแล้วแต่ pool ว่าง (ยังไม่มีสัญญาณ) → fallback เป็น general
        // rows-read: pool อ่านแค่ id (≤ HOME_POOL_CAP) ต่อหน้าใหม่; หน้าถัดๆ ไปอ่านแต่ detail ของ 1 หน้า
        // (HomeFeed cache ผลต่อ tab+user ไว้ที่ client → pool scan เกิดขึ้นครั้งเดียวต่อครั้ง mount)
        const HOME_POOL_CAP = 600;    // เพดาน pool ที่จะนำมาสับ — กัน pool โตเกินเหตุ

        let homePoolIds = null;       // null = ไม่ใช่ home path
        let kindredLocked = false;    // true = kindred แต่ไม่ล็อกอิน → หน้าบ้านชวนเข้าสู่ระบบ
        if (feedType === 'general' || feedType === 'kindred') {
          if (feedType === 'kindred' && !currentUserId) {
            kindredLocked = true;
            homePoolIds = [];
          } else {
            let poolWhere = pageWhere;
            const poolParams = [...pageWhereParams];

            if (feedType === 'kindred' && currentUserId) {
              // normalize แฮชแท็กจากโพสต์ที่ฉันสร้าง ∪ โพสต์ที่ฉันไลก์ (ตัด '#')
              // — ใช้เป็นสัญญาณที่ (3) ของเกณฑ์ "ตรง ≥ 2"
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
              // 3 สัญญาณ แต่ละอัน (CASE) ให้ 1 แต้ม — คงเฉพาะโพสต์ที่ผลรวม >= 2:
              //   1) r.category ตรงกับหมวดที่เคยสร้าง/เคยไลก์
              //   2) r.template_id ตรงกับ template ที่เคยจัด/เคยไลก์
              //   3) มีแฮชแท็กที่เคยใช้อยู่ด้วย
              const tagCond = myTags.length > 0
                ? `(${myTags.map(() => `instr(',' || lower(r.hashtags) || ',', ?) > 0`).join(' OR ')})`
                : '0';
              const scoreExpr = `
                CASE WHEN r.category IN (
                  SELECT category FROM rankings WHERE user_id = ?
                  UNION
                  SELECT fav.category FROM votes v JOIN rankings fav ON v.ranking_id = fav.id
                  WHERE v.user_id = ? AND v.vote_type = 'like'
                ) THEN 1 ELSE 0 END
                +
                CASE WHEN r.template_id IS NOT NULL AND r.template_id IN (
                  SELECT template_id FROM rankings WHERE user_id = ? AND template_id IS NOT NULL
                  UNION
                  SELECT fav.template_id FROM votes v JOIN rankings fav ON v.ranking_id = fav.id
                  WHERE v.user_id = ? AND v.vote_type = 'like' AND fav.template_id IS NOT NULL
                ) THEN 1 ELSE 0 END
                +
                CASE WHEN ${tagCond} THEN 1 ELSE 0 END
              `;

              poolWhere += `\n              AND (${scoreExpr}) >= 2`;
              // ลำดับ "?": pageWhere -> category(2) -> template_id(2) -> tags
              poolParams.push(currentUserId, currentUserId, currentUserId, currentUserId, ...myTags.map((tg) => `,#${tg.toLowerCase()},`));
            }

            if (days) {
              poolWhere += ` AND r.created_at >= datetime('now', '-' || ? || ' days')`;
              poolParams.push(String(days));
            }

            const { results: poolRows } = await db.prepare(`
              SELECT r.id FROM rankings r
              ${poolWhere}
              ORDER BY r.created_at DESC, r.id DESC
              LIMIT ?
            `).bind(...poolParams, HOME_POOL_CAP).all();
            let poolIds = (poolRows || []).map((row) => row.id);

            // kindred: pool ว่างจริงๆ (ล็อกอินแล้วแต่ยังไม่มีสัญญาณครบ 2) → fallback
            // เป็น general อย่างเดิม (guest ไม่เข้าเงื่อนไขนี้ — ถูกตัดที่ kindredLocked แล้ว)
            if (feedType === 'kindred' && poolIds.length === 0) {
              let fbWhere = pageWhere;
              const fbParams = [...pageWhereParams];
              if (days) { fbWhere += ` AND r.created_at >= datetime('now', '-' || ? || ' days')`; fbParams.push(String(days)); }
              const { results: fbRows } = await db.prepare(`
                SELECT r.id FROM rankings r
                ${fbWhere}
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT ?
              `).bind(...fbParams, HOME_POOL_CAP).all();
              poolIds = (fbRows || []).map((row) => row.id);
            }

            // สุ่มทั้งหมดแบบ seeded — ทุกรีโหลด (seed ใหม่จาก client) ลำดับเปลี่ยนตั้งแต่หน้าแรก
            // 🟡 [ใหม่]: pin (เฉพาะ general) — Ranking ที่เพิ่ง publish ของ currentUser ขึ้นอันแรก
            // เอา pin ออกจาก pool ก่อนสับ → ใช้ shuffle ชุดเดียวกัน deterministic ตลอด seed+feedType
            // เดียว (client ส่ง pin ต่อทุกหน้า) → เลื่อนหน้าไม่ซ้ำ/ไม่ข้าม เหมือนแบบไม่ pin; ตรวจ
            // เจ้าของจริงก่อน (กัน url /api/rankings?pin=<id ของคนอื่น> ไปยัดการ์ดขึ้นบนสุด)
            let pinnedId = null;
            if (feedType === 'general' && runPin && currentUserId) {
              const { results: owned } = await db.prepare(
                `SELECT id FROM rankings WHERE id = ? AND user_id = ? LIMIT 1`
              ).bind(runPin, currentUserId).all();
              if (owned.length > 0) pinnedId = owned[0].id;
            }
            if (pinnedId) {
              homePoolIds = [pinnedId, ...seededShuffle(poolIds.filter((id) => id !== pinnedId), seed ^ fnv1a(feedType))];
            } else {
              homePoolIds = seededShuffle(poolIds, seed ^ fnv1a(feedType));
            }
          }
        }

        // แก้ปัญหา row-read สูงผิดปกติ (ดู docs/row-read-optimization-plan.md §3, §8):
        // เดิม query นี้ห่อด้วย "page" CTE + ROW_NUMBER() OVER (ORDER BY ...) เสมอ แม้แต่ตอน
        // ORDER BY เป็นคอลัมน์ตรงๆ ที่มี index รองรับอยู่แล้ว (created_at/category/user_id/
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
              -- (affinity ตาม category คำนวณจาก like เก่า ไม่รู้จัก category ใหม่ที่เพิ่งสร้าง
              -- เลยเรียงโพสต์ใหม่ไปอยู่ลึกได้) ตั้งเพดาน 24 ชม. กันไม่ให้โพสต์เก่าค้างบนสุดถาวร
              -- ถ้า pin ไม่ตรงกับ cand ด้านล่าง (เช่นโดน pageWhere กรองออก) จะไม่มีผลอะไรเลย
              -- เพราะใช้แค่เทียบเท่ากันใน ORDER BY ไม่ได้ยัดแถวเพิ่ม
              SELECT id FROM rankings
              WHERE user_id = ? AND created_at > datetime('now', '-1 day')
              ORDER BY created_at DESC, id DESC
              LIMIT 1
            ),
            aff AS (
              SELECT fav_r.category AS cat, COUNT(*) AS affinity
              FROM votes v JOIN rankings fav_r ON v.ranking_id = fav_r.id
              WHERE v.user_id = ? AND v.vote_type = 'like'
              GROUP BY fav_r.category
            ),
            cand AS (
              SELECT r.id, r.category, r.created_at
              FROM rankings r
              ${pageWhere}
              ORDER BY r.created_at DESC, r.id DESC
              LIMIT ?
            )
            SELECT r.*, p.username, p.avatar_url,
              (SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?) as user_vote
            FROM cand c
            JOIN rankings r ON r.id = c.id
            LEFT JOIN aff ON aff.cat = c.category
            LEFT JOIN profiles p ON r.user_id = p.id
            ORDER BY (c.id = (SELECT id FROM mine)) DESC, COALESCE(aff.affinity, 0) DESC, c.created_at DESC, c.id DESC
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
        // path เก่า: rankings = ผลจาก query ตามปกติ (author/category/template/sort …)
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
          const [{ results: allItems }, tplRows] = await Promise.all([
            db.prepare(`
              SELECT ri.*, i.name as item_name, i.image_url as item_image
              FROM ranking_items ri
              LEFT JOIN items i ON (ri.item_id = i.id OR ri.item_id = i.name)
              WHERE ri.ranking_id IN (${placeholders})
              ORDER BY ri.position ASC
            `).bind(...rankingIds).all(),
            templateIds.length > 0
              ? db.prepare(
                  `SELECT id, tiers FROM templates WHERE id IN (${templateIds.map(() => '?').join(',')})`
                ).bind(...templateIds).all().then(res => res.results)
              : Promise.resolve([]),
          ]);

          const itemsMap = {};
          allItems.forEach(ri => {
            if (!itemsMap[ri.ranking_id]) itemsMap[ri.ranking_id] = [];
            itemsMap[ri.ranking_id].push({
              ...ri,
              item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
            });
          });

          const tiersByTemplateId = {};
          tplRows.forEach(t => { tiersByTemplateId[t.id] = parseTiers(t.tiers); });

          formattedRankings = rankings.map(r => ({
             ...r,
             profile: { id: r.user_id, username: r.username || 'Unknown', avatar_url: r.avatar_url },
             stats: { likes: r.likes_count, dislikes: r.dislikes_count, comments: r.comments_count },
             user_vote: r.user_vote ?? null,
             tiers: r.template_id ? (tiersByTemplateId[r.template_id] ?? null) : null,
             ranking_items: itemsMap[r.id] || []
          }));
        }

        // 📍 cache ที่ edge ได้เฉพาะตอนไม่มี currentUserId เท่านั้น — มี user_vote ฝังอยู่ใน response
        // ทุกแถวถ้ามี currentUserId ซึ่งเป็นข้อมูลเฉพาะผู้ชม ห้าม cache แบบ public เด็ดขาด
        // (ดู docs/row-read-optimization-plan.md §6/§8 — คำเตือนสำคัญเรื่องการรั่วข้อมูลข้ามผู้ใช้)
        const cacheHeaders = currentUserId
          ? { 'Cache-Control': 'private, no-store' }
          : { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' };
        return jsonResponse({ success: true, data: formattedRankings, page, limit, total, ...(homePoolIds !== null ? { kindredLocked } : {}) }, 200, cacheHeaders);
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
        category: payload.category == null ? 'general' : assertString(payload.category, 'payload.category', { min: 1, max: INPUT_LIMITS.category, trim: true }),
        hashtags: payload.hashtags == null ? '' : assertString(payload.hashtags, 'payload.hashtags', { max: INPUT_LIMITS.hashtags * (INPUT_LIMITS.hashtag + 2) }),
        template_id: assertId(payload.template_id, 'payload.template_id', { optional: true }) || null,
        user_id: auth.user.id,
      };
      assertHashtags(cleanPayload.hashtags, 'payload.hashtags');

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
          category: template.category == null ? 'general' : assertString(template.category, 'template.category', { min: 1, max: INPUT_LIMITS.category, trim: true }),
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
            };
          }),
        };
        assertHashtags(cleanTemplate.hashtags, 'template.hashtags');
        const tierLabels = cleanTemplate.tiers.map(tier => tier.label);
        if (new Set(tierLabels).size !== tierLabels.length) return jsonResponse({ success: false, error: 'Tier labels must be unique' }, 400);
      }

      const rankingId = crypto.randomUUID();
      const statements = [];
      let templateId = null;

      // tiers ปัจจุบันของ template (ตัวที่ใช้จัดอันดับ) — ใช้ map ชื่อ tier → index แล้วให้คะแนน
      // แถวบนสุดสูงสุด (score = tierCount - index) บันทึกลง ranking_item_scores ตอน publish
      let tiersDef = null;
      if (cleanTemplate) {
        tiersDef = cleanTemplate.tiers;
      } else if (cleanPayload.template_id) {
        const tr = await db.prepare(`SELECT tiers FROM templates WHERE id = ?`).bind(cleanPayload.template_id).first();
        if (!tr) return jsonResponse({ success: false, error: 'Template not found' }, 404);
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
          `INSERT INTO templates (id, creator_id, title, description, category, hashtags, tiers) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        ).bind(
          templateId,
          cleanPayload.user_id,
          cleanTemplate.title,
          cleanTemplate.description,
          cleanTemplate.category,
          cleanTemplate.hashtags,
          JSON.stringify(cleanTemplate.tiers)
        ));

        // item pool ของ template = item ทุกชิ้นที่ user เพิ่มมา (tier ว่าง เพราะเป็นของ template ไม่ใช่คำตอบ)
        // dedupe ด้วยชื่อ กัน item ซ้ำชื่อเดียวกันโผล่สองการ์ดตอน remix
        const seenNames = new Set();
        cleanTemplate.items.forEach((item) => {
          const name = item.name;
          if (!name || seenNames.has(name)) return;
          seenNames.add(name);
          statements.push(db.prepare(
            `INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES (?1, ?2, ?3, NULL, ?4)`
          ).bind(crypto.randomUUID(), templateId, name, item.position));
        });
      }

      statements.push(db.prepare(
        `INSERT INTO rankings (id, template_id, title, description, category, hashtags, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(
        rankingId, cleanPayload.template_id || templateId, cleanPayload.title, cleanPayload.description,
        cleanPayload.category, cleanPayload.hashtags, cleanPayload.user_id
      ));

      if (cleanPayload.template_id || templateId) {
        statements.push(db.prepare(
          `UPDATE templates SET use_count = use_count + 1 WHERE id = ?`
        ).bind(cleanPayload.template_id || templateId));
      }

      if (cleanItems.length > 0) {
        const effTemplateId = cleanPayload.template_id || templateId;
        cleanItems.forEach(item => {
          statements.push(db.prepare(
            `INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?1, ?2, ?3, ?4, ?5)`
          ).bind(crypto.randomUUID(), rankingId, item.item_id, item.tier, item.position));

          // 📍 บันทึกสถิติความนิยม: เฉพาะ item ที่จัดลง tier ที่ตรงกับ template เท่านั้น
          // (item ใน pool ที่ยังไม่จัด = tier null → ไม่นับ) — freeze คะแนน ณ เวลาสร้าง
          const tierIdx = tierIndexByLabel[String(item.tier)];
          if (tierIdx !== undefined) {
            statements.push(db.prepare(
              `INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
            ).bind(crypto.randomUUID(), rankingId, effTemplateId, item.item_id, tierIdx, tierCount - tierIdx));
          }
        });
      }

      for (let i = 0; i < statements.length; i += 100) {
        await db.batch(statements.slice(i, i + 100));
      }
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
