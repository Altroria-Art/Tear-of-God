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

    // 📍 เดิม query นี้รัน recursive CTE เดียวกันซ้ำ 2 รอบ (rows + total แยกกันคนละ statement) —
    // วัดจริงจาก D1 trace: ~874 rows/request (457+417) ทั้งที่ควรรันแค่ครั้งเดียว (ดู
    // docs/row-read-optimization-plan.md §5/§8, C5) ใช้ COUNT(*) OVER() ให้ total ติดมากับ
    // แต่ละแถวของหน้าที่ขอแทน — รันซ้ำ CTE ก็ต่อเมื่อหน้าที่ขอไม่มีแถวเหลือ (เช่น page เกิน
    // ขอบเขตหลัง filter เปลี่ยน) ซึ่งเป็นกรณีหายากเท่านั้น
    const { results: rows } = await db.prepare(`
      ${cte}
      SELECT tag, template_count, COUNT(*) OVER() AS total_count FROM tags
       WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
       ORDER BY ${orderSql}
       LIMIT ?2 OFFSET ?3
    `).bind(q, limit, offset).all();

    let total = rows[0]?.total_count ?? null;
    if (total === null) {
      const { results: totalRows } = await db.prepare(`
        ${cte}
        SELECT COUNT(*) as n FROM tags
         WHERE (?1 = '' OR instr(lower(tag), lower(?1)) > 0)
      `).bind(q).all();
      total = totalRows[0]?.n || 0;
    }

    // 📍 ข้อมูล public ล้วน (นับจากทุก template ในระบบ ไม่มี field เฉพาะผู้ชม) — cache ที่ edge
    // ได้ปลอดภัย (ดู docs/row-read-optimization-plan.md §6/§8)
    return Response.json(
      {
        success: true,
        data: rows.map(r => ({ tag: r.tag, template_count: r.template_count })),
        page,
        limit,
        total
      },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
