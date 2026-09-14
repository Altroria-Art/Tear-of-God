import { compactHashtags, fallbackDescription, serveAppWithMeta } from '../lib/page-meta.js';

export async function onRequestGet(context) {
  const id = String(context.params.id || '');
  let metadata = {};

  try {
    const post = await context.env.tear_of_god_db.prepare(`
      SELECT r.title, r.description, r.hashtags, r.template_id,
        p.username, t.title AS template_title,
        (SELECT COUNT(*) FROM ranking_items ri WHERE ri.ranking_id = r.id AND ri.tier IS NOT NULL) AS item_count
      FROM rankings r
      LEFT JOIN profiles p ON p.id = r.user_id
      LEFT JOIN templates t ON t.id = r.template_id
      WHERE r.id = ?
    `).bind(id).first();

    if (post) {
      const author = post.username || 'สมาชิกชุมชน';
      const hashtags = compactHashtags(post.hashtags);
      const description = post.description
        || `${fallbackDescription(post.template_title || post.title, post.item_count)}${hashtags ? ` · ${hashtags}` : ''}`;
      metadata = {
        title: `${post.title} — Tier List โดย ${author}`,
        description,
        type: 'article'
      };
    }
  } catch (error) {
    console.error('Post metadata query failed:', { name: error?.name, message: error?.message });
  }

  return serveAppWithMeta(context, metadata);
}
