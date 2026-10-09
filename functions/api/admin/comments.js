import { requireAdmin } from './_check.js';
import { assertAllowedFields, assertBoolean } from '../../lib/request-guard.js';
import { adminMutationRateLimitResponse, adminRequestErrorResponse, readAdminMutation } from './_request.js';
import { invalidateSpotlightsCache } from '../../lib/spotlight-cache.js';
import { commentDeletePlan } from '../../lib/moderationDelete.js';

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
        const plan = await commentDeletePlan(db, targetId, isTemplateComment);
        if (plan.statements.length) await db.batch(plan.statements);
        if (plan.spotlights) await invalidateSpotlightsCache(request);
        return jsonResponse({ success: true });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin comment mutation');
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
