const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 40;
const RANKING_SPOTLIGHT_LIMIT = 6;

function parseTiers(raw) {
  if (!raw) return [];
  try {
    const tiers = JSON.parse(raw);
    return Array.isArray(tiers) ? tiers : [];
  } catch {
    return [];
  }
}

function dateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBangkokPeriods(now = new Date()) {
  // Shift once, then use UTC getters as Bangkok calendar fields. This avoids
  // relying on the Workers host timezone while keeping every rollover at midnight Asia/Bangkok.
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkokNow.getUTCFullYear();
  const month = bangkokNow.getUTCMonth();
  const day = bangkokNow.getUTCDate();
  const mondayOffset = (bangkokNow.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, month, day - mondayOffset));

  return {
    daily: {
      key: dateKey(bangkokNow),
      endsAt: new Date(Date.UTC(year, month, day + 1) - BANGKOK_OFFSET_MS).toISOString()
    },
    weekly: {
      key: dateKey(monday),
      endsAt: new Date(Date.UTC(year, month, day + (7 - mondayOffset)) - BANGKOK_OFFSET_MS).toISOString()
    }
  };
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function chooseTemplate(candidates, periodKey, excludedId = null) {
  const eligible = candidates.filter((candidate) => candidate.id !== excludedId);
  const pool = eligible.length > 0 ? eligible : candidates;
  return [...pool].sort((left, right) => {
    const scoreDiff = hash(`${periodKey}:${left.id}`) - hash(`${periodKey}:${right.id}`);
    return scoreDiff || String(left.id).localeCompare(String(right.id));
  })[0] || null;
}

function getSeasonalProfile(now = new Date()) {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const month = bangkokNow.getUTCMonth() + 1;
  const profiles = {
    1: { key: 'newYear', keywords: ['new year', 'newyear', 'ปีใหม่'] },
    2: { key: 'valentines', keywords: ['love', 'valentine', 'ความรัก'] },
    3: { key: 'summer', keywords: ['summer', 'ซัมเมอร์', 'หน้าร้อน'] },
    4: { key: 'songkran', keywords: ['songkran', 'สงกรานต์'] },
    5: { key: 'summer', keywords: ['summer', 'ซัมเมอร์', 'หน้าร้อน'] },
    6: { key: 'backToSchool', keywords: ['school', 'มหาวิทยาลัย', 'เปิดเทอม'] },
    7: { key: 'rainySeason', keywords: ['rain', 'ฝน', 'หน้าฝน'] },
    8: { key: 'backToSchool', keywords: ['school', 'มหาวิทยาลัย', 'เปิดเทอม'] },
    9: { key: 'rainySeason', keywords: ['rain', 'ฝน', 'หน้าฝน'] },
    10: { key: 'halloween', keywords: ['halloween', 'ฮาโลวีน', 'horror'] },
    11: { key: 'loyKrathong', keywords: ['loy krathong', 'ลอยกระทง'] },
    12: { key: 'yearEnd', keywords: ['year', 'ส่งท้ายปี', 'แห่งปี'] },
  };
  return { ...profiles[month], month };
}

function serializeTemplate(template, itemsMap) {
  if (!template) return null;
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    hashtags: template.hashtags,
    tiers: parseTiers(template.tiers),
    use_count: Number(template.live_uses) || 0,
    view_count: Number(template.live_views) || 0,
    item_count: Number(template.item_count) || 0,
    profile: {
      id: template.creator_id,
      username: template.username,
      avatar_url: template.avatar_url
    },
    template_items: itemsMap[template.id] || []
  };
}

function serializeRanking(row) {
  const likes = Number(row.likes_count) || 0;
  const dislikes = Number(row.dislikes_count) || 0;
  const comments = Number(row.comments_count) || 0;
  const voteTotal = likes + dislikes;
  const disagreement = voteTotal > 0
    ? Math.round((1 - Math.abs(likes - dislikes) / voteTotal) * 100)
    : 0;

  return {
    id: row.id,
    title: row.title || 'Untitled ranking',
    category: row.category || 'general',
    template_id: row.template_id || null,
    template_title: row.template_title || null,
    created_at: row.created_at || null,
    profile: {
      id: row.user_id,
      username: row.username || 'Unknown',
      avatar_url: row.avatar_url || null,
    },
    stats: { likes, dislikes, comments },
    disagreement,
  };
}

const RANKING_SELECT = `
  SELECT r.id, r.title, r.category, r.template_id, r.created_at,
         r.likes_count, r.dislikes_count, r.comments_count,
         p.id AS user_id, p.username, p.avatar_url,
         t.title AS template_title
  FROM rankings r
  LEFT JOIN profiles p ON p.id = r.user_id
  LEFT JOIN templates t ON t.id = r.template_id
`;

async function loadTemplateItems(db, templates) {
  const selectedIds = [...new Set((templates || []).map((template) => template?.id).filter(Boolean))];
  const itemsMap = {};
  if (selectedIds.length === 0) return itemsMap;

  const placeholders = selectedIds.map(() => '?').join(',');
  const { results: previewItems } = await db.prepare(`
    SELECT ti.template_id, ti.item_id, ti.position, i.name AS item_name, i.image_url AS item_image
    FROM template_items ti
    LEFT JOIN items i ON (ti.item_id = i.id OR ti.item_id = i.name)
    WHERE ti.template_id IN (${placeholders}) AND ti.position < 4
    ORDER BY ti.template_id, ti.position ASC
  `).bind(...selectedIds).all();

  (previewItems || []).forEach((item) => {
    if (!itemsMap[item.template_id]) itemsMap[item.template_id] = [];
    itemsMap[item.template_id].push({
      item_id: item.item_id,
      position: item.position,
      item: {
        id: item.item_id,
        name: item.item_name || item.item_id,
        image_url: item.item_image || null
      }
    });
  });
  return itemsMap;
}

