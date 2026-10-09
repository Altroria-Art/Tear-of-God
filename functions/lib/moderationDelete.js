import { getDeleteReconcileStatement } from './cooldown.js';
import { templateDeleteStatements } from './templateDelete.js';

// Shared plans keep a moderation decision and its deletion in one D1 batch.
export async function rankingDeletePlan(db, targetId) {
  const ranking = await db.prepare('SELECT template_id, user_id FROM rankings WHERE id = ?').bind(targetId).first();
  const statements = [
    db.prepare(`UPDATE templates SET use_count = MAX(0, COALESCE(use_count, 0) - 1) WHERE id = (SELECT template_id FROM rankings WHERE id = ?)`).bind(targetId),
    db.prepare('DELETE FROM ranking_items WHERE ranking_id = ?').bind(targetId),
    db.prepare('DELETE FROM votes WHERE ranking_id = ?').bind(targetId),
    db.prepare('DELETE FROM comments WHERE ranking_id = ?').bind(targetId),
    db.prepare('DELETE FROM ranking_item_scores WHERE ranking_id = ?').bind(targetId),
    db.prepare('DELETE FROM rankings WHERE id = ?').bind(targetId),
  ];
  if (ranking?.template_id && ranking?.user_id) {
    const reconcile = await getDeleteReconcileStatement(db, ranking.template_id, ranking.user_id, targetId);
    if (reconcile) statements.unshift(reconcile);
  }
  return { statements, templateId: ranking?.template_id, spotlights: true };
}
export async function commentDeletePlan(db, targetId, isTemplateComment) {
  if (isTemplateComment) return { statements: [
    db.prepare('DELETE FROM template_comments WHERE parent_id = ?').bind(targetId),
    db.prepare('DELETE FROM template_comments WHERE id = ?').bind(targetId),
  ] };
  const comment = await db.prepare('SELECT ranking_id FROM comments WHERE id = ?').bind(targetId).first();
  return { spotlights: true, statements: comment ? [
    db.prepare('DELETE FROM comments WHERE parent_id = ?').bind(targetId),
    db.prepare('DELETE FROM comments WHERE id = ?').bind(targetId),
    db.prepare('UPDATE rankings SET comments_count = (SELECT COUNT(*) FROM comments WHERE ranking_id = ?) WHERE id = ?').bind(comment.ranking_id, comment.ranking_id),
  ] : [] };
}
export async function reportDeletePlan(db, report) {
  if (report.target_kind === 'template') return { statements: templateDeleteStatements(db, report.template_id), templateId: report.template_id, spotlights: true };
  if (report.target_kind === 'post') return rankingDeletePlan(db, report.ranking_id);
  return commentDeletePlan(db, report.target_kind === 'comment' ? report.comment_id : report.template_comment_id, report.target_kind === 'template_comment');
}
