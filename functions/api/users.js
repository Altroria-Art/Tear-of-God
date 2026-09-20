// Public profile endpoint. The response intentionally contains no email/password,
// and now includes a small, query-time Taste Identity built from real activity.
import { internalErrorResponse } from '../lib/request-guard.js';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function parseTags(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 0;
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

async function collectTaste(db, userId) {
  const [{ results: templateRows }, { results: tagRows }] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT template_id
      FROM rankings
      WHERE user_id = ? AND template_id IS NOT NULL AND template_id != ''
    `).bind(userId).all(),
    db.prepare(`
      SELECT hashtags FROM rankings WHERE user_id = ?
      UNION ALL
      SELECT hashtags FROM templates WHERE creator_id = ?
    `).bind(userId, userId).all(),
  ]);

  return {
    templates: new Set((templateRows || []).map((row) => String(row.template_id || '')).filter(Boolean)),
    hashtags: new Set((tagRows || []).flatMap((row) => parseTags(row.hashtags))),
  };
}

async function findSimilarUsers(db, userId, targetTaste) {
  const hashtagKeys = [...targetTaste.hashtags].slice(0, 12);
  if (hashtagKeys.length === 0) return [];

  const placeholders = hashtagKeys.map(() => '?').join(',');
  const { results: candidateRows } = await db.prepare(`
    SELECT DISTINCT p.id, p.username, p.avatar_url
    FROM profiles p
    JOIN rankings r ON r.user_id = p.id
    WHERE p.id != ?
      AND EXISTS (SELECT 1 FROM ranking_hashtags rh WHERE rh.ranking_id = r.id AND rh.hashtag IN (${placeholders}))
    GROUP BY p.id, p.username, p.avatar_url
    ORDER BY COUNT(*) DESC, p.username ASC
    LIMIT 60
  `).bind(userId, ...hashtagKeys).all();
  if (!candidateRows?.length) return [];

  const candidateIds = candidateRows.map((row) => row.id);
  const candidatePlaceholders = candidateIds.map(() => '?').join(',');
  const [templateResult, tagResult] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT user_id, template_id
      FROM rankings
      WHERE user_id IN (${candidatePlaceholders}) AND template_id IS NOT NULL AND template_id != ''
    `).bind(...candidateIds).all(),
    db.prepare(`
      SELECT user_id, hashtags FROM rankings WHERE user_id IN (${candidatePlaceholders})
      UNION ALL
      SELECT creator_id AS user_id, hashtags FROM templates WHERE creator_id IN (${candidatePlaceholders})
    `).bind(...candidateIds, ...candidateIds).all(),
  ]);

  const tastes = new Map(candidateIds.map((id) => [id, {
    templates: new Set(),
    hashtags: new Set(),
  }]));
  (templateResult.results || []).forEach((row) => {
    if (row.template_id) tastes.get(row.user_id)?.templates.add(String(row.template_id));
  });
  (tagResult.results || []).forEach((row) => {
    parseTags(row.hashtags).forEach((tag) => tastes.get(row.user_id)?.hashtags.add(tag));
  });

  return candidateRows.map((candidate) => {
    const taste = tastes.get(candidate.id);
    const templateScore = jaccard(targetTaste.templates, taste.templates);
    const hashtagScore = jaccard(targetTaste.hashtags, taste.hashtags);
    return {
      id: candidate.id,
      username: candidate.username || 'Unknown',
      avatar_url: candidate.avatar_url || null,
      score: Math.round((templateScore * 0.3 + hashtagScore * 0.7) * 100),
    };
  }).sort((left, right) => right.score - left.score || left.username.localeCompare(right.username)).slice(0, 3);
}

