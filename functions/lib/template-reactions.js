// Viewer vote comes only from the verified session, never a query-string ID.
export async function fetchTemplateReactionCounts(db, templateId, userId) {
  const { results } = await db.prepare(`
    SELECT
      COALESCE(SUM(r.vote_type = 'like'), 0) AS likes,
      COALESCE(SUM(r.vote_type = 'dislike'), 0) AS dislikes,
      (SELECT vote_type FROM template_reactions WHERE template_id = ?1 AND user_id = ?2) AS user_vote
    FROM template_reactions r WHERE r.template_id = ?1
  `).bind(templateId, userId || null).all();
  const row = results[0] || {};
  return { userVote: row.user_vote ?? null, likes: row.likes || 0, dislikes: row.dislikes || 0 };
}
