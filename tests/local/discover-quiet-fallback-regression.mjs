import assert from 'node:assert/strict';
import { mountPage, elements, text } from './helpers/component-harness.mjs';

// Popular/new topics remain useful when Pulse has no current activity.
for (const tab of ['popular', 'new']) {
  const requests = [];
  const page = await mountPage('src/pages/Discover.jsx', {
    fetchHashtags: async () => ({ data: [] }),
    fetchDiscoverPulse: async () => ({ success: true, window: 'now', templates: [], rankings: [], discussions: [] }),
    fetchTemplates: options => new Promise(resolve => requests.push({ options, resolve })),
    fetchTemplate() { throw Error('Quiet popular/new tabs must not hydrate activity topics'); },
  }, { params: new URLSearchParams('tab=' + tab) });
  try {
    assert.deepEqual(requests[0].options, { sort: tab === 'new' ? 'recent' : 'popular', limit: 8, page: 1 });
    await page.flush();
    assert(elements(page.state.tree).some(node => node.props['aria-busy']), 'Loading until the catalog responds');
    requests[0].resolve({ data: [{ id: 'topic', title: 'Real topic' }] });
    await page.flush();
    assert.deepEqual(elements(page.state.tree).filter(node => node.type === 'test-TemplateCard').map(node => node.props.template.id), ['topic']);
    page.state.router.params = new URLSearchParams('tab=' + (tab === 'new' ? 'popular' : 'new'));
    page.render();
    const late = requests[1];
    page.state.router.params = new URLSearchParams('tab=' + tab);
    page.render();
    late.resolve({ data: [{ id: 'stale' }] });
    await page.flush();
    assert(!elements(page.state.tree).some(node => node.props.template?.id === 'stale'), 'Ignore a response from the previous tab');
    requests[2].resolve({ error: 'temporary failure', data: [{ id: 'bad-data' }] });
    await page.flush();
    assert(elements(page.state.tree).some(node => node.props.role === 'alert' && text(node).includes('temporary failure')));
    assert.equal(elements(page.state.tree).filter(node => node.type === 'test-TemplateCard').length, 0);
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
  fetchTemplate: id => new Promise(resolve => requests.push({ id, resolve })),
}, { params: new URLSearchParams('tab=active') });
try {
  await active.flush();
  assert.deepEqual(requests.map(request => request.id), ['b', 'a']);
  requests[1].resolve({ data: { id: 'a', stats: { uses: 2 } } });
  requests[0].resolve({ data: { id: 'b', stats: { uses: 3 } } });
  await active.flush();
  assert.deepEqual(elements(active.state.tree).filter(node => node.type === 'test-TemplateCard').map(node => node.props.template.id), ['b', 'a'], 'Keep Pulse order when responses complete out of order');
  assert(text(active.state.tree).includes('pulse.displayedPeriod'), 'Show the effective fallback period');
} finally { await active.dispose(); }
console.log('Discover quiet catalog, tabs, loading/error/empty/retry, stale requests and activity ordering passed.');
