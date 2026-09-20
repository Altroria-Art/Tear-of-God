// 📍 หน้า Dashboard ของแอดมิน (สถิติภาพรวมของระบบ)
// Phase 1: สร้างเฉพาะ action=stats เป็นของขวัญ/พื้นฐานให้ UI ใน Phase 3 ใช้ต่อ
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';
import { adminRequestErrorResponse } from './_request.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const user_id = auth.user.id;

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  const action = url.searchParams.get('action') || 'stats';

  if (action === 'stats') {
    try {
      const [
        counts,
        recentPostsRows,
        recentReportsRows,
        topHashtagsRows,
        topTemplatesRows
      ] = await Promise.all([
        db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM profiles) AS users,
            (SELECT COUNT(*) FROM rankings) AS rankings,
            (SELECT COUNT(*) FROM templates) AS templates,
            (SELECT COUNT(*) FROM votes) AS votes,
            (SELECT COUNT(*) FROM comments) AS comments,
            (SELECT COUNT(*) FROM follows) AS follows,
            (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports
        `).first(),
        db.prepare(`
          SELECT r.id, r.title, r.hashtags, r.created_at,
                 p.id as author_id, p.username as author_name, p.avatar_url as author_avatar
          FROM rankings r
          LEFT JOIN profiles p ON r.user_id = p.id
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT 5
        `).all(),
        db.prepare(`
          SELECT rp.id, rp.reason, rp.status, rp.created_at,
                 rp.ranking_id, rp.template_id,
                 rk.title AS ranking_title, t.title AS template_title,
                 p.id AS reporter_id, p.username AS reporter_name
          FROM reports rp
          LEFT JOIN rankings rk ON rp.ranking_id = rk.id
          LEFT JOIN templates t ON rp.template_id = t.id
          LEFT JOIN profiles p ON rp.reporter_id = p.id
          WHERE rp.status = 'pending'
          ORDER BY rp.created_at DESC, rp.id DESC
          LIMIT 5
        `).all(),
        db.prepare(`
          SELECT hashtag, COUNT(*) as count FROM ranking_hashtags GROUP BY hashtag ORDER BY count DESC, hashtag ASC
        `).all(),
        db.prepare(`
          SELECT t.id, t.title, t.hashtags,
                 (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
                 (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
                 p.username as author_name
          FROM templates t
          LEFT JOIN profiles p ON t.creator_id = p.id
          ORDER BY live_uses DESC, live_views DESC, t.id DESC
          LIMIT 4
        `).all(),
      ]);

      const stats = {
        users: counts?.users || 0,
        rankings: counts?.rankings || 0,
        templates: counts?.templates || 0,
        votes: counts?.votes || 0,
        comments: counts?.comments || 0,
        follows: counts?.follows || 0,
        pending_reports: counts?.pending_reports || 0,
        recent_posts: (recentPostsRows?.results || []).map(r => ({
          id: r.id,
          title: r.title,
          hashtags: r.hashtags,
          created_at: r.created_at,
          author: { id: r.author_id, username: r.author_name, avatar_url: r.author_avatar }
        })),
        recent_reports: (recentReportsRows?.results || []).map(rp => ({
          id: rp.id,
          kind: rp.ranking_id ? 'post' : 'template',
          title: rp.ranking_id ? rp.ranking_title : rp.template_title,
          target_id: rp.ranking_id || rp.template_id,
          reason: rp.reason,
          status: rp.status,
          created_at: rp.created_at,
          reporter: { id: rp.reporter_id, username: rp.reporter_name }
        })),
        top_hashtags: (topHashtagsRows?.results || []).map(c => ({
          hashtag: c.hashtag,
          count: c.count
        })),
        top_templates: (topTemplatesRows?.results || []).map(t => ({
          id: t.id,
          title: t.title,
          hashtags: t.hashtags,
          uses: t.live_uses ?? 0,
          views: t.live_views ?? 0,
          author: t.author_name
        }))
      };

      return jsonResponse({ success: true, data: stats });
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin dashboard');
    }
  }

  if (action === 'analytics') {
    const parsedDays = parseInt(url.searchParams.get('days') || '7', 10);
    const days = Math.min(Math.max(Number.isNaN(parsedDays) ? 7 : parsedDays, 1), 30);
    const periodModifier = `-${days} days`;
    const previousModifier = `-${days * 2} days`;
    const dailyStartModifier = `-${days - 1} days`;

    try {
      const [funnel, activity, dailyRows, challenge] = await Promise.all([
        db.prepare(`
          WITH feed_step AS (
            SELECT session_id, MIN(created_at) AS reached_at
            FROM analytics_events
            WHERE event_name = 'feed_view' AND created_at >= datetime('now', ?)
            GROUP BY session_id
          ),
          template_step AS (
            SELECT e.session_id, MIN(e.created_at) AS reached_at
            FROM analytics_events e
            INNER JOIN feed_step prior ON prior.session_id = e.session_id
            WHERE e.event_name = 'template_view'
              AND e.created_at >= prior.reached_at
            GROUP BY e.session_id
          ),
          start_step AS (
            SELECT e.session_id, MIN(e.created_at) AS reached_at
            FROM analytics_events e
            INNER JOIN template_step prior ON prior.session_id = e.session_id
            WHERE e.event_name = 'ranking_start'
              AND e.created_at >= prior.reached_at
            GROUP BY e.session_id
          ),
          publish_step AS (
            SELECT e.session_id, MIN(e.created_at) AS reached_at
            FROM analytics_events e
            INNER JOIN start_step prior ON prior.session_id = e.session_id
            WHERE e.event_name = 'ranking_publish'
              AND e.created_at >= prior.reached_at
            GROUP BY e.session_id
          ),
          share_step AS (
            SELECT e.session_id, MIN(e.created_at) AS reached_at
            FROM analytics_events e
            INNER JOIN publish_step prior ON prior.session_id = e.session_id
            WHERE e.event_name = 'share_complete'
              AND e.created_at >= prior.reached_at
            GROUP BY e.session_id
          )
          SELECT
            (SELECT COUNT(*) FROM feed_step) AS feed_view,
            (SELECT COUNT(*) FROM template_step) AS template_view,
            (SELECT COUNT(*) FROM start_step) AS ranking_start,
            (SELECT COUNT(*) FROM publish_step) AS ranking_publish,
            (SELECT COUNT(*) FROM share_step) AS share_complete
        `).bind(periodModifier).first(),
        db.prepare(`
          WITH current_users AS (
            SELECT DISTINCT user_id
            FROM analytics_events
            WHERE user_id IS NOT NULL AND created_at >= datetime('now', ?)
          ),
          previous_users AS (
            SELECT DISTINCT user_id
            FROM analytics_events
            WHERE user_id IS NOT NULL
              AND created_at >= datetime('now', ?)
              AND created_at < datetime('now', ?)
          )
          SELECT
            (SELECT COUNT(*) FROM current_users) AS active_users,
            (SELECT COUNT(*) FROM previous_users) AS previous_users,
            (SELECT COUNT(*) FROM current_users cu
             INNER JOIN previous_users pu ON pu.user_id = cu.user_id) AS returning_users,
            (SELECT COUNT(DISTINCT session_id) FROM analytics_events
             WHERE created_at >= datetime('now', ?)) AS active_sessions
        `).bind(periodModifier, previousModifier, periodModifier, periodModifier).first(),
        db.prepare(`
          WITH RECURSIVE dates(day) AS (
            SELECT date('now', '+7 hours', ?)
            UNION ALL
            SELECT date(day, '+1 day') FROM dates
            WHERE day < date('now', '+7 hours')
          )
          SELECT dates.day,
            COUNT(DISTINCT events.session_id) AS sessions,
            COUNT(DISTINCT events.user_id) AS users
          FROM dates
          LEFT JOIN analytics_events events
            ON events.created_at >= datetime(dates.day, '-7 hours')
           AND events.created_at < datetime(dates.day, '+1 day', '-7 hours')
          GROUP BY dates.day
          ORDER BY dates.day ASC
        `).bind(dailyStartModifier).all(),
        db.prepare(`
          SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'challenge_start' THEN session_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'challenge_complete' THEN session_id END) AS completions,
            COUNT(DISTINCT CASE WHEN event_name = 'challenge_share' THEN session_id END) AS shares
          FROM analytics_events
          WHERE created_at >= datetime('now', ?)
        `).bind(periodModifier).first(),
      ]);

      const stageDefinitions = [
        ['feed_view', 'feed'],
        ['template_view', 'template'],
        ['ranking_start', 'start'],
        ['ranking_publish', 'publish'],
        ['share_complete', 'share'],
      ];
      const firstCount = Number(funnel?.feed_view) || 0;
      let previousCount = firstCount;
      const stages = stageDefinitions.map(([eventName, key], index) => {
        const count = Number(funnel?.[eventName]) || 0;
        const fromPrevious = index === 0 ? 100 : (previousCount > 0 ? Math.round((count / previousCount) * 100) : 0);
        const fromFeed = firstCount > 0 ? Math.round((count / firstCount) * 100) : 0;
        previousCount = count;
        return { key, event_name: eventName, sessions: count, from_previous: fromPrevious, from_feed: fromFeed };
      });

      const previousUsers = Number(activity?.previous_users) || 0;
      const returningUsers = Number(activity?.returning_users) || 0;
      return jsonResponse({
        success: true,
        data: {
          period_days: days,
          timezone: 'Asia/Bangkok',
          funnel: stages,
          activity: {
            active_sessions: Number(activity?.active_sessions) || 0,
            active_users: Number(activity?.active_users) || 0,
            previous_users: previousUsers,
            returning_users: returningUsers,
            return_rate: previousUsers > 0 ? Math.round((returningUsers / previousUsers) * 100) : 0,
          },
          challenge: {
            starts: Number(challenge?.starts) || 0,
            completions: Number(challenge?.completions) || 0,
            shares: Number(challenge?.shares) || 0,
          },
          daily_activity: (dailyRows?.results || []).map((row) => ({
            day: row.day,
            sessions: Number(row.sessions) || 0,
            users: Number(row.users) || 0,
          })),
        }
      });
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin analytics');
    }
  }

  return jsonResponse({ success: false, error: 'Invalid action' }, 400);
}
