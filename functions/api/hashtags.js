// ==========================================
// GET /api/hashtags?page=&limit=&sort=&q=
// รวม hashtag ทั้งหมดจาก templates.hashtags (คอลัมน์ CSV) ด้วย recursive CTE เดียว
// ใช้ bound params ตายตัว 3 ตัว (q, limit, offset) ไม่ว่าจะมี template/hashtag กี่แถวก็ตาม
// (ดู docs/feature-discover-view-all-pages.md §6 เรื่องลิมิต 100 bound params ของ D1)
// ==========================================
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const db = env.tear_of_god_db;

  try {
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;
    const sort = url.searchParams.get('sort'); // 'used' (default) | 'az'
    const q = (url.searchParams.get('q') || '').trim();

    const orderSql = sort === 'az' ? `tag ASC` : `template_count DESC, tag ASC`;

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
        SELECT tag, COUNT(DISTINCT tid) AS template_count
          FROM split
         WHERE tag <> ''
         GROUP BY tag
      )
    `;

    const { results: rows } = await db.prepare(`
      ${cte}
      SELECT tag, template_count FROM tags
       WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
       ORDER BY ${orderSql}
       LIMIT ?2 OFFSET ?3
    `).bind(q, limit, offset).all();

    const { results: totalRows } = await db.prepare(`
      ${cte}
      SELECT COUNT(*) as n FROM tags
       WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
    `).bind(q).all();
    const total = totalRows[0]?.n || 0;

    return Response.json({
      success: true,
      data: rows.map(r => ({ tag: r.tag, template_count: r.template_count })),
      page,
      limit,
      total
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
