// Scheduled cleanup Worker for read notifications past their 24h retention
// window. This is a separate Worker (not the Pages Functions app) because
// Cloudflare Pages does not support Cron Triggers; it shares the same
// production D1 binding so notifications are deleted even when no user ever
// visits the site again.
//
// Retention rule (same as the lazy per-user purge in GET /api/notifications):
//   is_read = 1 AND read_at IS NOT NULL AND read_at <= datetime('now', '-24 hours')
// The countdown always starts at read time (read_at), never created_at.
//
// Unread rows are never touched: is_read = 1 in the WHERE plus the partial
// index predicate mean the SQLite unread-counter triggers (WHEN OLD.is_read =
// 0) never fire, so notification_unread_counts stays exact.
async function cleanupExpiredNotifications(env) {
  const result = await env.tear_of_god_db.prepare(`
    DELETE FROM notifications
    WHERE is_read = 1
      AND read_at IS NOT NULL
      AND read_at <= datetime('now', '-24 hours')
  `).run();

  // Minimal observability: job name + deleted count only. Never log
  // notification content or user IDs. Failures propagate to the scheduled
  // invocation so they surface in Worker logs instead of being swallowed.
  console.log(JSON.stringify({
    job: 'notification-cleanup',
    deleted: result?.meta?.changes ?? 0,
  }));
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanupExpiredNotifications(env));
  },
};