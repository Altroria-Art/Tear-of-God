// Shared badge helper for serverless functions (Cloudflare Workers runtime)
// Thresholds match src/lib/badges.js BADGE_CATALOG and historical functions/api/users.js exactly:
// first_rank: rankingCount>=1 / ranker_10: >=10 / ranking_veteran: >=50 /
// template_creator: templateCount>=1 / template_builder: >=5 /
// community_voice: followerCount>=5 / community_star: >=25 /
// template_hit: maxTemplateUses>=25 / trending_template: >=100 /
// all_rounder: rankingCount>=10 && templateCount>=5 && followerCount>=10

export const VALID_BADGE_IDS = new Set([
  'first_rank',
  'ranker_10',
  'ranking_veteran',
  'template_creator',
  'template_builder',
  'community_voice',
  'community_star',
  'template_hit',
  'trending_template',
  'all_rounder',
]);

export function isBadgeUnlocked(badgeId, { rankingCount = 0, followerCount = 0, templateCount = 0, maxTemplateUses = 0 } = {}) {
  const r = Number(rankingCount) || 0;
  const f = Number(followerCount) || 0;
  const t = Number(templateCount) || 0;
  const u = Number(maxTemplateUses) || 0;

  switch (badgeId) {
    case 'first_rank':
      return r >= 1;
    case 'ranker_10':
      return r >= 10;
    case 'ranking_veteran':
      return r >= 50;
    case 'template_creator':
      return t >= 1;
    case 'template_builder':
      return t >= 5;
    case 'community_voice':
      return f >= 5;
    case 'community_star':
      return f >= 25;
    case 'template_hit':
      return u >= 25;
    case 'trending_template':
      return u >= 100;
    case 'all_rounder':
      return r >= 10 && t >= 5 && f >= 10;
    default:
      return false;
  }
}

export function calculateUnlockedBadges({ rankingCount = 0, followerCount = 0, templateCount = 0, maxTemplateUses = 0 } = {}) {
  const r = Number(rankingCount) || 0;
  const f = Number(followerCount) || 0;
  const t = Number(templateCount) || 0;
  const u = Number(maxTemplateUses) || 0;

  const badges = [];
  if (r >= 1) badges.push({ id: 'first_rank', value: r });
  if (r >= 10) badges.push({ id: 'ranker_10', value: r });
  if (r >= 50) badges.push({ id: 'ranking_veteran', value: r });
  if (t >= 1) badges.push({ id: 'template_creator', value: t });
  if (t >= 5) badges.push({ id: 'template_builder', value: t });
  if (f >= 5) badges.push({ id: 'community_voice', value: f });
  if (f >= 25) badges.push({ id: 'community_star', value: f });
  if (u >= 25) badges.push({ id: 'template_hit', value: u });
  if (u >= 100) badges.push({ id: 'trending_template', value: u });
  if (r >= 10 && t >= 5 && f >= 10) {
    badges.push({ id: 'all_rounder', value: 3 });
  }
  return badges;
}

export async function checkUserBadgeUnlocked(db, userId, badgeId) {
  if (!VALID_BADGE_IDS.has(badgeId)) return false;

  const stats = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM rankings WHERE user_id = ?) as posts_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers_count,
      (SELECT COUNT(*) FROM templates WHERE creator_id = ?) as template_count,
      (SELECT COALESCE(MAX(use_count), 0) FROM templates WHERE creator_id = ?) as max_template_uses
  `).bind(userId, userId, userId, userId).first();

  return isBadgeUnlocked(badgeId, {
    rankingCount: stats?.posts_count,
    followerCount: stats?.followers_count,
    templateCount: stats?.template_count,
    maxTemplateUses: stats?.max_template_uses,
  });
}
