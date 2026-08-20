export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get('id');

  try {
    if (!templateId) {
      return Response.json({ success: false, error: 'Missing template id' }, { status: 400 });
    }

    // 1. ดึงข้อมูลโพสต์ (Template) จากฐานข้อมูล
    const db = env.tear_of_god_db;

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

    // 2. ดึงคอมเมนต์ของ Template นี้ (via rankings that use this template)
    const { results: comments } = await db.prepare(
      `SELECT c.*, p.username, p.avatar_url 
       FROM comments c 
       LEFT JOIN profiles p ON c.user_id = p.id 
       WHERE c.ranking_id IN (SELECT id FROM rankings WHERE template_id = ?) 
       ORDER BY c.created_at DESC`
    ).bind(templateId).all();

    // 3. ดึง rankings ทั้งหมดที่ใช้ template นี้
    const { results: rankings } = await db.prepare(
      `SELECT r.*, p.username, p.avatar_url
       FROM rankings r
       LEFT JOIN profiles p ON r.user_id = p.id
       WHERE r.template_id = ?
       ORDER BY r.created_at DESC`
    ).bind(templateId).all();

    // 4. สรุปยอดโหวตของทุก ranking ที่ผูกกับ template นี้
    const { results: votes } = await db.prepare(
      `SELECT 
        SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
       FROM votes WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)`
    ).bind(templateId).all();

    const stats = {
      likes: votes[0]?.likes || 0,
      dislikes: votes[0]?.dislikes || 0,
      comments: comments.length,
      views: 0,
      uses: template.use_count || 0
    };

    // ดึง ranking_items ของแต่ละ ranking
    const rankingsWithItems = [];
    for (const ranking of rankings) {
      const { results: rankingItems } = await db.prepare(
        `SELECT ri.*, i.name as item_name, i.image_url as item_image
         FROM ranking_items ri
         LEFT JOIN items i ON ri.item_id = i.id
         WHERE ri.ranking_id = ?
         ORDER BY ri.position ASC`
      ).bind(ranking.id).all();

      const { results: rankingVotes } = await db.prepare(
        `SELECT 
          SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
         FROM votes WHERE ranking_id = ?`
      ).bind(ranking.id).all();

      rankingsWithItems.push({
        id: ranking.id,
        is_average: false,
        profile: { username: ranking.username, avatar_url: ranking.avatar_url },
        created_at: ranking.created_at,
        ranking_items: rankingItems,
        stats: {
          likes: rankingVotes[0]?.likes || 0,
          dislikes: rankingVotes[0]?.dislikes || 0
        }
      });
    }

    const responseData = {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      hashtags: template.hashtags,
      profile: {
        username: template.username,
        avatar_url: template.avatar_url
      },
      stats: stats,
      rankings: rankingsWithItems,
      comments: comments
    };

    return Response.json({ success: true, data: responseData });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}