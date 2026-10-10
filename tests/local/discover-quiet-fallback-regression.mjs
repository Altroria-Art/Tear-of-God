import assert from 'node:assert/strict';
import { mountPage, elements, text } from './helpers/component-harness.mjs';

const boards = ids => ({ success: true, data: ids.map(id => ({ template: { id, title: id, use_count: 1, tiers: [] }, community_average: { updated_at: null, tiers: [] }, participant_count: 0, stats: { comments: 0 }, template_items: [] })) });
const carouselTopics = tree => elements(tree).filter(node => node.type === 'test-DiscoverBoardCarousel').flatMap(node => node.props.templates);

// Popular/new topics remain useful when Pulse has no current activity.
for (const tab of ['popular', 'new']) {
  const requests = [];
  const page = await mountPage('src/pages/Discover.jsx', {
    fetchHashtags: async () => ({ data: [] }),
    fetchDiscoverPulse: async () => ({ success: true, window: 'now', templates: [], rankings: [], discussions: [] }),
    fetchTemplates: options => new Promise(resolve => requests.push({ options, resolve })),
    fetchDiscoverBoards: async ids => boards(ids),
  }, { params: new URLSearchParams('tab=' + tab) });
  try {
    const { signal, ...options } = requests[0].options;
    assert(signal instanceof AbortSignal);
    assert.deepEqual(options, { sort: tab === 'new' ? 'recent' : 'popular', limit: 8, page: 1, fields: 'meta' });
    await page.flush();
    assert(elements(page.state.tree).some(node => node.props['aria-busy']), 'Loading until the catalog responds');
    requests[0].resolve({ data: [{ id: 'topic', title: 'Real topic' }] });
    await page.flush();
    assert.deepEqual(carouselTopics(page.state.tree).map(topic => topic.id), ['topic']);
    page.state.router.params = new URLSearchParams('tab=' + (tab === 'new' ? 'popular' : 'new'));
    page.render();
    const late = requests[1];
    page.state.router.params = new URLSearchParams('tab=' + tab);
    page.render();
    assert(late.options.signal.aborted, 'Switching tabs aborts the old catalog request');
    late.resolve({ data: [{ id: 'stale' }] });
    await page.flush();
    assert(!carouselTopics(page.state.tree).some(topic => topic.id === 'stale'), 'Ignore a response from the previous tab');
    requests[2].resolve({ error: 'temporary failure', data: [{ id: 'bad-data' }] });
    await page.flush();
    assert(elements(page.state.tree).some(node => node.props.role === 'alert' && text(node).includes('temporary failure')));
    assert.equal(carouselTopics(page.state.tree).length, 0);
    const retry = elements(page.state.tree).find(node => node.type === 'button' && text(node) === 'common.retry');
    retry.props.onClick(); page.render();
    requests[3].resolve({ data: [] }); await page.flush();
    assert(text(page.state.tree).includes('discover.emptyTemplates'), 'Empty success clears the old error');
    assert(!elements(page.state.tree).some(node => node.props.role === 'alert'));
  } finally { await page.dispose(); }
}

const requests = [];
const active = await mountPage('src/pages/Discover.jsx', {
  fetchHashtags: async () => ({ data: [] }),
  fetchDiscoverPulse: async () => ({ success: true, window: 'today', fallback_from: 'now', templates: [{ id: 'b' }, { id: 'a' }] }),
  fetchTemplates() { throw Error('Active tab must not substitute popular catalog data'); },
  fetchDiscoverBoards: ids => new Promise(resolve => requests.push({ ids, resolve })),
}, { params: new URLSearchParams('tab=active') });
try {
  await active.flush();
  assert.deepEqual(requests.map(request => request.ids), [['b', 'a']], 'Activity uses one board batch');
  requests[0].resolve(boards(['a', 'b']));
  await active.flush();
  assert.deepEqual(carouselTopics(active.state.tree).map(topic => topic.id), ['b', 'a'], 'Keep Pulse order even when batch data has a different order');
  assert(text(active.state.tree).includes('pulse.displayedPeriod'), 'Show the effective fallback period');
} finally { await active.dispose(); }

