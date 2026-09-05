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
    // "uses" และ "views" นับสดจาก rankings/template_views ที่ผูก template นี้เสมอ —
    // ไม่อ่าน templates.use_count/view_count ตรงๆ เพราะสองคอลัมน์นี้ไม่ตรงกับข้อมูลจริง
    // (use_count คือเลข seed เก่า, view_count เป็นแค่ mirror ที่ drift ได้ ดู
    // docs/discover-template-uses-views-fix-plan.md)
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

      // เรียงตามเลขจริง (live_uses/live_views) ไม่ใช่คอลัมน์ที่ seed ไว้ — ไม่งั้นลำดับการ์ด
      // จะไม่ตรงกับตัวเลขที่โชว์ (ดู docs/discover-template-uses-views-fix-plan.md)
      let orderSql = ` ORDER BY live_uses DESC, t.created_at DESC, t.id DESC`;
      if (sort === 'recent') orderSql = ` ORDER BY t.created_at DESC, t.id DESC`;
      else if (sort === 'views') orderSql = ` ORDER BY live_views DESC, live_uses DESC, t.id DESC`;

      const query = `
        SELECT t.*, p.username, p.avatar_url,
          (SELECT COUNT(*) FROM rankings r       WHERE r.template_id = t.id) AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views
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
          `SELECT ti.*, i.name as item_name, i.image_url as item_image
           FROM template_items ti
           LEFT JOIN items i ON ti.item_id = i.id
           WHERE ti.template_id IN (${placeholders}) AND ti.position < 4 ORDER BY ti.template_id, ti.position ASC`
        ).bind(...templateIds).all();

        allItems.forEach(ti => {
          if (!itemsMap[ti.template_id]) itemsMap[ti.template_id] = [];
          itemsMap[ti.template_id].push({
            ...ti,
            item: { id: ti.item_id, name: ti.item_name || ti.item_id, image_url: ti.item_image }
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
        view_count: t.live_views || 0,
        profile: { username: t.username, avatar_url: t.avatar_url },
        template_items: itemsMap[t.id] || []
      }));

      // 📍 ข้อมูล public ล้วน ไม่มี field เฉพาะผู้ชม (ไม่มี user_vote/is_following) — cache ที่ edge
      // ได้ปลอดภัย (ดู docs/row-read-optimization-plan.md §6/§8) แต่ max-age เดิม 60s บวก
      // stale-while-revalidate=300s ทำให้ browser ค้าง response เก่าได้นานสุด ~360s — เคยเป็นบั๊กจริง:
      // Discover ยังโชว์ Views เก่าหลังกลับมาจากหน้า Template Detail ที่เพิ่งนับ view ไปแล้ว
      // (ดู docs/discover-template-view-refresh-and-tracking-plan.md) ตัด stale-while-revalidate
      // ทิ้งไปเลยเพราะมันคือตัวยืดหน้าต่างค้าง ไม่ใช่แค่ลด max-age เฉยๆ — เหลือ cache สั้นๆ 10s
      // พอดูดซับ burst ตอนสลับ Discover↔Detail เร็วๆ แต่ไม่ค้างนานเกินไป
      return Response.json(
        { success: true, data, page, limit, total },
        { headers: { 'Cache-Control': 'public, max-age=10' } }
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

    // 📍 ช่วงเวลา (popularity ตามช่วงเวลานั้นๆ) — กรองจาก created_at ของ ranking_item_scores
    // รับได้: days=N (N วันที่ผ่านมา) หรือ from/to (วันที่แบบ YYYY-MM-DD) / from may be omitted
    const daysParam = parseInt(url.searchParams.get('days') || '', 10);
    let period = null;
    if (!Number.isNaN(daysParam) && daysParam > 0) {
      const from = new Date(Date.now() - daysParam * 86400000);
      period = { from: from.toISOString(), to: null };
    } else {
      const fromRaw = url.searchParams.get('from');
      const toRaw = url.searchParams.get('to');
      if (fromRaw || toRaw) {
        period = { from: fromRaw || null, to: toRaw || null };
      }
    }

    // 📍 ?fields=meta = โหมดย่อ ใช้โดย PostDetail (AboutTemplateCard) และ RankTierList
    // (pre-fill) ซึ่งอ่านแค่ title/description/tiers/template_items — ไม่เคยอ่าน
    // community_average เลย แต่โหมดเต็ม (TemplateDetailPage) ต้องคำนวณฮิสโตแกรมทุกครั้ง
    // วัดจริงจาก D1 trace: histogram query กิน ~292 rows/request เฉลี่ย (ดู
    // docs/row-read-optimization-plan.md §5/§8, C6) — โหมดย่อข้ามการคำนวณนี้ไปทั้งหมด
    const light = url.searchParams.get('fields') === 'meta';

    const { results: templateItems } = await db.prepare(
      `SELECT ti.*, i.name as item_name, i.image_url as item_image
       FROM template_items ti
       LEFT JOIN items i ON ti.item_id = i.id
       WHERE ti.template_id = ? ORDER BY ti.position ASC`
    ).bind(templateId).all();

    // รวม COUNT(*) กับ MAX(created_at) เป็น query เดียว (เดิมแยก 2 statement คนละ query)
    const { results: statsRows } = await db.prepare(
      `SELECT COUNT(*) as n, MAX(created_at) as latest FROM rankings WHERE template_id = ?`
    ).bind(templateId).all();
    const useCount = statsRows[0]?.n || 0;
    const lastRanked = statsRows[0]?.latest || null;

    // views นับสดจาก template_views เสมอ — ไม่อ่าน templates.view_count ตรงๆ เพราะเป็นแค่
    // mirror counter ที่ drift ได้ (ดู docs/discover-template-uses-views-fix-plan.md)
    const { results: viewRows } = await db.prepare(
      `SELECT COUNT(*) as n FROM template_views WHERE template_id = ?`
    ).bind(templateId).all();
    const viewCount = viewRows[0]?.n || 0;

    // like/dislike/comment ของ Community Average — นับสดจากตาราง template_reactions/template_comments
    const { results: reactionRows } = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM template_reactions WHERE template_id = ?1 AND vote_type = 'like') AS likes,
         (SELECT COUNT(*) FROM template_reactions WHERE template_id = ?1 AND vote_type = 'dislike') AS dislikes,
         (SELECT COUNT(*) FROM template_comments WHERE template_id = ?1) AS comments`
    ).bind(templateId).all();
    const reaction = reactionRows[0] || {};

    let communityAverage = null;
    if (!light && tierCount > 0) {
      // Community Average: อ่านจาก ranking_item_scores (บันทึกคะแนน freeze ตอนสร้าง) แล้ว
      // aggregate ตามช่วงเวลาที่ขอ — score เก็บค่า "แถวบนสุด = สูงสุด" อยู่แล้ว ไม่ต้อง map label ซ้ำ

      // Self-heal: ถ้า template นี้มี rankings แต่ยังไม่มีคะแนนเลยใน ranking_item_scores
      // (เช่น local state ถูก reset แล้ว rerun schema โดยไม่ได้ backfill — เหตุการณ์จริงที่ทำให้
      // การ์ด Community Average หายทั้งใบ) ให้คำนวณคะแนนจาก ranking_items + tiers แล้ว insert
      // ครั้งเดียว — logic เดียวกับ scripts/backfill-scores.mjs (ดู docs/community-average-backfill-plan.md)
      const { results: scoreCountRows } = await db.prepare(
        `SELECT COUNT(*) AS n FROM ranking_item_scores WHERE template_id = ?`
      ).bind(templateId).all();
      if (useCount > 0 && (scoreCountRows[0]?.n || 0) === 0) {
        const { results: scoreSeedRows } = await db.prepare(
          `SELECT ri.ranking_id, ri.item_id, ri.tier, r.created_at
           FROM ranking_items ri
           JOIN rankings r ON r.id = ri.ranking_id
           WHERE r.template_id = ?`
        ).bind(templateId).all();

        const tierIndexByLabel = {};
        tiersDef.forEach((t, i) => { tierIndexByLabel[String(t.label)] = i; });

        const scoreInserts = [];
        scoreSeedRows.forEach((row) => {
          const tierIdx = tierIndexByLabel[String(row.tier)];
          if (tierIdx === undefined) return; // item ยังไม่จัด / tier ไม่ตรง — ข้าม
          scoreInserts.push(
            db.prepare(
              `INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(crypto.randomUUID(), row.ranking_id, templateId, row.item_id, tierIdx, tierCount - tierIdx, row.created_at || null)
          );
        });
        // D1 batch จำกัด 100 statements ต่อครั้ง — ตัดเป็นชุด
        for (let i = 0; i < scoreInserts.length; i += 100) {
          await db.batch(scoreInserts.slice(i, i + 100));
        }
      }

      let whereSql = ` WHERE ris.template_id = ?`;
      const whereParams = [templateId];
      if (period?.from) { whereSql += ` AND ris.created_at >= ?`; whereParams.push(period.from); }
      if (period?.to) { whereSql += ` AND ris.created_at <= ?`; whereParams.push(period.to); }

      const { results: histogram } = await db.prepare(
        `SELECT ris.item_id, ris.score, COUNT(*) as n
         FROM ranking_item_scores ris
         ${whereSql}
         GROUP BY ris.item_id, ris.score`
      ).bind(...whereParams).all();

      const itemAgg = {};
      histogram.forEach(row => {
        if (!itemAgg[row.item_id]) itemAgg[row.item_id] = { sum: 0, count: 0 };
        itemAgg[row.item_id].sum += row.score * row.n;
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
        period,
        tiers: tiersDef.map((t, i) => ({
          label: t.label,
          color: t.color,
          items: itemAverages
            .filter(x => x.tierIndex === i)
            .sort((a, b) => b.avg - a.avg)
            .map(x => ({ name: x.item_id, avg: Math.round(x.avg * 100) / 100, votes: x.votes }))
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
        views: viewCount,
        likes: reaction.likes || 0,
        dislikes: reaction.dislikes || 0,
        comments: reaction.comments || 0
      },
      template_items: templateItems.map(ti => ({
        ...ti,
        item: { id: ti.item_id, name: ti.item_name || ti.item_id, image_url: ti.item_image }
      })),
      community_average: communityAverage
    };

    // 📍 เช่นเดียวกับโหมด list — ไม่มี field เฉพาะผู้ชมเลย cache ที่ edge ได้ปลอดภัย แต่ใช้ max-age
    // สั้นเท่ากัน (10s, ไม่มี stale-while-revalidate) ด้วยเหตุผลเดียวกัน — ให้ผู้ที่ไม่ได้ล็อกอิน
    // (ไม่มี overlay จาก POST) เห็นเลข views ที่ใกล้เคียงปัจจุบันด้วย
    return Response.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': 'public, max-age=10' } }
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

    // 📍 INSERT + UPDATE รวมเป็น db.batch() เดียว (atomic) — เดิมเป็น 2 .run() แยกกัน ถ้า worker
    // ถูกตัดตอนระหว่างสองคำสั่งนี้ (network drop/CPU-time limit) แถว template_views จะถูกเขียน
    // สำเร็จแต่ counter ไม่ถูกบวก ทำให้ view_count ค่อยๆ drift ออกจากข้อมูลจริงแบบไม่มีทาง
    // self-heal (ดู docs/discover-template-uses-views-fix-plan.md — พบ drift จริงใน production)
    // แก้โดย "คำนวณ view_count ใหม่จาก COUNT(*) ของ template_views" แทนการ +1 — ทำให้ทุกครั้งที่
    // POST เข้ามา counter จะซิงค์กับข้อมูลจริงเสมอ ไม่ว่าจะเคย drift มาก่อนหรือไม่ (self-healing
    // ไม่ต้องมี migration/backfill แยกต่างหาก)
    const [insertResult] = await db.batch([
      db.prepare(`INSERT OR IGNORE INTO template_views (template_id, user_id) VALUES (?, ?)`)
        .bind(template_id, user_id),
      db.prepare(
        `UPDATE templates SET view_count = (SELECT COUNT(*) FROM template_views WHERE template_id = ?) WHERE id = ?`
      ).bind(template_id, template_id)
    ]);

    // ส่งเลข view_count ล่าสุดกลับไปด้วย — ฝั่ง client ต้องใช้ค่านี้แทนค่าที่ได้จาก GET
    // เพราะ GET (fetchTemplate) กับ POST (recordTemplateView) ยิงพร้อมกันตอน mount
    // ถ้า GET อ่านไปก่อน UPDATE ข้างบน commit จะได้เลขเก่ามาโชว์ (บั๊ก views ค้าง 0 จนกว่าจะรีเฟรช)
    const { results } = await db.prepare(
      `SELECT view_count FROM templates WHERE id = ?`
    ).bind(template_id).all();

    // counted อ้างอิงผลของ INSERT (statement แรกใน batch) — ต้องเป็นแถวใหม่จริงเท่านั้นถึงนับ
    // ว่า "view" นี้ถูกนับ ไม่ใช่ผลของ UPDATE ซึ่ง match แถว templates เสมอไม่ว่า INSERT จะถูก
    // IGNORE หรือไม่ก็ตาม
    return Response.json({ success: true, counted: insertResult.meta.changes > 0, views: results[0]?.view_count ?? 0 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
