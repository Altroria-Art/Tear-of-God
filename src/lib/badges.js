// A4: badge catalog — thresholds ตรงกับ functions/api/users.js buildTasteIdentity เป๊ะ:
// first_rank: rankingCount>=1 / ranker_10: >=10 / template_creator: templateCount>=1 /
// community_voice: followerCount>=5 / template_hit: maxTemplateUses>=25
// Pure, ไม่มี I/O — progress ใช้เฉพาะตัวเลขที่ endpoint ส่งมาแล้ว (posts_count,
// followers_count, badge values) ไม่เพิ่ม D1 request ใดๆ
export const BADGE_CATALOG = [
  { id: 'first_rank', need: 1, unit: 'rankings' },
  { id: 'ranker_10', need: 10, unit: 'rankings' },
  { id: 'template_creator', need: 1, unit: 'templates' },
  { id: 'community_voice', need: 5, unit: 'followers' },
  { id: 'template_hit', need: 25, unit: 'uses' },
];

// unlockedIds = badge ids ที่ backend ส่งมา (ปลดแล้วจริง); progress นับจาก counts ที่มี
// (maxTemplateUses เป็น null ตอน template_hit ยังล็อก → แสดง requirement อย่างเดียว)
export function getBadgeStates({
  rankingCount = 0,
  templateCount = 0,
  followerCount = 0,
  maxTemplateUses = null,
  unlockedIds = [],
} = {}) {
  const unlocked = new Set(unlockedIds);
  const current = {
    rankings: rankingCount,
    templates: templateCount,
    followers: followerCount,
    uses: maxTemplateUses,
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
