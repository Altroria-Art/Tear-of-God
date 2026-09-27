// A4 & Task 5: badge catalog — thresholds ตรงกับ functions/lib/badges.js และ users.js เป๊ะ:
// first_rank: rankingCount>=1 / ranker_10: >=10 / ranking_veteran: >=50 /
// template_creator: templateCount>=1 / template_builder: >=5 /
// community_voice: followerCount>=5 / community_star: >=25 /
// template_hit: maxTemplateUses>=25 / trending_template: >=100 /
// template_legend: maxTemplateUses>=500 /
// all_rounder: rankingCount>=10 && templateCount>=5 && followerCount>=10
// Generic hashtag badges (contributions = user rankings + user templates with tag):
// hashtag_enthusiast: >=10 / hashtag_specialist: >=50 / hashtag_master: >=100

export const BADGE_CATALOG = [
  { id: 'first_rank', need: 1, unit: 'rankings' },
  { id: 'ranker_10', need: 10, unit: 'rankings' },
  { id: 'ranking_veteran', need: 50, unit: 'rankings' },
  { id: 'template_creator', need: 1, unit: 'templates' },
  { id: 'template_builder', need: 5, unit: 'templates' },
  { id: 'community_voice', need: 5, unit: 'followers' },
  { id: 'community_star', need: 25, unit: 'followers' },
  { id: 'template_hit', need: 25, unit: 'uses' },
  { id: 'trending_template', need: 100, unit: 'uses' },
  { id: 'template_legend', need: 500, unit: 'uses' },
  { id: 'all_rounder', need: 3, unit: 'all_rounder' },
  { id: 'hashtag_enthusiast', need: 10, unit: 'hashtag' },
  { id: 'hashtag_specialist', need: 50, unit: 'hashtag' },
  { id: 'hashtag_master', need: 100, unit: 'hashtag' },
];

// unlockedIds/unlockedBadges = badges ที่ backend ส่งมา (ปลดแล้วจริง); progress นับจาก counts ที่มี
export function getBadgeStates({
  rankingCount = 0,
  templateCount = 0,
  followerCount = 0,
  maxTemplateUses = null,
  topHashtag = null,
  unlockedBadges = [],
  unlockedIds = [],
} = {}) {
  const unlocked = new Set([
    ...unlockedIds,
    ...unlockedBadges.map((b) => b.id),
  ]);
  const allRounderProgress =
    (rankingCount >= 10 ? 1 : 0) +
    (templateCount >= 5 ? 1 : 0) +
    (followerCount >= 10 ? 1 : 0);

  const topTagBadge = unlockedBadges.find((b) => b.hashtag);
  const effectiveTag = topHashtag?.hashtag || topTagBadge?.hashtag || null;
  const effectiveTagCount = typeof topHashtag?.count === 'number'
    ? topHashtag.count
    : (typeof topTagBadge?.value === 'number' ? topTagBadge.value : 0);

  const cleanTag = effectiveTag ? String(effectiveTag).trim().replace(/^#+/, '').trim() : '';
  const formattedTag = cleanTag ? `#${cleanTag}` : null;

  const current = {
    rankings: rankingCount,
    templates: templateCount,
    followers: followerCount,
    uses: maxTemplateUses,
    all_rounder: allRounderProgress,
    hashtag: effectiveTagCount,
  };

  return BADGE_CATALOG.map((badge) => {
    const value = current[badge.unit];
    const isHashtagBadge = badge.unit === 'hashtag';
    return {
      id: badge.id,
      need: badge.need,
      unlocked: unlocked.has(badge.id),
      progress: typeof value === 'number' ? Math.min(Math.max(0, value), badge.need) : null,
      hashtag: isHashtagBadge ? formattedTag : null,
    };
  });
}
