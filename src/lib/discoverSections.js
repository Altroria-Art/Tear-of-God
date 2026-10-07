// Give each post one destination on the Pulse page. Discussions take priority.
// Related tag/topic teasers covered by those posts stay reachable via All topics/hashtags.
export function selectDiscoverSections(pulse = {}) {
  const discussions = (pulse.discussions || []).slice(0, 3);
  const postIds = new Set(discussions.map(post => post.id));
  const rankings = (pulse.rankings || []).filter(post => !postIds.has(post.id)).slice(0, 3);
  rankings.forEach(post => postIds.add(post.id));
  const coveredTemplates = new Set((pulse.templates || []).filter(topic => postIds.has(topic.preview_ranking?.id)).map(topic => topic.id));
  const topics = [];
  for (const topic of pulse.topics || []) {
    const previews = (topic.preview_rankings || []).filter(post => !postIds.has(post.id));
    if (topic.preview_rankings?.length && !previews.length) continue;
    topics.push({ ...topic, preview_rankings: previews });
    previews.forEach(post => postIds.add(post.id));
    if (topics.length === 3) break;
  }
  const topicHrefs = new Set(topics.map(topic => topic.href));
  const previewIds = new Set(topics.flatMap(topic => (topic.preview_rankings || []).map(post => post.id)));
  const templates = (pulse.templates || []).filter(topic => !coveredTemplates.has(topic.id)
    && !topicHrefs.has(`/template/${encodeURIComponent(topic.id)}`)
    && !previewIds.has(topic.preview_ranking?.id)).slice(0, 3);
  const allTopicHrefs = new Set((pulse.topics || []).map(topic => topic.href));
  templates.forEach(topic => { if (topic.preview_ranking?.id) postIds.add(topic.preview_ranking.id); });
  const hashtags = (pulse.hashtags || []).filter(tag => !allTopicHrefs.has(tag.href)
    && (!tag.preview_rankings?.length || tag.preview_rankings.some(post => !postIds.has(post.id)))).slice(0, 6);
  return { discussions, rankings, topics, templates, hashtags };
}
