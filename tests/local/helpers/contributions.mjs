// Seed the same one-current-ranking-per-user relation as migration 0021.
// Historical test fixtures that insert rankings directly bypass publish logic.
export async function seedLatestContributions(db) {
  await db.prepare(`INSERT OR IGNORE INTO template_user_contributions
      (template_id, user_id, current_ranking_id, cooldown_until, last_contributed_at)
    SELECT template_id, user_id, id, datetime(created_at, '+7 days'), created_at
    FROM (
      SELECT id, template_id, user_id, created_at,
        ROW_NUMBER() OVER (PARTITION BY template_id, user_id ORDER BY created_at DESC, id DESC) AS rn
      FROM rankings WHERE template_id IS NOT NULL AND user_id IS NOT NULL
    ) WHERE rn = 1`).run();
}
