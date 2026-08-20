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
      const userId = url.searchParams.get('userId');
      console.log(`[GET /api/rankings] id=${id}, userId=${userId}`);

      // ── Single post ──
      if (id) {
        // Query 1: Main ranking data (no user-specific subqueries)
        let ranking;
        try {
          const { results } = await db.prepare(`
            SELECT r.*, p.username, p.avatar_url,
              (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
              (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
              (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count
            FROM rankings r
            LEFT JOIN profiles p ON r.user_id = p.id
            WHERE r.id = ?
          `).bind(id).all();
          ranking = results[0];
        } catch (e) {
          console.error('[GET single] ranking query failed:', e.message);
          return jsonResponse({ success: false, error: 'Query failed: ' + e.message }, 500);
        }

        if (!ranking) {
          console.log('[GET single] not found for id:', id);
          return jsonResponse({ success: false, error: 'Not found' }, 404);
        }

        // Query 2: Items
        let items = [];
        try {
          const { results } = await db.prepare(`
            SELECT ri.*, i.name as item_name, i.image_url as item_image
            FROM ranking_items ri
            LEFT JOIN items i ON ri.item_id = i.id
            WHERE ri.ranking_id = ?
          `).bind(id).all();
          items = results;
        } catch (e) {
          console.error('[GET single] items query failed:', e.message);
        }

        // Query 3: Comments
        let comments = [];
        try {
          const { results } = await db.prepare(`
            SELECT c.*, p.username, p.avatar_url
            FROM comments c
            LEFT JOIN profiles p ON c.user_id = p.id
            WHERE c.ranking_id = ?
            ORDER BY c.created_at DESC
          `).bind(id).all();
          comments = results;
        } catch (e) {
          console.error('[GET single] comments query failed:', e.message);
        }

        // Query 4: Current user's vote (separate, safe, non-blocking)
        let currentUserVote = null;
        if (userId && userId !== 'null' && userId !== 'undefined') {
          try {
            const voteRow = await db.prepare(
              'SELECT vote_type FROM votes WHERE ranking_id = ? AND user_id = ? LIMIT 1'
            ).bind(id, userId).first();
            if (voteRow) currentUserVote = voteRow.vote_type;
            console.log('[GET single] user vote:', currentUserVote);
          } catch (e) {
            console.error('[GET single] user vote query failed:', e.message);
          }
        }

        const result = {
          ...ranking,
          profile: { id: ranking.user_id, username: ranking.username || 'Unknown', avatar_url: ranking.avatar_url },
          stats: {
            totalLikes: ranking.likes_count,
            totalDislikes: ranking.dislikes_count,
            comments: ranking.comments_count,
            currentUserVote
          },
          ranking_items: items.map(ri => ({
            ...ri, item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
          })),
          comments
        };

        console.log('[GET single] success, currentUserVote:', currentUserVote);
        return jsonResponse({ success: true, data: result });
      }

      // ── List / feed ──
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

      let rankings;
      try {
        const { results } = await db.prepare(query).bind(...params).all();
        rankings = results;
      } catch (e) {
        console.error('[GET list] rankings query failed:', e.message);
        return jsonResponse({ success: false, error: 'Query failed: ' + e.message }, 500);
      }

      let formattedRankings = [];
      if (rankings.length > 0) {
        const rankingIds = rankings.map(r => r.id);
        const placeholders = rankingIds.map(() => '?').join(',');

        let allItems = [];
        try {
          const { results } = await db.prepare(`
            SELECT ri.*, i.name as item_name, i.image_url as item_image
            FROM ranking_items ri
            LEFT JOIN items i ON ri.item_id = i.id
            WHERE ri.ranking_id IN (${placeholders})
          `).bind(...rankingIds).all();
          allItems = results;
        } catch (e) {
          console.error('[GET list] items query failed:', e.message);
        }

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
          stats: {
            totalLikes: r.likes_count,
            totalDislikes: r.dislikes_count,
            comments: r.comments_count,
            currentUserVote: null
          },
          ranking_items: itemsMap[r.id] || []
        }));

        // Batch-fetch all user votes in one query
        if (userId && userId !== 'null' && userId !== 'undefined') {
          try {
            const placeholders2 = rankingIds.map(() => '?').join(',');
            const { results: userVotes } = await db.prepare(
              `SELECT ranking_id, vote_type FROM votes WHERE user_id = ? AND ranking_id IN (${placeholders2})`
            ).bind(userId, ...rankingIds).all();
            const votesMap = {};
            userVotes.forEach(v => { votesMap[v.ranking_id] = v.vote_type; });
            formattedRankings.forEach(r => {
              r.stats.currentUserVote = votesMap[r.id] || null;
            });
          } catch (e) {
            console.error('[GET list] user votes query failed:', e.message);
          }
        }
      }

      console.log('[GET list] returning', formattedRankings.length, 'rankings');
      return jsonResponse({ success: true, data: formattedRankings });
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
    console.error('[/api/rankings] unhandled error:', err.message);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
