// functions/lib/cooldown.js
// 7-day template contribution cooldown and anti-pumping helpers

export const COOLDOWN_DAYS = 7;
export const COOLDOWN_SECONDS = COOLDOWN_DAYS * 24 * 3600;

/**
 * Check if an active cooldown exists for (templateId, userId) in database UTC time.
 */
export async function checkTemplateCooldown(db, templateId, userId) {
  if (!templateId || !userId) {
    return { active: false, cooldownUntil: null, remainingSeconds: 0 };
  }

  const row = await db.prepare(`
    SELECT cooldown_until,
           CAST(strftime('%s', cooldown_until) AS INTEGER) - CAST(strftime('%s', CURRENT_TIMESTAMP) AS INTEGER) AS remaining_seconds,
           CASE WHEN cooldown_until > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS is_active
    FROM template_user_contributions
    WHERE template_id = ? AND user_id = ?
  `).bind(templateId, userId).first();

  if (!row || !row.is_active) {
    return { active: false, cooldownUntil: null, remainingSeconds: 0 };
  }

  const remainingSeconds = Math.max(0, Number(row.remaining_seconds) || 0);
  return {
    active: remainingSeconds > 0,
    cooldownUntil: row.cooldown_until,
    remainingSeconds,
  };
}

/**
 * Stable machine-readable HTTP 409 response for active cooldown.
 */
export function cooldownResponse(templateId, cooldownUntil, remainingSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(Number(remainingSeconds) || 0));
  return new Response(
    JSON.stringify({
      success: false,
      code: 'TEMPLATE_COOLDOWN_ACTIVE',
      error: 'Template cooldown is active',
      template_id: templateId,
      next_available_at: cooldownUntil,
      remaining_seconds: safeSeconds,
    }),
    {
      status: 409,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    }
  );
}

/**
 * Atomic UPSERT statement for template_user_contributions.
 * Starts/updates the 7-day cooldown and sets current_ranking_id.
 */
export function recordContributionStatement(db, templateId, userId, rankingId) {
  return db.prepare(`
    INSERT INTO template_user_contributions (
      template_id, user_id, current_ranking_id, cooldown_until, last_contributed_at
    ) VALUES (
      ?1, ?2, ?3, datetime(CURRENT_TIMESTAMP, '+7 days'), CURRENT_TIMESTAMP
    )
    ON CONFLICT(template_id, user_id) DO UPDATE SET
      current_ranking_id = excluded.current_ranking_id,
      -- The migrated DB also has a trigger, but fresh schema.sql databases do
      -- not. A NOT NULL violation aborts the entire publish batch in either case.
      cooldown_until = CASE WHEN template_user_contributions.cooldown_until > CURRENT_TIMESTAMP
        THEN NULL ELSE excluded.cooldown_until END,
      last_contributed_at = excluded.last_contributed_at
  `).bind(templateId, userId, rankingId);
}

export function isCooldownConflict(error) {
  const message = String(error?.message || error);
  return message.includes('TEMPLATE_COOLDOWN_ACTIVE')
    || message.includes('NOT NULL constraint failed: template_user_contributions.cooldown_until');
}

/**
 * Reconcile current_ranking_id on ranking deletion without resetting cooldown.
 */
export async function getDeleteReconcileStatement(db, templateId, userId, deletedRankingId) {
  if (!templateId || !userId) return null;

  const current = await db.prepare(
    'SELECT current_ranking_id FROM template_user_contributions WHERE template_id = ? AND user_id = ?'
  ).bind(templateId, userId).first();

  if (!current || current.current_ranking_id !== deletedRankingId) {
    return null;
  }

  const fallback = await db.prepare(`
    SELECT id FROM rankings
    WHERE template_id = ? AND user_id = ? AND id != ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).bind(templateId, userId, deletedRankingId).first();

  const nextRankingId = fallback?.id || null;

  return db.prepare(
    'UPDATE template_user_contributions SET current_ranking_id = ? WHERE template_id = ? AND user_id = ?'
  ).bind(nextRankingId, templateId, userId);
}

/**
 * Evict public community statistics cache for template.
 */
export async function evictCommunityCache(request, templateId) {
  if (!templateId || !globalThis.caches?.default || !request?.url) return;
  try {
    const origin = new URL(request.url).origin;
    const cacheKey = new Request(
      `${origin}/api/__community_stats_v1?template=${encodeURIComponent(templateId)}`
    );
    await globalThis.caches.default.delete(cacheKey);
  } catch {
    // Best-effort cache eviction
  }
}
