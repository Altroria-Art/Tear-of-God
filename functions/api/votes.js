export async function onRequest(context) {
  const { request, env } = context;
  const db = env.tear_of_god_db; // 📍 ใช้ชื่อ binding ให้ตรงกับ wrangler.toml

  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), { 
      status, 
      headers: { 'Content-Type': 'application/json' } 
    });
  };

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const rankingId = body.rankingId || body.ranking_id;
    const userId = body.userId || body.user_id;
    const voteType = body.voteType; // 'like', 'dislike', หรือ null (กรณียกเลิกโหวต)

    if (!rankingId || !userId) {
      return jsonResponse({ success: false, error: 'Missing rankingId or userId' }, 400);
    }

    // 1. เช็คว่า User เคยโหวตโพสต์นี้ไปหรือยัง
    const { results: existing } = await db.prepare(
      `SELECT * FROM votes WHERE ranking_id = ? AND user_id = ?`
    ).bind(rankingId, userId).all();

    // 2. ถ้า voteType เป็น null แปลว่าผู้ใช้กดย้ำเพื่อ "ยกเลิกไลก์/ดิสไลก์"
    if (!voteType) {
      if (existing.length > 0) {
        const statements = [
          db.prepare(`DELETE FROM votes WHERE ranking_id = ? AND user_id = ?`).bind(rankingId, userId)
        ];
        const oldVote = existing[0].vote_type;
        if (oldVote === 'like') {
          statements.push(db.prepare(`UPDATE rankings SET likes_count = MAX(likes_count - 1, 0) WHERE id = ?`).bind(rankingId));
        } else if (oldVote === 'dislike') {
          statements.push(db.prepare(`UPDATE rankings SET dislikes_count = MAX(dislikes_count - 1, 0) WHERE id = ?`).bind(rankingId));
        }
        await db.batch(statements);
      }
    } else {
      // 3. ตรวจสอบความถูกต้องของประเภทการโหวต
      if (voteType !== 'like' && voteType !== 'dislike') {
        return jsonResponse({ success: false, error: 'Invalid vote type' }, 400);
      }

      if (existing.length > 0) {
        const oldVote = existing[0].vote_type;
        if (oldVote !== voteType) {
          const statements = [
            db.prepare(`UPDATE votes SET vote_type = ? WHERE ranking_id = ? AND user_id = ?`).bind(voteType, rankingId, userId)
          ];
          if (voteType === 'like') {
            statements.push(db.prepare(`UPDATE rankings SET likes_count = likes_count + 1, dislikes_count = MAX(dislikes_count - 1, 0) WHERE id = ?`).bind(rankingId));
          } else {
            statements.push(db.prepare(`UPDATE rankings SET likes_count = MAX(likes_count - 1, 0), dislikes_count = dislikes_count + 1 WHERE id = ?`).bind(rankingId));
          }
          await db.batch(statements);
        }
      } else {
        // ถ้ายังไม่เคย ให้ Insert ข้อมูลใหม่
        const voteId = crypto.randomUUID();
        const statements = [
          db.prepare(`INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES (?, ?, ?, ?)`).bind(voteId, rankingId, userId, voteType)
        ];
        if (voteType === 'like') {
          statements.push(db.prepare(`UPDATE rankings SET likes_count = likes_count + 1 WHERE id = ?`).bind(rankingId));
        } else {
          statements.push(db.prepare(`UPDATE rankings SET dislikes_count = dislikes_count + 1 WHERE id = ?`).bind(rankingId));
        }
        await db.batch(statements);
      }
    }

    // 4. อ่านค่าจริงหลังเขียนเสร็จแล้วส่งกลับไป — ฝั่ง client จะได้ไม่ต้องเดาด้วยการ +1/-1 เอง
    //    (ดู docs/feature-like-dislike-voting.md §8 เรื่องเลขที่บวกเองแล้วเพี้ยนสะสม)
    const { results: fresh } = await db.prepare(
      `SELECT likes_count as likes, dislikes_count as dislikes, 
         (SELECT vote_type FROM votes WHERE ranking_id = ?1 AND user_id = ?2) AS user_vote
       FROM rankings WHERE id = ?1`
    ).bind(rankingId, userId).all();

    return jsonResponse({
      success: true,
      userVote: fresh[0]?.user_vote ?? null,
      likes: fresh[0]?.likes ?? 0,
      dislikes: fresh[0]?.dislikes ?? 0
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}