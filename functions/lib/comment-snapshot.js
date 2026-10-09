import { publicResponseCache } from './public-response-cache.js';
import { fetchTemplateReactionCounts } from './template-reactions.js';

// Cache only the public discussion, never session/vote/notification state.
// Periodic reads opt in; initial loads and post-mutation reads stay fresh.
export async function fetchCommentSnapshot(context, entityId, { template = false, includeReactions = false } = {}) {
  const db = context.env.tear_of_god_db;
  const table = template ? 'template_comments' : 'comments';
  const column = template ? 'template_id' : 'ranking_id';
  const load = async () => {
    const { results } = await db.prepare(`
      SELECT c.*, p.username, p.avatar_url
      FROM ${table} c LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.${column} = ? ORDER BY c.created_at DESC LIMIT 200
    `).bind(entityId).all();
    const snapshot = { data: results };
    if (template) {
      const count = await db.prepare('SELECT COUNT(*) AS count FROM template_comments WHERE template_id = ?').bind(entityId).first();
      snapshot.comments_count = count?.count || 0;
      if (includeReactions) {
        const { likes, dislikes } = await fetchTemplateReactionCounts(db, entityId, null);
        snapshot.reactions = { likes, dislikes };
      }
    }
    return Response.json(snapshot);
  };
  const url = new URL(context.request.url);
  if (url.searchParams.get('shared_snapshot') !== '1') return (await load()).json();
  // Construct from the origin, not the incoming request: no cookies/auth headers.
  const key = new URL('/api/__comment_snapshot_v1', url.origin);
  key.searchParams.set('kind', template ? 'template' : 'ranking');
  key.searchParams.set('id', entityId);
  key.searchParams.set('reactions', includeReactions ? '1' : '0');
  return (await publicResponseCache(context, new Request(key), 5, load)).json();
}
