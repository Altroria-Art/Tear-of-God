export async function onRequest({ request, env }) {
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
        const viewerId = url.searchParams.get('user_id');
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
          LEFT JOIN items i ON ri.item_id = i.id 
          WHERE ri.ranking_id = ?
        `).bind(id).all();

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
        const currentUserId = url.searchParams.get('user_id');
        // author_id = "กรองเฉพาะโพสต์ของคนนี้" (หน้าโปรไฟล์) — ต่างจาก user_id ที่แปลว่า "คนกำลังดู"
        const authorId = url.searchParams.get('author_id');
        const templateId = url.searchParams.get('template_id');
        const sort = url.searchParams.get('sort'); // 'recent' | 'liked'
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
        const offset = (page - 1) * limit;

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
        if (hashtag) { pageWhere += ` AND r.hashtags LIKE ?`; pageWhereParams.push(`%${hashtag}%`); }
        if (authorId) { pageWhere += ` AND r.user_id = ?`; pageWhereParams.push(authorId); }
        if (templateId) { pageWhere += ` AND r.template_id = ?`; pageWhereParams.push(templateId); }

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
            ORDER BY COALESCE(aff.affinity, 0) DESC, c.created_at DESC, c.id DESC
            LIMIT ? OFFSET ?
          `;
          // ลำดับ "?" ในข้อความ query: aff.user_id -> cand(pageWhere, candLimit) ->
          // user_vote(currentUserId) -> LIMIT/OFFSET
          params = [
            currentUserId,
            ...pageWhereParams, candLimit,
            currentUserId,
            limit, offset,
          ];
        }

        const { results: rankings } = await db.prepare(query).bind(...params).all();

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
          
          const { results: allItems } = await db.prepare(`
            SELECT ri.*, i.name as item_name, i.image_url as item_image 
            FROM ranking_items ri 
            LEFT JOIN items i ON ri.item_id = i.id 
            WHERE ri.ranking_id IN (${placeholders})
            ORDER BY ri.position ASC
          `).bind(...rankingIds).all();

          const itemsMap = {};
          allItems.forEach(ri => {
            if (!itemsMap[ri.ranking_id]) itemsMap[ri.ranking_id] = [];
            itemsMap[ri.ranking_id].push({
              ...ri, 
              item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
            });
          });

          formattedRankings = rankings.map(r => ({
             ...r, 
             profile: { id: r.user_id, username: r.username || 'Unknown', avatar_url: r.avatar_url },
             stats: { likes: r.likes_count, dislikes: r.dislikes_count, comments: r.comments_count },
             user_vote: r.user_vote ?? null,
             ranking_items: itemsMap[r.id] || []
          }));
        }

        // 📍 cache ที่ edge ได้เฉพาะตอนไม่มี currentUserId เท่านั้น — มี user_vote ฝังอยู่ใน response
        // ทุกแถวถ้ามี currentUserId ซึ่งเป็นข้อมูลเฉพาะผู้ชม ห้าม cache แบบ public เด็ดขาด
        // (ดู docs/row-read-optimization-plan.md §6/§8 — คำเตือนสำคัญเรื่องการรั่วข้อมูลข้ามผู้ใช้)
        const cacheHeaders = currentUserId
          ? { 'Cache-Control': 'private, no-store' }
          : { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' };
        return jsonResponse({ success: true, data: formattedRankings, page, limit, total }, 200, cacheHeaders);
      }
    }

    // 🟢 [POST] สร้าง Ranking ใหม่
    if (request.method === 'POST') {
      const { payload, items } = await request.json();
      const rankingId = crypto.randomUUID(); 
      
      if (payload.user_id) {
        await db.prepare(
          `INSERT OR IGNORE INTO profiles (id, username, avatar_url) VALUES (?1, ?2, ?3)`
        ).bind(payload.user_id, payload.username || 'Unknown', payload.avatar_url || '').run();
      }
      
      const statements = [];

      statements.push(db.prepare(
        `INSERT INTO rankings (id, template_id, title, description, category, hashtags, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(
        rankingId, payload.template_id || null, payload.title || 'Untitled', payload.description || '', 
        payload.category || 'general', payload.hashtags || '', payload.user_id
      ));

      if (payload.template_id) {
        statements.push(db.prepare(
          `UPDATE templates SET use_count = use_count + 1 WHERE id = ?`
        ).bind(payload.template_id));
      }

      if (items && items.length > 0) {
        items.forEach(item => {
          statements.push(db.prepare(
            `INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?1, ?2, ?3, ?4, ?5)`
          ).bind(crypto.randomUUID(), rankingId, item.item_id, item.tier, item.position));
        });
      }

      await db.batch(statements);
      return jsonResponse({ success: true, data: { id: rankingId, ...payload } }, 201);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}