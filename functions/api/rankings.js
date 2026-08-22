export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const db = env.tear_of_god_db; 

  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    // 🟢 [GET] ดึงข้อมูล
    if (request.method === 'GET') {
      if (id) {
        // user_id ที่ส่งมาคือ "คนที่กำลังดู" (ไม่ใช่เจ้าของโพสต์) ใช้เพื่อรู้ว่าคนนี้เคยโหวตไว้ยังไง
        const viewerId = url.searchParams.get('user_id');
        const { results: rankings } = await db.prepare(`
          SELECT r.*, p.username, p.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
            (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count,
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
        const { results: comments } = await db.prepare(`
          SELECT c.*, p.username, p.avatar_url 
          FROM comments c 
          LEFT JOIN profiles p ON c.user_id = p.id 
          WHERE c.ranking_id = ?
          ORDER BY c.created_at DESC
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
        const templateId = url.searchParams.get('template_id');
        const sort = url.searchParams.get('sort'); // 'recent' | 'liked'
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
        const offset = (page - 1) * limit;

        // sort ที่ระบุมาชัดเจนต้องชนะ personalized order เสมอ — ไม่งั้นหน้าที่ส่ง user_id มา
        // เพื่อขอ user_vote (เช่น Template Detail) จะโดนแย่ง ORDER BY ไปแบบไม่ได้ตั้งใจ
        const usePersonalized = !sort && !!currentUserId;

        let orderExpr;
        if (sort === 'liked') {
          orderExpr = `(SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') DESC, r.created_at DESC, r.id DESC`;
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
        if (templateId) { pageWhere += ` AND r.template_id = ?`; pageWhereParams.push(templateId); }

        // 2 ขั้น: (1) "page" เลือกแค่ id ของแถวที่ชนะ ORDER BY + LIMIT/OFFSET ก่อน
        // (2) ค่อยคำนวณ likes/dislikes/comments/user_vote เฉพาะแถวที่ชนะเท่านั้น — ไม่งั้น
        // ทั้ง 4 subquery จะถูกคำนวณให้ "ทุกแถวในตาราง" ก่อน LIMIT ตัด ซึ่งแพงมากเมื่อ
        // ข้อมูลเยอะขึ้น (personalized order เดิมยิ่งแพงกว่านั้นอีก — เป็น correlated
        // subquery ต่อแถวที่ re-scan รายการ ranking ทั้งหมดในหมวดเดียวกันซ้ำทุกแถว)
        // "aff" คำนวณ affinity ของผู้ชมครั้งเดียว ไม่ใช่ต่อแถว — ใช้เฉพาะตอน personalized order
        const query = `
          WITH
          ${usePersonalized ? `aff AS (
            SELECT fav_r.category AS cat, COUNT(*) AS affinity
            FROM votes v JOIN rankings fav_r ON v.ranking_id = fav_r.id
            WHERE v.user_id = ? AND v.vote_type = 'like'
            GROUP BY fav_r.category
          ),` : ''}
          page AS (
            SELECT r.id AS rid, ROW_NUMBER() OVER (ORDER BY ${orderExpr}) AS rn
            FROM rankings r
            ${usePersonalized ? `LEFT JOIN aff ON aff.cat = r.category` : ''}
            ${pageWhere}
            ORDER BY ${orderExpr}
            LIMIT ? OFFSET ?
          )
          SELECT r.*, p.username, p.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
            (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count,
            ${currentUserId ? `(SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?)` : `NULL`} as user_vote
          FROM page
          JOIN rankings r ON r.id = page.rid
          LEFT JOIN profiles p ON r.user_id = p.id
          ORDER BY page.rn
        `;

        // ลำดับ bind ต้องตรงกับลำดับที่ "?" ปรากฏจริงในข้อความ query ด้านบน:
        // aff.user_id -> pageWhere (category/hashtag/template_id) -> LIMIT/OFFSET -> user_vote
        const params = [
          ...(usePersonalized ? [currentUserId] : []),
          ...pageWhereParams,
          limit, offset,
          ...(currentUserId ? [currentUserId] : []),
        ];

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

        return jsonResponse({ success: true, data: formattedRankings, page, limit, total });
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