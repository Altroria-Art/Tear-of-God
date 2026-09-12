import { requireAdmin } from './_check.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const user_id = auth.user.id;

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  if (request.method === 'POST') {
    try {
      const { action, target_id, is_template_comment } = await request.json();
      
      if (action === 'delete') {
        if (!target_id) return jsonResponse({ success: false, error: 'Missing target_id' }, 400);

        if (is_template_comment) {
          await db.prepare('DELETE FROM template_comments WHERE id = ?').bind(target_id).run();
        } else {
          // decrement comments_count of the ranking
          const comment = await db.prepare('SELECT ranking_id FROM comments WHERE id = ?').bind(target_id).first();
          if (comment) {
            await db.batch([
              db.prepare('DELETE FROM comments WHERE id = ?').bind(target_id),
              db.prepare('UPDATE rankings SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').bind(comment.ranking_id)
            ]);
          }
        }
        return jsonResponse({ success: true });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