export async function onRequestGet({ env }) {
  const db = env.tear_of_god_db;

  try {
    const periods = getBangkokPeriods();
    const seasonal = getSeasonalProfile();
    const seasonalConditions = seasonal.keywords.map(() => '(lower(t.title) LIKE ? OR instr(lower(replace(COALESCE(t.hashtags, \'\'), \'#\', \'\')), ?) > 0)').join(' OR ');
    const seasonalParams = seasonal.keywords.flatMap((keyword) => [`%${keyword.toLowerCase()}%`, keyword.toLowerCase()]);
    const [
      candidatesResult,
      hot24Result,
      recentResult,
      debateResult,
      splitResult,
      seasonalResult,
      officialResult,
    ] = await Promise.all([
      db.prepare(`
        SELECT t.*, p.username, p.avatar_url,
          (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
          (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
        FROM templates t
        LEFT JOIN profiles p ON p.id = t.creator_id
        WHERE EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id)
        ORDER BY live_uses DESC, live_views DESC, t.created_at DESC, t.id DESC
        LIMIT ?
      `).bind(CANDIDATE_LIMIT).all(),
      db.prepare(`${RANKING_SELECT}
        WHERE r.created_at >= datetime('now', '-1 day')
        ORDER BY (COALESCE(r.likes_count, 0) * 3 + COALESCE(r.comments_count, 0) * 2 - COALESCE(r.dislikes_count, 0)) DESC,
                 r.created_at DESC, r.id DESC
        LIMIT ?`).bind(RANKING_SPOTLIGHT_LIMIT).all(),
      db.prepare(`${RANKING_SELECT}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ?`).bind(RANKING_SPOTLIGHT_LIMIT).all(),
      db.prepare(`${RANKING_SELECT}
        WHERE r.created_at >= datetime('now', '-30 days')
          AND COALESCE(r.comments_count, 0) > 0
        ORDER BY COALESCE(r.comments_count, 0) DESC,
                 (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) DESC,
                 r.created_at DESC, r.id DESC
        LIMIT ?`).bind(RANKING_SPOTLIGHT_LIMIT).all(),
      db.prepare(`${RANKING_SELECT}
        WHERE (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) >= 3
          AND ABS(COALESCE(r.likes_count, 0) - COALESCE(r.dislikes_count, 0)) <= MAX(1, (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) * 0.35)
        ORDER BY (COALESCE(r.likes_count, 0) + COALESCE(r.dislikes_count, 0)) DESC,
                 r.created_at DESC, r.id DESC
        LIMIT ?`).bind(RANKING_SPOTLIGHT_LIMIT).all(),
      db.prepare(`
        SELECT t.*, p.username, p.avatar_url,
          (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
          (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
        FROM templates t
        LEFT JOIN profiles p ON p.id = t.creator_id
        WHERE EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id)
          AND (${seasonalConditions})
        ORDER BY live_uses DESC, t.created_at DESC, t.id DESC
        LIMIT 4
      `).bind(...seasonalParams).all(),
      db.prepare(`
        SELECT t.*, p.username, p.avatar_url,
          (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
          (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
        FROM templates t
        JOIN profiles p ON p.id = t.creator_id
        WHERE p.role = 'admin'
          AND EXISTS (SELECT 1 FROM template_items ti WHERE ti.template_id = t.id)
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 4
      `).all(),
    ]);

    const candidates = candidatesResult?.results || [];
    const dailyTemplate = chooseTemplate(candidates, `daily:${periods.daily.key}`);
    const weeklyTemplate = chooseTemplate(candidates, `weekly:${periods.weekly.key}`, dailyTemplate?.id);
    const seasonalTemplates = seasonalResult?.results || [];
    const officialTemplates = officialResult?.results || [];
    const allTemplates = [dailyTemplate, weeklyTemplate, ...seasonalTemplates, ...officialTemplates].filter(Boolean);
    const itemsMap = await loadTemplateItems(db, allTemplates);

    return Response.json({
      success: true,
      data: {
        timezone: 'Asia/Bangkok',
        daily: {
          period_key: periods.daily.key,
          ends_at: periods.daily.endsAt,
          template: serializeTemplate(dailyTemplate, itemsMap)
        },
        weekly: {
          period_key: periods.weekly.key,
          ends_at: periods.weekly.endsAt,
          template: serializeTemplate(weeklyTemplate, itemsMap)
        },
        freshness: {
          hot24: (hot24Result?.results || []).map(serializeRanking),
          recent: (recentResult?.results || []).map(serializeRanking),
          debate: (debateResult?.results || []).map(serializeRanking),
          split: (splitResult?.results || []).map(serializeRanking),
        },
        seasonal: {
          key: seasonal.key,
          month: seasonal.month,
          templates: seasonalTemplates.map((template) => serializeTemplate(template, itemsMap)),
        },
        official: officialTemplates.map((template) => serializeTemplate(template, itemsMap)),
      }
    }, {
      headers: { 'Cache-Control': 'public, max-age=120' }
    });
  } catch (error) {
    console.error('Spotlight query failed:', { name: error?.name, message: error?.message });
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

