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
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50), 100);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const offset = (page - 1) * limit;
      const sort = url.searchParams.get('sort'); // 'popular' (default) | 'recent' | 'views'

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (category && category !== 'null') { whereSql += ` AND t.category = ?`; whereParams.push(category); }
      if (hashtag) {
        // แมตช์แท็กแบบเป๊ะ (ไม่ใช่ substring) — ห่อทั้งสองฝั่งด้วย ',' แล้วค้นหา ',#tag,'
        // ป้องกันปัญหา LIKE '%tag%' ที่ 'Pop' จะไปแมตช์ '#TPop' ด้วย (ดู docs/feature-discover-view-all-pages.md §4)
        whereSql += ` AND instr(',' || lower(t.hashtags) || ',', lower(?)) > 0`;
        whereParams.push(`,#${hashtag.replace(/^#/, '')},`);
      }

      let orderSql = ` ORDER BY t.use_count DESC, t.created_at DESC, t.id DESC`;
      if (sort === 'recent') orderSql = ` ORDER BY t.created_at DESC, t.id DESC`;
      else if (sort === 'views') orderSql = ` ORDER BY t.view_count DESC, t.use_count DESC, t.id DESC`;

      const query = `
        SELECT t.*, p.username, p.avatar_url,
          t.use_count as live_uses
        FROM templates t
        LEFT JOIN profiles p ON t.creator_id = p.id
        ${whereSql}
        ${orderSql}
        LIMIT ? OFFSET ?
      `;
      const params = [...whereParams, limit, offset];

      const { results: templates } = await db.prepare(query).bind(...params).all();

      const { results: totalRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM templates t${whereSql}`
      ).bind(...whereParams).all();
      const total = totalRows[0]?.n || 0;

      let itemsMap = {};
      if (templates.length > 0) {
        const templateIds = templates.map(t => t.id);
        const placeholders = templateIds.map(() => '?').join(',');
        // 📍 เดิมดึง template_items "ทุกแถว" ของทุก template ในหน้านี้ แต่การ์ด (TemplateCard)
        // โชว์แค่ 2 tier บนสุด x 2 ไอเทม/tier = อย่างมาก 4 ไอเทมต่อการ์ด — วัดจริงจาก D1 trace:
        // ~933 rows/request เพื่อโชว์จริงแค่ ~15% ของที่ดึงมา (ดู
        // docs/row-read-optimization-plan.md §5/§8, C4) จำกัดด้วย ROW_NUMBER() ต่อ template
        // ไม่เกิน 4 แถวแรก (เรียงตาม position) — พอสำหรับพรีวิว ไม่กระทบโหมด detail (ยังดึงครบ)
        // 📍 เดิมดึง template_items "ทุกแถว" ของทุก template ในหน้านี้ แต่การ์ด (TemplateCard)
        // โชว์แค่ 2 tier บนสุด x 2 ไอเทม/tier = อย่างมาก 4 ไอเทมต่อการ์ด — วัดจริงจาก D1 trace:
        // 933 rows/request (50 templates) เพื่อโชว์จริงแค่ ~15% ของที่ดึงมา (ดู
        // docs/row-read-optimization-plan.md §5/§8, C4)
        // ⚠️ ลองใช้ ROW_NUMBER() OVER (PARTITION BY ...) มาก่อน แต่วัดจริงแล้วพบว่า D1 อ่านแพงกว่า
        // เดิม (2,018 rows, มากกว่า uncapped อีก) — window function ทำให้ D1 ต้องอ่านซ้ำหลายรอบ
        // เพื่อ sort ภายในแต่ละ partition ก่อนกรอง แก้ด้วย "position < 4" แทน (plain WHERE ธรรมดา
        // ไม่ต้อง sort) ปลอดภัยเพราะ position ของ template_items มาจาก seed เท่านั้น
        // (grep แล้ว: ไม่มี INSERT INTO template_items ที่ไหนในแอปตอนรันจริง) และ seed ทุกแถวเรียง
        // position ต่อเนื่องเริ่มที่ 0 เสมอ (ยืนยันด้วย query ตรวจ MIN/MAX/COUNT ต่อ template แล้ว)
        const { results: allItems } = await db.prepare(
          `SELECT * FROM template_items WHERE template_id IN (${placeholders}) AND position < 4 ORDER BY template_id, position ASC`
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

      // 📍 ข้อมูล public ล้วน ไม่มี field เฉพาะผู้ชม (ไม่มี user_vote/is_following) — cache ที่ edge
      // ได้ปลอดภัย (ดู docs/row-read-optimization-plan.md §6/§8) ผลข้างเคียงที่ยอมรับได้: เทมเพลต
      // ที่เพิ่งถูกสร้าง/ใช้อาจขึ้นช้าไปสูงสุด 1 นาที
      return Response.json(
        { success: true, data, page, limit, total },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
      );
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

    // 📍 ?fields=meta = โหมดย่อ ใช้โดย PostDetail (AboutTemplateCard) และ RankTierList
    // (pre-fill) ซึ่งอ่านแค่ title/description/tiers/template_items — ไม่เคยอ่าน
    // community_average เลย แต่โหมดเต็ม (TemplateDetailPage) ต้องคำนวณฮิสโตแกรมทุกครั้ง
    // วัดจริงจาก D1 trace: histogram query กิน ~292 rows/request เฉลี่ย (ดู
    // docs/row-read-optimization-plan.md §5/§8, C6) — โหมดย่อข้ามการคำนวณนี้ไปทั้งหมด
    const light = url.searchParams.get('fields') === 'meta';

    const { results: templateItems } = await db.prepare(
      `SELECT * FROM template_items WHERE template_id = ? ORDER BY position ASC`
    ).bind(templateId).all();

    // รวม COUNT(*) กับ MAX(created_at) เป็น query เดียว (เดิมแยก 2 statement คนละ query)
    const { results: statsRows } = await db.prepare(
      `SELECT COUNT(*) as n, MAX(created_at) as latest FROM rankings WHERE template_id = ?`
    ).bind(templateId).all();
    const useCount = statsRows[0]?.n || 0;
    const lastRanked = statsRows[0]?.latest || null;

    let communityAverage = null;
    if (!light && tierCount > 0) {
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

      communityAverage = {
        updated_at: lastRanked,
        tiers: tiersDef.map((t, i) => ({
          label: t.label,
          color: t.color,
          items: itemAverages
            .filter(x => x.tierIndex === i)
            .sort((a, b) => b.avg - a.avg)
            .map(x => ({ name: x.item_id, avg: Math.round(x.avg * 100) / 100 }))
        }))
      };
    }

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
        uses: useCount,
        views: template.view_count || 0
      },
      template_items: templateItems.map(ti => ({
        ...ti,
        item: { id: ti.item_id, name: ti.item_id, image_url: null }
      })),
      community_average: communityAverage
    };

    // 📍 เช่นเดียวกับโหมด list — ไม่มี field เฉพาะผู้ชมเลย cache ที่ edge ได้ปลอดภัย
    return Response.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );

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

    // ส่งเลข view_count ล่าสุดกลับไปด้วย — ฝั่ง client ต้องใช้ค่านี้แทนค่าที่ได้จาก GET
    // เพราะ GET (fetchTemplate) กับ POST (recordTemplateView) ยิงพร้อมกันตอน mount
    // ถ้า GET อ่านไปก่อน UPDATE ข้างบน commit จะได้เลขเก่ามาโชว์ (บั๊ก views ค้าง 0 จนกว่าจะรีเฟรช)
    const { results } = await db.prepare(
      `SELECT view_count FROM templates WHERE id = ?`
    ).bind(template_id).all();

    return Response.json({ success: true, counted: meta.changes > 0, views: results[0]?.view_count ?? 0 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
