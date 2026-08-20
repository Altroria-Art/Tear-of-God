function parseTiers(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get('id');
  const db = env.tear_of_god_db;

  try {
    // ==========================================
    // โหมด list: GET /api/templates?hashtag=..&category=..&limit=..
    // ==========================================
    if (!templateId) {
      const hashtag = url.searchParams.get('hashtag');
      const category = url.searchParams.get('category');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);

      let query = `
        SELECT t.*, p.username, p.avatar_url
        FROM templates t
        LEFT JOIN profiles p ON t.creator_id = p.id
        WHERE 1=1
      `;
      const params = [];
      if (category && category !== 'null') { query += ` AND t.category = ?`; params.push(category); }
      if (hashtag) { query += ` AND t.hashtags LIKE ?`; params.push(`%${hashtag}%`); }
      query += ` ORDER BY t.use_count DESC, t.created_at DESC LIMIT ?`;
      params.push(limit);

      const { results: templates } = await db.prepare(query).bind(...params).all();

      let itemsMap = {};
      if (templates.length > 0) {
        const templateIds = templates.map(t => t.id);
        const placeholders = templateIds.map(() => '?').join(',');
        const { results: allItems } = await db.prepare(
          `SELECT * FROM template_items WHERE template_id IN (${placeholders}) ORDER BY position ASC`
        ).bind(...templateIds).all();

        allItems.forEach(ti => {
          if (!itemsMap[ti.template_id]) itemsMap[ti.template_id] = [];
          itemsMap[ti.template_id].push({
            ...ti,
            item: { id: ti.item_id, name: ti.item_id, image_url: null }
          });
        });
      }

      const data = templates.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        hashtags: t.hashtags,
        tiers: parseTiers(t.tiers),
        use_count: t.use_count || 0,
        profile: { username: t.username, avatar_url: t.avatar_url },
        template_items: itemsMap[t.id] || []
      }));

      return Response.json({ success: true, data });
    }

    // ==========================================
    // โหมด detail: GET /api/templates?id=..
    // ==========================================
    const { results: templateResults } = await db.prepare(
      `SELECT t.*, p.username, p.avatar_url
       FROM templates t
       LEFT JOIN profiles p ON t.creator_id = p.id
       WHERE t.id = ?`
    ).bind(templateId).all();

    if (templateResults.length === 0) {
      return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const template = templateResults[0];

    const { results: templateItems } = await db.prepare(
      `SELECT * FROM template_items WHERE template_id = ? ORDER BY position ASC`
    ).bind(templateId).all();

    const { results: comments } = await db.prepare(
      `SELECT c.*, p.username, p.avatar_url
       FROM comments c
       LEFT JOIN profiles p ON c.user_id = p.id
       WHERE c.ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)
       ORDER BY c.created_at DESC`
    ).bind(templateId).all();

    const { results: rankings } = await db.prepare(
      `SELECT r.*, p.username, p.avatar_url
       FROM rankings r
       LEFT JOIN profiles p ON r.user_id = p.id
       WHERE r.template_id = ?
       ORDER BY r.created_at DESC`
    ).bind(templateId).all();

    const { results: voteTotals } = await db.prepare(
      `SELECT
        SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
       FROM votes WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)`
    ).bind(templateId).all();

    const stats = {
      likes: voteTotals[0]?.likes || 0,
      dislikes: voteTotals[0]?.dislikes || 0,
      comments: comments.length,
      views: 0,
      uses: template.use_count || 0
    };

    // ดึง ranking_items + votes ของทุก ranking แบบ batched (กัน N+1 query ที่จะชนลิมิต 50 queries/invocation)
    let rankingsWithItems = [];
    if (rankings.length > 0) {
      const rankingIds = rankings.map(r => r.id);
      const placeholders = rankingIds.map(() => '?').join(',');

      const { results: allRankingItems } = await db.prepare(
        `SELECT ri.*, i.name as item_name, i.image_url as item_image
         FROM ranking_items ri
         LEFT JOIN items i ON ri.item_id = i.id
         WHERE ri.ranking_id IN (${placeholders})
         ORDER BY ri.position ASC`
      ).bind(...rankingIds).all();

      const rankingItemsMap = {};
      allRankingItems.forEach(ri => {
        if (!rankingItemsMap[ri.ranking_id]) rankingItemsMap[ri.ranking_id] = [];
        rankingItemsMap[ri.ranking_id].push({
          ...ri,
          item: { id: ri.item_id, name: ri.item_name || ri.item_id, image_url: ri.item_image }
        });
      });

      const { results: perRankingVotes } = await db.prepare(
        `SELECT ranking_id,
          SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
         FROM votes WHERE ranking_id IN (${placeholders})
         GROUP BY ranking_id`
      ).bind(...rankingIds).all();

      const votesMap = {};
      perRankingVotes.forEach(v => { votesMap[v.ranking_id] = v; });

      rankingsWithItems = rankings.map(ranking => ({
        id: ranking.id,
        is_average: false,
        profile: { username: ranking.username, avatar_url: ranking.avatar_url },
        created_at: ranking.created_at,
        ranking_items: rankingItemsMap[ranking.id] || [],
        stats: {
          likes: votesMap[ranking.id]?.likes || 0,
          dislikes: votesMap[ranking.id]?.dislikes || 0
        }
      }));
    }

    const responseData = {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      hashtags: template.hashtags,
      tiers: parseTiers(template.tiers),
      profile: {
        username: template.username,
        avatar_url: template.avatar_url
      },
      stats: stats,
      template_items: templateItems.map(ti => ({
        ...ti,
        item: { id: ti.item_id, name: ti.item_id, image_url: null }
      })),
      rankings: rankingsWithItems,
      comments: comments
    };

    return Response.json({ success: true, data: responseData });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
