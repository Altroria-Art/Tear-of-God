// A4: badge catalog — thresholds ตรงกับ functions/api/users.js buildTasteIdentity เป๊ะ:
// first_rank: rankingCount>=1 / ranker_10: >=10 / ranking_veteran: >=50 /
// template_creator: templateCount>=1 / template_builder: >=5 /
// community_voice: followerCount>=5 / community_star: >=25 /
// template_hit: maxTemplateUses>=25 / trending_template: >=100 /
// all_rounder: rankingCount>=10 && templateCount>=5 && followerCount>=10
// Pure, ไม่มี I/O — progress ใช้เฉพาะตัวเลขที่ endpoint ส่งมาแล้ว (posts_count,
// followers_count, templateStats) ไม่เพิ่ม D1 request ใดๆ
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
  { id: 'all_rounder', need: 3, unit: 'all_rounder' },
];

// unlockedIds = badge ids ที่ backend ส่งมา (ปลดแล้วจริง); progress นับจาก counts ที่มี
export function getBadgeStates({
  rankingCount = 0,
  templateCount = 0,
  followerCount = 0,
  maxTemplateUses = null,
  unlockedIds = [],
} = {}) {
  const unlocked = new Set(unlockedIds);
  const allRounderProgress =
    (rankingCount >= 10 ? 1 : 0) +
    (templateCount >= 5 ? 1 : 0) +
    (followerCount >= 10 ? 1 : 0);

  const current = {
    rankings: rankingCount,
    templates: templateCount,
    followers: followerCount,
    uses: maxTemplateUses,
    all_rounder: allRounderProgress,
  };
  return BADGE_CATALOG.map((badge) => {
    const value = current[badge.unit];
    return {
      id: badge.id,
      need: badge.need,
      unlocked: unlocked.has(badge.id),
      progress: typeof value === 'number' ? Math.min(Math.max(0, value), badge.need) : null,
    };
  });
}
