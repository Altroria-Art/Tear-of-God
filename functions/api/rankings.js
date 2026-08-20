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
        const { results: rankings } = await db.prepare(`
          SELECT r.*, p.username, p.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
            (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count
          FROM rankings r 
          LEFT JOIN profiles p ON r.user_id = p.id 
          WHERE r.id = ?
        `).bind(id).all();

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
        
        let query = `
          SELECT r.*, p.username, p.avatar_url,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
            (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
            (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count
          FROM rankings r 
          LEFT JOIN profiles p ON r.user_id = p.id
          WHERE 1=1
        `;
        const params = [];
        
        if (category && category !== 'null') { query += ` AND r.category = ?`; params.push(category); }
        if (hashtag) { query += ` AND r.hashtags LIKE ?`; params.push(`%${hashtag}%`); }
        
        if (currentUserId) {
          query += ` ORDER BY (SELECT COUNT(*) FROM votes v JOIN rankings fav_r ON v.ranking_id = fav_r.id WHERE v.user_id = ? AND v.vote_type = 'like' AND fav_r.category = r.category) DESC, r.created_at DESC LIMIT 50`;
          params.push(currentUserId);
        } else {
          query += ` ORDER BY r.created_at DESC LIMIT 50`;
        }

        const { results: rankings } = await db.prepare(query).bind(...params).all();
        
        let formattedRankings = [];
        if (rankings.length > 0) {
          const rankingIds = rankings.map(r => r.id);
          const placeholders = rankingIds.map(() => '?').join(',');
          
          const { results: allItems } = await db.prepare(`
            SELECT ri.*, i.name as item_name, i.image_url as item_image 
            FROM ranking_items ri 
            LEFT JOIN items i ON ri.item_id = i.id 
            WHERE ri.ranking_id IN (${placeholders})
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
             ranking_items: itemsMap[r.id] || []
          }));
        }

        return jsonResponse({ success: true, data: formattedRankings });
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