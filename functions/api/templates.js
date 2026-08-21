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
    // "uses" นับสดจากจำนวน rankings ที่ผูก template นี้ (ไม่ใช้ use_count ที่ seed ไว้)
    // ==========================================
    if (!templateId) {
      const hashtag = url.searchParams.get('hashtag');
      const category = url.searchParams.get('category');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);

      let query = `
        SELECT t.*, p.username, p.avatar_url,
          (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) as live_uses
        FROM templates t
        LEFT JOIN profiles p ON t.creator_id = p.id
        WHERE 1=1
      `;
      const params = [];
      if (category && category !== 'null') { query += ` AND t.category = ?`; params.push(category); }
      if (hashtag) { query += ` AND t.hashtags LIKE ?`; params.push(`%${hashtag}%`); }
      query += ` ORDER BY live_uses DESC, t.created_at DESC LIMIT ?`;
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
        use_count: t.live_uses || 0,
        profile: { username: t.username, avatar_url: t.avatar_url },
        template_items: itemsMap[t.id] || []
      }));

      return Response.json({ success: true, data });
    }

    // ==========================================
    // โหมด detail: GET /api/templates?id=..
    // เอา rankings/comments ทั้งชุดออกจาก response นี้แล้ว (ไม่มี LIMIT มาก่อน = เสี่ยงเกิน
    // ลิมิต 100 bound params ของ D1 เมื่อ template มี ranking เกิน 100 อัน) — ฝั่งหน้าเว็บ
    // ดึงรายการ Community Rankings แบบแบ่งหน้าจาก GET /api/rankings?template_id=..&sort=..&page=..
    // แทน ส่วนตารางนี้คืนแค่ meta + Community Average ที่คำนวณด้วย query เดียว
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
    const tiersDef = parseTiers(template.tiers) || [];
    const tierCount = tiersDef.length;

    const { results: templateItems } = await db.prepare(
      `SELECT * FROM template_items WHERE template_id = ? ORDER BY position ASC`
    ).bind(templateId).all();

    const { results: useCountRows } = await db.prepare(
      `SELECT COUNT(*) as n FROM rankings WHERE template_id = ?`
    ).bind(templateId).all();

    const { results: lastRankedRows } = await db.prepare(
      `SELECT MAX(created_at) as latest FROM rankings WHERE template_id = ?`
    ).bind(templateId).all();

    // Community Average: ฮิสโตแกรมเดียว 1 bound param ไม่ว่า template จะมี ranking กี่อัน
    const { results: histogram } = await db.prepare(
      `SELECT ri.item_id, ri.tier, COUNT(*) as n
       FROM ranking_items ri
       WHERE ri.ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)
         AND ri.tier IS NOT NULL
       GROUP BY ri.item_id, ri.tier`
    ).bind(templateId).all();

    const tierLabelToIndex = {};
    tiersDef.forEach((t, i) => { tierLabelToIndex[t.label] = i; });

    const itemAgg = {};
    histogram.forEach(row => {
      const idx = tierLabelToIndex[row.tier];
      if (idx === undefined) return; // tier label ไม่ตรงกับ tiers ปัจจุบันของ template — ข้าม
      const score = tierCount - idx; // tier บนสุด = คะแนนสูงสุด
      if (!itemAgg[row.item_id]) itemAgg[row.item_id] = { sum: 0, count: 0 };
      itemAgg[row.item_id].sum += score * row.n;
      itemAgg[row.item_id].count += row.n;
    });

    const itemAverages = Object.entries(itemAgg).map(([itemId, agg]) => {
      const avg = agg.sum / agg.count;
      let idx = tierCount - Math.round(avg);
      idx = Math.max(0, Math.min(tierCount - 1, idx));
      return { item_id: itemId, avg, tierIndex: idx, votes: agg.count };
    });

    const communityAverage = tierCount > 0 ? {
      updated_at: lastRankedRows[0]?.latest || null,
      tiers: tiersDef.map((t, i) => ({
        label: t.label,
        color: t.color,
        items: itemAverages
          .filter(x => x.tierIndex === i)
          .sort((a, b) => b.avg - a.avg)
          .map(x => ({ name: x.item_id, avg: Math.round(x.avg * 100) / 100 }))
      }))
    } : null;

    const responseData = {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      hashtags: template.hashtags,
      tiers: tiersDef,
      profile: {
        username: template.username,
        avatar_url: template.avatar_url
      },
      stats: {
        uses: useCountRows[0]?.n || 0,
        views: template.view_count || 0
      },
      template_items: templateItems.map(ti => ({
        ...ti,
        item: { id: ti.item_id, name: ti.item_id, image_url: null }
      })),
      community_average: communityAverage
    };

    return Response.json({ success: true, data: responseData });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
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
    const { template_id, user_id } = await request.json();
    if (!template_id || !user_id) {
      return Response.json({ success: false, error: 'Missing template_id or user_id' }, { status: 400 });
    }

    const { meta } = await db.prepare(
      `INSERT OR IGNORE INTO template_views (template_id, user_id) VALUES (?, ?)`
    ).bind(template_id, user_id).run();

    if (meta.changes > 0) {
      await db.prepare(
        `UPDATE templates SET view_count = view_count + 1 WHERE id = ?`
      ).bind(template_id).run();
    }

    return Response.json({ success: true, counted: meta.changes > 0 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
