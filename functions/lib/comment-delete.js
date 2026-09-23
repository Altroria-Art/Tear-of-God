import { assertId, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody } from './request-guard.js';
import { invalidateSpotlightsCache } from './spotlight-cache.js';

export async function deleteComment(request, db, user, isTemplate = false) {
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const gate = consumeMemoryRateLimit('comment-delete', user.id, { limit: 60, windowSeconds: 3600 });
  if (!gate.allowed) return rateLimitResponse(gate);
  const body = await readJsonBody(request);
  if (!isPlainObject(body)) return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  const id = assertId(body.id);
  // Table names come only from the handler, never from request input.
  const table = isTemplate ? 'template_comments' : 'comments';
  const scope = isTemplate ? 'template_id' : 'ranking_id';
  const comment = await db.prepare(`SELECT user_id, ${scope} AS scope_id FROM ${table} WHERE id = ?`).bind(id).first();
  if (!comment) return Response.json({ success: false, error: 'Comment not found' }, { status: 404 });
  // Role comes from the server-verified session, never the request body.
  const isAdmin = user.role === 'admin';
  if (comment.user_id !== user.id && !isAdmin) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const statements = [
    // Preserve replies, including those belonging to other users, before the
    // self-referencing ON DELETE CASCADE can remove them.
    db.prepare(`UPDATE ${table} SET parent_id = NULL WHERE parent_id = ?
      AND EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND (user_id = ? OR ? = 1))`)
      .bind(id, id, user.id, isAdmin ? 1 : 0),
    db.prepare(`DELETE FROM ${table} WHERE id = ? AND (user_id = ? OR ? = 1)`).bind(id, user.id, isAdmin ? 1 : 0),
  ];
  if (!isTemplate) statements.push(db.prepare(`UPDATE rankings SET comments_count =
    (SELECT COUNT(*) FROM comments WHERE ranking_id = ?) WHERE id = ?`).bind(comment.scope_id, comment.scope_id));
  statements.push(db.prepare(`SELECT COUNT(*) AS comments_count FROM ${table} WHERE ${scope} = ?`).bind(comment.scope_id));
  const result = await db.batch(statements);
  if (!isTemplate) {
    await invalidateSpotlightsCache(request);
  }
  return Response.json({ success: true, comments_count: result.at(-1).results[0].comments_count });
}
