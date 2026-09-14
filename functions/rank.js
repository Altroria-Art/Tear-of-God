import { serveAppWithMeta } from './lib/page-meta.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const challengeId = url.searchParams.get('challenge');
  const templateId = url.searchParams.get('template');
  let metadata = {};

  if (challengeId) {
    try {
      const challenge = await context.env.tear_of_god_db.prepare(`
        SELECT r.title AS ranking_title, r.template_id, p.username, t.title AS template_title
        FROM rankings r
        LEFT JOIN profiles p ON p.id = r.user_id
        LEFT JOIN templates t ON t.id = r.template_id
        WHERE r.id = ?
      `).bind(challengeId).first();

      if (challenge && (!templateId || challenge.template_id === templateId)) {
        const author = challenge.username || 'เพื่อนของคุณ';
        const subject = challenge.template_title || challenge.ranking_title || 'Tier List นี้';
        metadata = {
          title: `${author} ท้าให้คุณจัด “${subject}”`,
          description: 'จัดไอเทมชุดเดียวกันให้ครบ แล้วเปิดผลทันทีว่าคุณสองคนใจตรงกันหรือเห็นต่างกันตรงไหน'
        };
      }
    } catch (error) {
      console.error('Challenge invitation metadata query failed:', { name: error?.name, message: error?.message });
    }
  }

  return serveAppWithMeta(context, metadata);
}
