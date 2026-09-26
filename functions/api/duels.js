import {
  assertId,
  assertInteger,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
} from '../lib/request-guard.js';
import {
  calculateTierSimilarity,
  calculateCommunitySimilarity,
  MIN_COMMUNITY_SAMPLES,
} from '../lib/similarity.js';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });

export async function onRequestPost({ request, env, data: auth }) {
  const currentUserId = auth?.user?.id;
  if (!currentUserId) {
    return jsonResponse({ success: false, error: 'Unauthorized: Please log in' }, 401);
  }

  try {
    const gate = consumeMemoryRateLimit('duel-mutation', currentUserId, {
      limit: 30,
      windowSeconds: 3600,
    });
    if (!gate.allowed) return rateLimitResponse(gate);

    const body = await readJsonBody(request);
    if (!isPlainObject(body)) {
      return jsonResponse({ success: false, error: 'Invalid request body' }, 400);
    }

    const templateId = assertId(body.template_id, 'template_id');
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return jsonResponse({ success: false, error: 'Ranking items are required' }, 400);
    }

    const db = env.tear_of_god_db;

    // 1. Fetch template
    const template = await db
      .prepare(
        'SELECT id, creator_id, title, description, hashtags, tiers FROM templates WHERE id = ?'
      )
      .bind(templateId)
      .first();

    if (!template) {
      return jsonResponse({ success: false, error: 'Template not found' }, 404);
    }

    const ownerId = template.creator_id;
    if (!ownerId) {
      return jsonResponse({ success: false, error: 'Template has no owner to duel' }, 400);
    }

    if (ownerId === currentUserId) {
      return jsonResponse(
        { success: false, error: 'Cannot duel your own template' },
        400
      );
    }

    // 2. Parse & validate template tiers
    let tiersDef = [];
    try {
      const parsed = typeof template.tiers === 'string' ? JSON.parse(template.tiers) : template.tiers;
      tiersDef = Array.isArray(parsed) ? parsed : [];
    } catch {
      tiersDef = [];
    }

    if (tiersDef.length === 0) {
      return jsonResponse({ success: false, error: 'Template has no valid tiers' }, 400);
    }

    const tierIndexByLabel = {};
    tiersDef.forEach((t, i) => {
      if (t && typeof t.label === 'string') {
        tierIndexByLabel[String(t.label)] = i;
      }
    });

    for (const item of items) {
      if (!item || !item.item_id || tierIndexByLabel[String(item.tier)] === undefined) {
        return jsonResponse(
          { success: false, error: 'Ranking item references an unknown tier or item_id' },
          400
        );
      }
    }

    // 3. Fetch Owner's original placements
    // Priority: Owner's first published ranking on this template
    const ownerRanking = await db
      .prepare(
        'SELECT id FROM rankings WHERE template_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 1'
      )
      .bind(templateId, ownerId)
      .first();

    let ownerPlacements = [];
    let ownerRankingId = null;

    if (ownerRanking?.id) {
      ownerRankingId = ownerRanking.id;
      const { results } = await db
        .prepare(
          'SELECT item_id, tier, position FROM ranking_items WHERE ranking_id = ?'
        )
        .bind(ownerRanking.id)
        .all();
      ownerPlacements = results || [];
    }

    // Fallback: Default placements defined in template_items
    if (ownerPlacements.length === 0) {
      const { results } = await db
        .prepare(
          'SELECT item_id, tier, position FROM template_items WHERE template_id = ? AND tier IS NOT NULL'
        )
        .bind(templateId)
        .all();
      ownerPlacements = results || [];
    }

    // 4. Calculate similarity between Challenger (A) and Owner (B)
    const comparison = calculateTierSimilarity(items, ownerPlacements, tiersDef);
    const similarityScore = comparison.score;

    // 5. Calculate Community Average similarity (excluding Challenger A)
    const communityRankingsCountRow = await db
      .prepare(
        'SELECT COUNT(DISTINCT r.id) AS total FROM rankings r WHERE r.template_id = ? AND r.user_id != ?'
      )
      .bind(templateId, currentUserId)
      .first();

    const sampleCount = Number(communityRankingsCountRow?.total || 0);

    let communitySimilarityScore = null;
    if (sampleCount >= MIN_COMMUNITY_SAMPLES) {
      const { results: histogram } = await db
        .prepare(
          `SELECT ri.item_id, ri.tier, COUNT(*) AS placements
           FROM ranking_items ri
           JOIN rankings r ON r.id = ri.ranking_id
           WHERE r.template_id = ? AND r.user_id != ? AND ri.tier IS NOT NULL
           GROUP BY ri.item_id, ri.tier`
        )
        .bind(templateId, currentUserId)
        .all();

      const communityByItem = {};
      (histogram || []).forEach((row) => {
        const tierIdx = tierIndexByLabel[String(row.tier)];
        if (tierIdx === undefined) return;
        if (!communityByItem[row.item_id]) {
          communityByItem[row.item_id] = { sum: 0, count: 0 };
        }
        const n = Number(row.placements) || 0;
        communityByItem[row.item_id].sum += tierIdx * n;
        communityByItem[row.item_id].count += n;
      });

      communitySimilarityScore = calculateCommunitySimilarity(
        items,
        communityByItem,
        tiersDef,
        sampleCount,
        MIN_COMMUNITY_SAMPLES
      );
    }

    // 6. Save Challenger's ranking & Duel record in atomic transaction
    const rankingId = crypto.randomUUID();
    const duelId = crypto.randomUUID();
    const statements = [];

    const rankingTitle = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : `${template.title} (Duel)`;
    const rankingDescription = typeof body.description === 'string'
      ? body.description.trim().slice(0, 5000)
      : '';

    // Insert Challenger's ranking
    statements.push(
      db
        .prepare(
          `INSERT INTO rankings (id, template_id, title, description, hashtags, user_id, last_activity_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          rankingId,
          templateId,
          rankingTitle,
          rankingDescription,
          template.hashtags || '',
          currentUserId
        )
    );

    // Insert ranking items
    const rankingItemsPayload = items.map((item, index) => ({
      id: crypto.randomUUID(),
      item_id: String(item.item_id),
      tier: String(item.tier),
      position: typeof item.position === 'number' ? item.position : index,
    }));

    statements.push(
      db
        .prepare(
          `INSERT INTO ranking_items (id, ranking_id, item_id, tier, position)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.item_id'),
                  json_extract(value, '$.tier'), CAST(json_extract(value, '$.position') AS INTEGER)
           FROM json_each(?2)`
        )
        .bind(rankingId, JSON.stringify(rankingItemsPayload))
    );

    // Insert frozen scores for community average
    const tierCount = tiersDef.length;
    const scoreItemsPayload = items.map((item) => {
      const idx = tierIndexByLabel[String(item.tier)];
      return {
        id: crypto.randomUUID(),
        item_id: String(item.item_id),
        tier_index: idx,
        score: tierCount - idx,
      };
    });

    if (scoreItemsPayload.length > 0) {
      statements.push(
        db
          .prepare(
            `INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score)
             SELECT json_extract(value, '$.id'), ?1, ?2, json_extract(value, '$.item_id'),
                    CAST(json_extract(value, '$.tier_index') AS INTEGER),
                    CAST(json_extract(value, '$.score') AS INTEGER)
             FROM json_each(?3)`
          )
          .bind(rankingId, templateId, JSON.stringify(scoreItemsPayload))
      );
    }

    // Increment template use_count
    statements.push(
      db
        .prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?')
        .bind(templateId)
    );

    // Insert duel record
    statements.push(
      db
        .prepare(
          `INSERT INTO duels (
             id, challenger_id, template_id, owner_id, challenger_ranking_id,
             owner_ranking_id, similarity_score, community_similarity_score,
             community_sample_count, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          duelId,
          currentUserId,
          templateId,
          ownerId,
          rankingId,
          ownerRankingId,
          similarityScore,
          communitySimilarityScore,
          sampleCount
        )
    );

    // Notify Owner B: "@A dueled your template"
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO notifications (
             id, user_id, actor_id, type, ranking_id, template_id
           ) VALUES (?, ?, ?, 'duel', ?, ?)`
        )
        .bind(crypto.randomUUID(), ownerId, currentUserId, rankingId, templateId)
    );

    await db.batch(statements);

    return jsonResponse(
      {
        success: true,
        data: {
          id: duelId,
          challenger_id: currentUserId,
          owner_id: ownerId,
          template_id: templateId,
          similarity_score: similarityScore,
          community_similarity_score: communitySimilarityScore,
          community_sample_count: sampleCount,
          ranking_id: rankingId,
          item_details: comparison.itemDetails,
        },
      },
      201
    );
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Duel creation failed:', error?.name, error?.message);
    return jsonResponse(
      { success: false, error: 'Failed to complete duel' },
      500
    );
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const db = env.tear_of_god_db;

    // 1. Single Duel Result by ID
    const duelId = url.searchParams.get('id');
    if (duelId) {
      assertId(duelId, 'id');
      const duel = await db
        .prepare(
          `SELECT
             d.id, d.challenger_id, d.owner_id, d.template_id,
             d.challenger_ranking_id, d.owner_ranking_id,
             d.similarity_score, d.community_similarity_score,
             d.community_sample_count, d.created_at,
             c.username AS challenger_username, c.avatar_url AS challenger_avatar_url,
             o.username AS owner_username, o.avatar_url AS owner_avatar_url,
             t.title AS template_title, t.description AS template_description,
             t.hashtags AS template_hashtags, t.tiers AS template_tiers
           FROM duels d
           JOIN profiles c ON c.id = d.challenger_id
           JOIN profiles o ON o.id = d.owner_id
           JOIN templates t ON t.id = d.template_id
           WHERE d.id = ?`
        )
        .bind(duelId)
        .first();

      if (!duel) {
        return jsonResponse({ success: false, error: 'Duel not found' }, 404);
      }

      // Fetch Challenger's and Owner's item placements to build item-by-item comparison
      let tiersDef = [];
      try {
        tiersDef = JSON.parse(duel.template_tiers || '[]');
      } catch {
        tiersDef = [];
      }

      const { results: challengerItems } = await db
        .prepare('SELECT item_id, tier, position FROM ranking_items WHERE ranking_id = ?')
        .bind(duel.challenger_ranking_id)
        .all();

      let ownerItems = [];
      if (duel.owner_ranking_id) {
        const { results } = await db
          .prepare('SELECT item_id, tier, position FROM ranking_items WHERE ranking_id = ?')
          .bind(duel.owner_ranking_id)
          .all();
        ownerItems = results || [];
      } else {
        const { results } = await db
          .prepare('SELECT item_id, tier, position FROM template_items WHERE template_id = ? AND tier IS NOT NULL')
          .bind(duel.template_id)
          .all();
        ownerItems = results || [];
      }

      // Fetch item image/name metadata from template_items & items
      const { results: templateItemMeta } = await db
        .prepare(
          `SELECT ti.item_id, i.name as item_name, i.image_url as item_image
           FROM template_items ti
           LEFT JOIN items i ON i.id = ti.item_id
           WHERE ti.template_id = ?`
        )
        .bind(duel.template_id)
        .all();

      const itemMetaMap = new Map();
      (templateItemMeta || []).forEach((row) => {
        itemMetaMap.set(row.item_id, {
          name: row.item_name || row.item_id,
          image_url: row.item_image || null,
        });
      });

      const comparison = calculateTierSimilarity(challengerItems, ownerItems, tiersDef);

      const enrichedDetails = comparison.itemDetails.map((detail) => {
        const meta = itemMetaMap.get(detail.itemId) || {
          name: detail.itemId,
          image_url: null,
        };
        const tierDefA = tiersDef.find((t) => t.label === detail.tierA);
        const tierDefB = tiersDef.find((t) => t.label === detail.tierB);
        return {
          ...detail,
          itemName: meta.name,
          imageUrl: meta.image_url,
          tierColorA: tierDefA?.color || null,
          tierColorB: tierDefB?.color || null,
        };
      });

      return jsonResponse({
        success: true,
        data: {
          id: duel.id,
          similarity_score: duel.similarity_score,
          community_similarity_score: duel.community_similarity_score,
          community_sample_count: duel.community_sample_count,
          created_at: duel.created_at,
          challenger: {
            id: duel.challenger_id,
            username: duel.challenger_username,
            avatar_url: duel.challenger_avatar_url,
          },
          owner: {
            id: duel.owner_id,
            username: duel.owner_username,
            avatar_url: duel.owner_avatar_url,
          },
          template: {
            id: duel.template_id,
            title: duel.template_title,
            description: duel.template_description,
            hashtags: duel.template_hashtags,
            tiers: tiersDef,
          },
          ranking_id: duel.challenger_ranking_id,
          comparison: {
            total_items: comparison.totalItems,
            shared_items: comparison.sharedItems,
            matched_items: comparison.matchedItems,
            details: enrichedDetails,
          },
        },
      });
    }

    // 2. User Duel History by user_id
    const userId = url.searchParams.get('user_id');
    if (userId) {
      assertId(userId, 'user_id');
      const page = assertInteger(parseInt(url.searchParams.get('page') || '1', 10), 'page', { min: 1 });
      const limit = assertInteger(parseInt(url.searchParams.get('limit') || '10', 10), 'limit', { min: 1, max: 50 });
      const offset = (page - 1) * limit;

      const [countRow, { results }] = await Promise.all([
        db
          .prepare(
            'SELECT COUNT(*) AS total FROM duels WHERE challenger_id = ? OR owner_id = ?'
          )
          .bind(userId, userId)
          .first(),
        db
          .prepare(
            `SELECT
               d.id, d.challenger_id, d.owner_id, d.template_id,
               d.similarity_score, d.community_similarity_score,
               d.community_sample_count, d.created_at,
               c.username AS challenger_username, c.avatar_url AS challenger_avatar_url,
               o.username AS owner_username, o.avatar_url AS owner_avatar_url,
               t.title AS template_title
             FROM duels d
             JOIN profiles c ON c.id = d.challenger_id
             JOIN profiles o ON o.id = d.owner_id
             JOIN templates t ON t.id = d.template_id
             WHERE d.challenger_id = ? OR d.owner_id = ?
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`
          )
          .bind(userId, userId, limit, offset)
          .all(),
      ]);

      const total = Number(countRow?.total || 0);

      return jsonResponse({
        success: true,
        data: results || [],
        total,
        page,
        limit,
      });
    }

    // 3. Duels by template_id
    const tplId = url.searchParams.get('template_id');
    if (tplId) {
      assertId(tplId, 'template_id');
      const limit = assertInteger(parseInt(url.searchParams.get('limit') || '10', 10), 'limit', { min: 1, max: 50 });

      const { results } = await db
        .prepare(
          `SELECT
             d.id, d.challenger_id, d.owner_id, d.template_id,
             d.similarity_score, d.community_similarity_score,
             d.community_sample_count, d.created_at,
             c.username AS challenger_username, c.avatar_url AS challenger_avatar_url,
             o.username AS owner_username, o.avatar_url AS owner_avatar_url,
             t.title AS template_title
           FROM duels d
           JOIN profiles c ON c.id = d.challenger_id
           JOIN profiles o ON o.id = d.owner_id
           JOIN templates t ON t.id = d.template_id
           WHERE d.template_id = ?
           ORDER BY d.created_at DESC
           LIMIT ?`
        )
        .bind(tplId, limit)
        .all();

      return jsonResponse({
        success: true,
        data: results || [],
      });
    }

    return jsonResponse({ success: false, error: 'Missing id, user_id, or template_id parameter' }, 400);
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Duel query failed:', error?.name, error?.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
