// Shared notification helpers. These writes are intentionally best-effort:
// a notification must never make the user's primary action (vote/comment)
// fail if the notification table is temporarily unavailable.

// M4-C2: Bangkok calendar day แบบ pure JS — เทียบเท่า SELECT date('now', '+7 hours')
// ทุกกรณี (พิสูจน์ 15/15 boundary cases เทียบ SQLite จริง: shift UTC +7h แล้วตัดวัน;
// convention เดียวกับ getBangkokPeriods ใน spotlights.js — Bangkok ไม่มี DST จึง
// deterministic; ใช้ Worker clock ซึ่งตรงกับ UTC ของ D1 'now' — ต่างกันได้แค่ skew
// ระดับวินาทีช่วงเที่ยงคืนซึ่ง key รายวัน self-heal เอง) — ประหยัด 1 D1 SELECT ต่อ
// like ที่เข้า digest; ไม่มี locale parsing ไม่มี dependency ใหม่
function bangkokDay(now = Date.now()) {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export async function maybeNotifyTrending(db, rankingId, actorId) {
  try {
    const ranking = await db.prepare(`
      SELECT id, user_id,
        (
          CASE
            WHEN created_at >= datetime('now', '-7 days') THEN 30
            WHEN created_at >= datetime('now', '-30 days') THEN 12
            WHEN created_at >= datetime('now', '-90 days') THEN 3
            ELSE 0
          END
          + COALESCE(likes_count, 0) * 3
          + COALESCE(comments_count, 0) * 2
          - COALESCE(dislikes_count, 0)
        ) AS trend_score
      FROM rankings
      WHERE id = ?
      LIMIT 1
    `).bind(rankingId).first();
    if (!ranking?.user_id || ranking.user_id === actorId || Number(ranking.trend_score || 0) < 40) return;
    await db.prepare(`
      INSERT OR IGNORE INTO notifications
        (id, user_id, actor_id, type, ranking_id)
      VALUES (?, ?, ?, 'trending', ?)
    `).bind(crypto.randomUUID(), ranking.user_id, actorId || null, rankingId).run();
  } catch (error) {
    console.error('Trending notification failed:', error?.message || error);
  }
}

export async function recordLikeDigest(db, rankingId, actorId) {
  try {
    const ranking = await db.prepare('SELECT id, user_id FROM rankings WHERE id = ? LIMIT 1').bind(rankingId).first();
    if (!ranking?.user_id || ranking.user_id === actorId) return;

    // One digest per recipient and Bangkok calendar day. The latest liked ranking
    // is retained as the click target while aggregate_count is incremented.
    const digestKey = `${ranking.user_id}:${bangkokDay()}`;
    await db.prepare(`
      INSERT INTO notifications
        (id, user_id, actor_id, type, ranking_id, aggregate_count, digest_key)
      VALUES (?, ?, NULL, 'like_digest', ?, 1, ?)
      ON CONFLICT(digest_key) DO UPDATE SET
        aggregate_count = notifications.aggregate_count + 1,
        ranking_id = excluded.ranking_id,
        is_read = 0,
        read_at = NULL,
        created_at = CURRENT_TIMESTAMP
    `).bind(crypto.randomUUID(), ranking.user_id, rankingId, digestKey).run();
  } catch (error) {
    console.error('Like digest notification failed:', error?.message || error);
  }
}
