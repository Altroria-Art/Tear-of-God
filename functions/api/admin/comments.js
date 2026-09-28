import { requireAdmin } from './_check.js';
import { assertAllowedFields, assertBoolean } from '../../lib/request-guard.js';
import { adminMutationRateLimitResponse, adminRequestErrorResponse, readAdminMutation } from './_request.js';
import { invalidateSpotlightsCache } from '../../lib/spotlight-cache.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const user_id = auth.user.id;

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  if (request.method === 'POST') {
    const limited = adminMutationRateLimitResponse(user_id);
    if (limited) return limited;
    try {
      const { payload, action, targetId } = await readAdminMutation(request, ['delete']);
      assertAllowedFields(payload, ['action', 'target_id', 'is_template_comment']);
      const isTemplateComment = assertBoolean(payload.is_template_comment, 'is_template_comment', { optional: true }) ?? false;
      
      if (action === 'delete') {
        if (isTemplateComment) {
          await db.batch([
            db.prepare('DELETE FROM template_comments WHERE parent_id = ?').bind(targetId),
            db.prepare('DELETE FROM template_comments WHERE id = ?').bind(targetId)
          ]);
        } else {
          // Recount in the delete transaction: nested replies cascade too, and
          // concurrent moderation must not decrement the same subtree twice.
          const comment = await db.prepare('SELECT ranking_id FROM comments WHERE id = ?').bind(targetId).first();
          if (comment) {
            await db.batch([
              db.prepare('DELETE FROM comments WHERE parent_id = ?').bind(targetId),
              db.prepare('DELETE FROM comments WHERE id = ?').bind(targetId),
              db.prepare('UPDATE rankings SET comments_count = (SELECT COUNT(*) FROM comments WHERE ranking_id = ?) WHERE id = ?')
                .bind(comment.ranking_id, comment.ranking_id)
            ]);
            await invalidateSpotlightsCache(request);
          }
        }
        return jsonResponse({ success: true });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin comment mutation');
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