async function buildTasteIdentity(db, userId, baseUser) {
  const [hashtagResult, topScoreResult, pinnedResult, templateStats] = await Promise.all([
    db.prepare(`
      SELECT hashtag, COUNT(*) AS count
      FROM ranking_hashtags
      WHERE user_id = ?
      GROUP BY hashtag
      ORDER BY count DESC, hashtag ASC
    `).bind(userId).all(),
    db.prepare(`
      SELECT ris.item_id, COALESCE(i.name, ris.item_id) AS name, COUNT(*) AS count
      FROM ranking_item_scores ris
      JOIN rankings r ON r.id = ris.ranking_id
      LEFT JOIN items i ON (i.id = ris.item_id OR i.name = ris.item_id)
      WHERE r.user_id = ? AND ris.tier_index = 0
      GROUP BY ris.item_id, COALESCE(i.name, ris.item_id)
      ORDER BY count DESC, name ASC
      LIMIT 8
    `).bind(userId).all(),
    db.prepare(`
      SELECT p.ranking_id, p.position, p.created_at,
             r.title, r.description, r.hashtags, r.template_id,
             r.likes_count, r.dislikes_count, r.comments_count, r.created_at AS ranking_created_at
      FROM profile_pins p
      JOIN rankings r ON r.id = p.ranking_id
      WHERE p.user_id = ?
      ORDER BY p.position ASC, p.created_at DESC
      LIMIT 3
    `).bind(userId).all(),
    db.prepare(`
      SELECT COUNT(*) AS template_count, COALESCE(MAX(use_count), 0) AS max_template_uses
      FROM templates
      WHERE creator_id = ?
    `).bind(userId).first(),
  ]);

  const hashtags = (hashtagResult?.results || []).map((row) => ({
    hashtag: row.hashtag,
    count: toNumber(row.count),
  }));
  const totalHashtagRanks = hashtags.reduce((sum, row) => sum + row.count, 0);

  let topItemRows = topScoreResult?.results || [];
  // Older rankings may predate ranking_item_scores. Fall back to the first tier
  // defined by the template so those users still get a useful identity card.
  // Proven skip: the fallback joins rankings filtered by this user, so when the
  // profile count above already shows zero rankings it can only return []
  // — identical output with one fewer query.
  if (topItemRows.length === 0 && toNumber(baseUser.posts_count) > 0) {
    const fallback = await db.prepare(`
      SELECT ri.item_id, COALESCE(i.name, ri.item_id) AS name, COUNT(*) AS count
      FROM ranking_items ri
      JOIN rankings r ON r.id = ri.ranking_id
      LEFT JOIN templates t ON t.id = r.template_id
      LEFT JOIN items i ON (i.id = ri.item_id OR i.name = ri.item_id)
      WHERE r.user_id = ?
        AND lower(ri.tier) = lower(CASE
          WHEN json_valid(t.tiers) = 1 THEN COALESCE(json_extract(t.tiers, '$[0].label'), 'S')
          ELSE 'S'
        END)
      GROUP BY ri.item_id, COALESCE(i.name, ri.item_id)
      ORDER BY count DESC, name ASC
      LIMIT 8
    `).bind(userId).all();
    topItemRows = fallback?.results || [];
  }

  const hashtagDistribution = hashtags.map((row) => ({
    ...row,
    percentage: totalHashtagRanks ? Math.round((row.count / totalHashtagRanks) * 100) : 0,
  }));

  const rankingCount = toNumber(baseUser.posts_count);
  const followerCount = toNumber(baseUser.followers_count);
  const templateCount = toNumber(templateStats?.template_count);
  const maxTemplateUses = toNumber(templateStats?.max_template_uses);
  const badges = [];
  if (rankingCount >= 1) badges.push({ id: 'first_rank', value: rankingCount });
  if (rankingCount >= 10) badges.push({ id: 'ranker_10', value: rankingCount });
  if (rankingCount >= 50) badges.push({ id: 'ranking_veteran', value: rankingCount });
  if (templateCount >= 1) badges.push({ id: 'template_creator', value: templateCount });
  if (templateCount >= 5) badges.push({ id: 'template_builder', value: templateCount });
  if (followerCount >= 5) badges.push({ id: 'community_voice', value: followerCount });
  if (followerCount >= 25) badges.push({ id: 'community_star', value: followerCount });
  if (maxTemplateUses >= 25) badges.push({ id: 'template_hit', value: maxTemplateUses });
  if (maxTemplateUses >= 100) badges.push({ id: 'trending_template', value: maxTemplateUses });
  if (rankingCount >= 10 && templateCount >= 5 && followerCount >= 10) {
    badges.push({ id: 'all_rounder', value: 3 });
  }

  return {
    hashtag_distribution: hashtagDistribution,
    top_items: topItemRows.map((row) => ({
      id: row.item_id,
      name: row.name || row.item_id,
      count: toNumber(row.count),
    })),
    pinned_rankings: (pinnedResult?.results || []).map((row) => ({
      id: row.ranking_id,
      ranking_id: row.ranking_id,
      position: toNumber(row.position),
      title: row.title || 'Untitled ranking',
      description: row.description || null,
      hashtags: row.hashtags || '',
      template_id: row.template_id || null,
      stats: {
        likes: toNumber(row.likes_count),
        dislikes: toNumber(row.dislikes_count),
        comments: toNumber(row.comments_count),
      },
      created_at: row.ranking_created_at || row.created_at || null,
    })),
    badges,
    template_count: templateCount,
    max_template_uses: maxTemplateUses,
    // Similar users + viewer match are fetched on demand via ?fields=similar
    // (Taste Details modal) — never computed in the core profile request.
    taste_match: null,
    similar_users: null,
  };
}