for (const scenario of ['mixed', 'deleted', 'outage']) {
  const page = await mountPage('src/pages/Discover.jsx', {
    fetchHashtags: async () => ({ data: [] }),
    fetchDiscoverPulse: async () => ({ success: true, window: 'now', templates: scenario === 'mixed' ? [{ id: 'gone' }, { id: 'valid' }] : [{ id: 'gone' }] }),
    fetchTemplates() { throw Error('Active must keep Pulse ordering without catalog fallback'); },
    fetchDiscoverBoards: async ids => scenario === 'outage' ? { data: [], error: 'temporary outage', status: 503 } : boards(ids.filter(id => id === 'valid')),
  }, { params: new URLSearchParams('tab=active') });
  try {
    await page.flush();
    assert.deepEqual(carouselTopics(page.state.tree).map(topic => topic.id), scenario === 'mixed' ? ['valid'] : []);
    const alerts = elements(page.state.tree).filter(node => node.props.role === 'alert');
    assert.equal(alerts.length, scenario === 'outage' ? 1 : 0, 'Skip deleted cached topics, preserve outage retry');
    if (scenario === 'deleted') assert(text(page.state.tree).includes('pulse.quietDescription'));
    if (scenario === 'outage') assert(text(page.state.tree).includes('temporary outage'));
  } finally { await page.dispose(); }
}

// A board request can lag behind a completed catalog; it must also be cancelled.
const pending = [];
const delayed = await mountPage('src/pages/Discover.jsx', {
  fetchHashtags: async () => ({ data: [] }), fetchDiscoverPulse: async () => ({ success: true, templates: [] }),
  fetchTemplates: async ({ sort }) => ({ data: [{ id: sort }] }),
  fetchDiscoverBoards: (ids, options) => new Promise(resolve => pending.push({ ids, options, resolve })),
});
try {
  await delayed.flush();
  delayed.state.router.params = new URLSearchParams('tab=new'); delayed.render(); await delayed.flush();
  assert(pending[0].options.signal.aborted);
  pending[1].resolve(boards(['recent'])); await delayed.flush();
  pending[0].resolve(boards(['popular'])); await delayed.flush();
  assert.deepEqual(carouselTopics(delayed.state.tree).map(topic => topic.id), ['recent']);
} finally { await delayed.dispose(); }

// Saved/search paging and user changes retain the catalog contract and overlays.
const searchRequests = [];
const saved = await mountPage('src/pages/Discover.jsx', {
  fetchTemplates: options => new Promise(resolve => searchRequests.push({ options, resolve })),
  fetchDiscoverBoards: async ids => boards(ids),
}, { params: new URLSearchParams('view=saved&q=campus&page=2') });
try {
  saved.state.user = { id: 'one' }; saved.render(); await saved.flush();
  assert.equal(searchRequests[0].options.limit, 12); assert.equal(searchRequests[0].options.page, 2);
  searchRequests[0].resolve({ data: [{ id: 'one-topic', is_saved: true }], total: 30 }); await saved.flush();
  const cards = () => carouselTopics(saved.state.tree);
  assert.equal(cards()[0].is_saved, true);
  saved.state.user = { id: 'two' }; saved.render();
  assert.equal(cards().length, 0, 'Previous viewer saved cards disappear immediately');
  searchRequests[1].resolve({ data: [{ id: 'two-topic', is_saved: true }], total: 30 }); await saved.flush();
  assert.deepEqual(cards().map(card => card.id), ['two-topic']);
} finally { await saved.dispose(); }
console.log('Discover full boards: quiet catalog, cancellation, loading/error/empty/retry, deleted topics, activity order, saved/search paging and viewer isolation passed.');
