// Shared badge helper for serverless functions (Cloudflare Workers runtime)
// Thresholds match src/lib/badges.js BADGE_CATALOG and historical functions/api/users.js exactly:
// first_rank: rankingCount>=1 / ranker_10: >=10 / ranking_veteran: >=50 /
// template_creator: templateCount>=1 / template_builder: >=5 /
// community_voice: followerCount>=5 / community_star: >=25 /
// template_hit: maxTemplateUses>=25 / trending_template: >=100 /
// template_legend: maxTemplateUses>=500 /
// all_rounder: rankingCount>=10 && templateCount>=5 && followerCount>=10
// Generic hashtag badges (contributions = distinct user rankings + distinct user templates with tag):
// hashtag_enthusiast: >=10 / hashtag_specialist: >=50 / hashtag_master: >=100

export const HASHTAG_BADGE_THRESHOLDS = {
  hashtag_enthusiast: 10,
  hashtag_specialist: 50,
  hashtag_master: 100,
};

export const HASHTAG_BADGE_IDS = new Set(Object.keys(HASHTAG_BADGE_THRESHOLDS));

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
  'template_legend',
  'all_rounder',
  'hashtag_enthusiast',
  'hashtag_specialist',
  'hashtag_master',
]);

export function normalizeHashtag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  return tag.trim().replace(/^#+/, '').trim().toLowerCase();
}

export function parseEquippedBadgeMeta(raw) {
  if (!raw) return null;
  if (typeof raw === 'string' && raw.length > 500) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const rawTag = parsed.hashtag;
    if (typeof rawTag !== 'string' || !rawTag.trim()) return null;
    const clean = rawTag.trim().replace(/^#+/, '').trim();
    if (!clean || clean.length > 50) return null;
    return { hashtag: `#${clean}` };
  } catch {
    return null;
  }
}

export function isBadgeUnlocked(badgeId, {
  rankingCount = 0,
  followerCount = 0,
  templateCount = 0,
  maxTemplateUses = 0,
  topHashtagCount = 0,
} = {}) {
  const r = Number(rankingCount) || 0;
  const f = Number(followerCount) || 0;
  const t = Number(templateCount) || 0;
  const u = Number(maxTemplateUses) || 0;
  const h = Number(topHashtagCount) || 0;

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
    case 'template_legend':
      return u >= 500;
    case 'all_rounder':
      return r >= 10 && t >= 5 && f >= 10;
    case 'hashtag_enthusiast':
      return h >= 10;
    case 'hashtag_specialist':
      return h >= 50;
    case 'hashtag_master':
      return h >= 100;
    default:
      return false;
  }
}

export function calculateUnlockedBadges({
  rankingCount = 0,
  followerCount = 0,
  templateCount = 0,
  maxTemplateUses = 0,
  topHashtag = null,
} = {}) {
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
  if (u >= 500) badges.push({ id: 'template_legend', value: u });
  if (r >= 10 && t >= 5 && f >= 10) {
    badges.push({ id: 'all_rounder', value: 3 });
  }

  if (topHashtag && topHashtag.hashtag) {
    const hCount = Number(topHashtag.count) || 0;
    const cleanTag = String(topHashtag.hashtag).trim().replace(/^#+/, '').trim();
    const tag = cleanTag ? `#${cleanTag}` : '';
    if (tag && hCount >= 10) badges.push({ id: 'hashtag_enthusiast', hashtag: tag, value: hCount });
    if (tag && hCount >= 50) badges.push({ id: 'hashtag_specialist', hashtag: tag, value: hCount });
    if (tag && hCount >= 100) badges.push({ id: 'hashtag_master', hashtag: tag, value: hCount });
  }

  return badges;
}

export async function checkUserBadgeUnlocked(db, userId, badgeId, meta = null) {
  if (!VALID_BADGE_IDS.has(badgeId)) return false;

  if (HASHTAG_BADGE_IDS.has(badgeId)) {
    const parsed = parseEquippedBadgeMeta(meta);
    if (!parsed?.hashtag) return false;
    const normTag = normalizeHashtag(parsed.hashtag);
    if (!normTag) return false;

    const topRow = await db.prepare(`
      SELECT hashtag, COUNT(*) AS count
      FROM (
        SELECT ranking_id AS id, hashtag FROM ranking_hashtags WHERE user_id = ?
        UNION ALL
        SELECT template_id AS id, hashtag FROM template_hashtags WHERE creator_id = ?
      )
      GROUP BY hashtag
      ORDER BY count DESC, hashtag ASC
      LIMIT 1
    `).bind(userId, userId).first();

    if (!topRow || topRow.hashtag !== normTag) return false;
    const count = Number(topRow.count) || 0;
    return count >= HASHTAG_BADGE_THRESHOLDS[badgeId];
  }

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

export async function validateAndResolveEquipBadge(db, userId, badgeId, rawMeta) {
  if (badgeId === null || badgeId === undefined || badgeId === '') {
    return { valid: true, badgeId: null, metaString: null, metaObj: null };
  }
  if (typeof badgeId !== 'string' || !VALID_BADGE_IDS.has(badgeId)) {
    return { valid: false, code: 'INVALID_BADGE', error: 'ป้ายไม่ถูกต้อง / Invalid badge ID', status: 400 };
  }

  if (HASHTAG_BADGE_IDS.has(badgeId)) {
    const parsedMeta = parseEquippedBadgeMeta(rawMeta);
    if (!parsedMeta || !parsedMeta.hashtag) {
      return { valid: false, code: 'BADGE_NOT_UNLOCKED', error: 'ป้ายนี้ยังไม่ถูกปลดล็อก / Badge is not unlocked', status: 403 };
    }
    const cleanTag = parsedMeta.hashtag.replace(/^#+/, '').trim();
    const normTag = cleanTag.toLowerCase();

    // Query user's top hashtag (per product requirement: identity achievement is based on Top Hashtag)
    const topRow = await db.prepare(`
      SELECT hashtag, COUNT(*) AS count
      FROM (
        SELECT ranking_id AS id, hashtag FROM ranking_hashtags WHERE user_id = ?
        UNION ALL
        SELECT template_id AS id, hashtag FROM template_hashtags WHERE creator_id = ?
      )
      GROUP BY hashtag
      ORDER BY count DESC, hashtag ASC
      LIMIT 1
    `).bind(userId, userId).first();

    if (!topRow || topRow.hashtag !== normTag) {
      return { valid: false, code: 'BADGE_NOT_UNLOCKED', error: 'ป้ายนี้ยังไม่ถูกปลดล็อก / Badge is not unlocked', status: 403 };
    }

    const count = Number(topRow.count) || 0;
    const threshold = HASHTAG_BADGE_THRESHOLDS[badgeId];
    if (count < threshold) {
      return { valid: false, code: 'BADGE_NOT_UNLOCKED', error: 'ป้ายนี้ยังไม่ถูกปลดล็อก / Badge is not unlocked', status: 403 };
    }

    const metaObj = { hashtag: `#${cleanTag}` };
    return { valid: true, badgeId, metaString: JSON.stringify(metaObj), metaObj };
  }

  // Non-hashtag badges
  const unlocked = await checkUserBadgeUnlocked(db, userId, badgeId);
  if (!unlocked) {
    return { valid: false, code: 'BADGE_NOT_UNLOCKED', error: 'ป้ายนี้ยังไม่ถูกปลดล็อก / Badge is not unlocked', status: 403 };
  }
  return { valid: true, badgeId, metaString: null, metaObj: null };
}