// Lazy section for the Taste Details modal: same Jaccard formula, weights,
// candidate cap, sort, tie-break and legacy fallback as before — only the
// timing changed (explicit open instead of every profile view). Viewer always
// comes from the verified session, never from a client parameter.
async function buildSimilarSection(db, userId, viewerId) {
  const targetTaste = await collectTaste(db, userId);
  const similarUsers = await findSimilarUsers(db, userId, targetTaste);
  let tasteMatch = null;
  if (viewerId && viewerId !== userId) {
    const viewerTaste = await collectTaste(db, viewerId);
    const templateScore = jaccard(targetTaste.templates, viewerTaste.templates);
    const hashtagScore = jaccard(targetTaste.hashtags, viewerTaste.hashtags);
    tasteMatch = {
      score: Math.round((templateScore * 0.3 + hashtagScore * 0.7) * 100),
      shared_templates: [...targetTaste.templates].filter((value) => viewerTaste.templates.has(value)).length,
      shared_hashtags: [...targetTaste.hashtags].filter((value) => viewerTaste.hashtags.has(value)).slice(0, 5),
    };
  }
  return { similar_users: similarUsers, taste_match: tasteMatch };
}

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  if (request.method !== 'GET') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonResponse({ success: false, error: 'Missing id' }, 400);

    const viewerId = auth?.user?.id || null;

    // ?fields=similar — lazy Taste Details based on hashtags and templates;
    // viewer strictly from the verified session.
    if (url.searchParams.get('fields') === 'similar') {
      const exists = await db.prepare('SELECT id FROM profiles WHERE id = ?').bind(id).first();
      if (!exists) return jsonResponse({ success: false, error: 'ไม่พบผู้ใช้นี้' }, 404);
      const section = await buildSimilarSection(db, id, viewerId);
      return jsonResponse({ success: true, data: { id, ...section } });
    }
    const { results } = await db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM rankings r WHERE r.user_id = p.id) as posts_count,
        (SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id) as followers_count,
        (SELECT COUNT(*) FROM follows f WHERE f.follower_id = p.id) as following_count,
        ${viewerId ? '(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = p.id)' : 'NULL'} as is_following
      FROM profiles p
      WHERE p.id = ?
    `).bind(...(viewerId ? [viewerId, id] : [id])).all();

    if (results.length === 0) return jsonResponse({ success: false, error: 'ไม่พบผู้ใช้นี้' }, 404);

    const user = results[0];
    const publicUser = {
      id: user.id,
      username: user.username || 'Unknown',
      avatar_url: user.avatar_url || null,
      bio: user.bio || null,
      university: user.university || null,
      faculty: user.faculty || null,
      major: user.major || null,
      year: user.year || null,
      created_at: user.created_at || null,
      posts_count: toNumber(user.posts_count),
      followers_count: toNumber(user.followers_count),
      following_count: toNumber(user.following_count),
      is_following: !!user.is_following,
    };

    const taste_identity = await buildTasteIdentity(db, id, publicUser);
    return jsonResponse({ success: true, data: { ...publicUser, taste_identity } });
  } catch (err) {
    console.error('User profile query failed:', { name: err?.name, message: err?.message });
    return internalErrorResponse();
  }
}
