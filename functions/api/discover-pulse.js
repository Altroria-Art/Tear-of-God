import { publicResponseCache } from '../lib/public-response-cache.js';
import { internalErrorResponse } from '../lib/request-guard.js';

const WINDOW_MS = { now: 6 * 60 * 60 * 1000, today: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, last_week: 7 * 24 * 60 * 60 * 1000 };
const CACHE_SECONDS = { now: 120, today: 300, week: 600, last_week: 1800 };
const CANDIDATES_PER_INDEX = 40;
const CACHE_VERSION = 'v1';

const dbTime = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const parseTime = value => value ? Date.parse(`${value.replace(' ', 'T')}Z`) || 0 : 0;

function boundsFor(window, now) {
  const end = window === 'last_week' ? now - WINDOW_MS.week : now + 1000;
  return { from: dbTime(end - WINDOW_MS[window]), to: dbTime(end), startMs: end - WINDOW_MS[window], endMs: end };
}

function parseTags(csv) {
  return [...new Set(String(csv || '').split(',').map(value => value.trim().replace(/^#+/, '').toLowerCase()).filter(Boolean))].slice(0, 12);
}

async function countEvents(db, table, ids, from, to) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const { results = [] } = await db.prepare(`
    SELECT ranking_id, COUNT(*) AS count, MAX(created_at) AS latest_at
    FROM ${table}
    WHERE ranking_id IN (${placeholders}) AND created_at >= ? AND created_at < ?
    GROUP BY ranking_id
  `).bind(...ids, from, to).all();
  return new Map(results.map(row => [row.ranking_id, row]));
}

async function loadWindow(db, window, now) {
  const { from, to, startMs, endMs } = boundsFor(window, now);
  // Both scans stop at an index-backed LIMIT. The union is at most 80 rankings;
  // every subsequent IN query is bounded below D1's 100-bind-parameter limit.
  const [created, active] = await Promise.all([
    db.prepare(`SELECT id, title, hashtags, user_id, template_id, created_at, last_activity_at
      FROM rankings WHERE created_at >= ? AND created_at < ?
      ORDER BY created_at DESC, id DESC LIMIT ${CANDIDATES_PER_INDEX}`).bind(from, to).all(),
    db.prepare(`SELECT id, title, hashtags, user_id, template_id, created_at, last_activity_at
      FROM rankings WHERE COALESCE(last_activity_at, created_at) >= ?
        AND COALESCE(last_activity_at, created_at) < ?
      ORDER BY COALESCE(last_activity_at, created_at) DESC, id DESC
      LIMIT ${CANDIDATES_PER_INDEX}`).bind(from, to).all(),
  ]);
  const rows = [...new Map([...(created.results || []), ...(active.results || [])].map(row => [row.id, row])).values()];
  const ids = rows.map(row => row.id);
  if (!ids.length) return { from, to, sampled: false, topics: [], rankings: [], templates: [], discussions: [], hashtags: [], active_rankings: 0 };

  const templateIds = [...new Set(rows.map(row => row.template_id).filter(Boolean))];
  const authorIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
  const placeholders = values => values.map(() => '?').join(',');
  const [comments, votes, templateResult, authorResult] = await Promise.all([
    countEvents(db, 'comments', ids, from, to),
    countEvents(db, 'votes', ids, from, to),
    templateIds.length ? db.prepare(`SELECT t.id, t.title, t.hashtags, t.creator_id, p.username AS creator_name
      FROM templates t LEFT JOIN profiles p ON p.id = t.creator_id
      WHERE t.id IN (${placeholders(templateIds)})`).bind(...templateIds).all() : { results: [] },
    authorIds.length ? db.prepare(`SELECT id, username FROM profiles WHERE id IN (${placeholders(authorIds)})`).bind(...authorIds).all() : { results: [] },
  ]);
  const templatesById = new Map((templateResult.results || []).map(row => [row.id, row]));
  const authorsById = new Map((authorResult.results || []).map(row => [row.id, row.username]));
  const topicsByKey = new Map();
  const activityByTemplate = new Map();
  const recentRankings = [];
  const discussions = [];
  let activeRankings = 0;

  for (const row of rows) {
    const newRanking = parseTime(row.created_at) >= startMs && parseTime(row.created_at) < endMs;
    const recentComments = Number(comments.get(row.id)?.count || 0);
    const recentReactions = Number(votes.get(row.id)?.count || 0);
    const lastActivity = parseTime(row.last_activity_at);
    const activityMarker = !newRanking && !recentComments && !recentReactions && lastActivity >= startMs && lastActivity < endMs ? 1 : 0;
    const signals = Number(newRanking) + recentComments + recentReactions + activityMarker;
    if (!signals) continue;
    activeRankings++;
    const template = templatesById.get(row.template_id);
    const latestMs = Math.max(newRanking ? parseTime(row.created_at) : 0,
      parseTime(comments.get(row.id)?.latest_at), parseTime(votes.get(row.id)?.latest_at),
      lastActivity >= startMs && lastActivity < endMs ? lastActivity : 0);
    const preview = { id: row.id, title: row.title || template?.title || '', comments: recentComments,
      reactions: recentReactions, latest_activity_at: dbTime(latestMs) };
    recentRankings.push({ ...preview, activity_count: signals, new_ranking: newRanking,
      template_title: template?.title || null, author_name: authorsById.get(row.user_id) || null,
      hashtags: row.hashtags || template?.hashtags || '', latestMs });
    const base = { activity_count: signals, ranking_count: Number(newRanking), comments: recentComments,
      reactions: recentReactions, latestMs, rankingIds: new Set([row.id]), preview_rankings: [preview] };
    const tags = parseTags(row.hashtags || template?.hashtags);
    const keys = tags.length ? tags.map(tag => ({ key: `tag:${tag}`, label: `#${tag}`, hashtag: tag, href: `/discover/hashtag/${encodeURIComponent(tag)}` }))
      : [{ key: template ? `template:${template.id}` : `ranking:${row.id}`,
        label: template?.title || row.title || '', hashtag: null,
        href: template ? `/template/${encodeURIComponent(template.id)}` : `/post/${encodeURIComponent(row.id)}` }];
    for (const entry of keys) {
      const prior = topicsByKey.get(entry.key);
      if (!prior) topicsByKey.set(entry.key, { ...entry, ...base, rankingIds: new Set([row.id]), preview_rankings: [preview] });
      else {
        prior.activity_count += signals; prior.ranking_count += Number(newRanking);
        prior.comments += recentComments; prior.reactions += recentReactions;
        prior.latestMs = Math.max(prior.latestMs, latestMs);
        prior.rankingIds.add(row.id);
        prior.preview_rankings = [...prior.preview_rankings, preview]
          .sort((a, b) => b.latest_activity_at.localeCompare(a.latest_activity_at)).slice(0, 2);
      }
    }
    if (template) {
      const prior = activityByTemplate.get(template.id);
      if (!prior) activityByTemplate.set(template.id, { id: template.id, title: template.title, hashtags: template.hashtags,
        creator_id: template.creator_id, creator_name: template.creator_name, ...base,
        rankingIds: new Set([row.id]), preview_ranking: preview });
      else {
        prior.activity_count += signals; prior.ranking_count += Number(newRanking);
        prior.comments += recentComments; prior.reactions += recentReactions;
        if (latestMs > prior.latestMs) prior.preview_ranking = preview;
        prior.latestMs = Math.max(prior.latestMs, latestMs);
        prior.rankingIds.add(row.id);
      }
    }
    if (recentComments) discussions.push({ ...preview, template_title: template?.title || null,
      author_name: authorsById.get(row.user_id) || null, latest_activity_at: dbTime(latestMs) });
  }

  const score = entry => {
    const freshness = Math.max(0, 1 - (endMs - entry.latestMs) / WINDOW_MS[window]);
    return freshness * 40 + Math.min(entry.comments, 8) * 1.25 + Math.min(entry.ranking_count, 6)
      + Math.min(entry.reactions, 8) * .5 + Math.min(entry.rankingIds.size, 5);
  };
  const sortPulse = (a, b) => score(b) - score(a) || b.latestMs - a.latestMs || a.label?.localeCompare(b.label) || 0;
  const serialize = entry => {
    const { latestMs, rankingIds, ...publicEntry } = entry;
    return { ...publicEntry, active_rankings: rankingIds.size, latest_activity_at: dbTime(latestMs) };
  };
  const sortedTopics = [...topicsByKey.values()].sort(sortPulse);
  const selectedTopics = [];
  for (const topic of sortedTopics) {
    if (selectedTopics.length === 5) break;
    if (selectedTopics.some(chosen => chosen.rankingIds.size === topic.rankingIds.size
      && [...topic.rankingIds].every(id => chosen.rankingIds.has(id)))) continue;
    selectedTopics.push(topic);
  }
  const topTemplates = [...activityByTemplate.values()].sort(sortPulse).slice(0, 4);
  const templatePreviews = await Promise.all(topTemplates.map(template => db.prepare(`
    SELECT ti.tier, i.name FROM template_items ti
    JOIN items i ON i.id = ti.item_id
    WHERE ti.template_id = ? AND i.name IS NOT NULL AND TRIM(i.name) <> ''
    ORDER BY ti.position ASC, ti.id ASC LIMIT 4
  `).bind(template.id).all()));
  return {
    from, to,
    sampled: (created.results || []).length === CANDIDATES_PER_INDEX || (active.results || []).length === CANDIDATES_PER_INDEX,
    active_rankings: activeRankings,
    topics: selectedTopics.map(serialize),
    rankings: recentRankings.sort((a, b) => {
      const freshness = entry => Math.max(0, 1 - (endMs - entry.latestMs) / WINDOW_MS[window]);
      const rankScore = entry => freshness(entry) * 40 + Math.min(entry.comments, 8) * 1.25
        + Number(entry.new_ranking) + Math.min(entry.reactions, 8) * .5;
      return rankScore(b) - rankScore(a) || b.latestMs - a.latestMs;
    }).slice(0, 4).map(({ latestMs, ...entry }) => ({ ...entry, latest_activity_at: dbTime(latestMs) })),
    templates: topTemplates.map((template, index) => ({ ...serialize(template),
      preview_items: (templatePreviews[index].results || []).map(item => ({ tier: item.tier, name: item.name })) })),
    discussions: discussions.sort((a, b) => b.comments - a.comments || b.latest_activity_at.localeCompare(a.latest_activity_at)).slice(0, 4),
    hashtags: sortedTopics.filter(topic => topic.hashtag).slice(0, 12).map(serialize),
  };
}

export async function onRequestGet(context) {
  const requested = new URL(context.request.url).searchParams.get('window') || 'now';
  if (!Object.hasOwn(WINDOW_MS, requested)) return Response.json({ success: false, error: 'Invalid window' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const key = new Request(new URL(`/api/discover-pulse?window=${requested}&v=${CACHE_VERSION}`, context.request.url));
  try {
    return await publicResponseCache(context, key, CACHE_SECONDS[requested], async () => {
      const now = Date.now();
      let effective = requested;
      let pulse = await loadWindow(context.env.tear_of_god_db, effective, now);
      while (!pulse.active_rankings && (effective === 'now' || effective === 'today')) {
        effective = effective === 'now' ? 'today' : 'week';
        pulse = await loadWindow(context.env.tear_of_god_db, effective, now);
      }
      return Response.json({ success: true, requested_window: requested, window: effective,
        fallback_from: effective === requested ? null : requested, as_of: dbTime(now), ...pulse },
      { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS[requested]}` } });
    });
  } catch (error) {
    console.error('Discover Pulse query failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}
