import assert from 'node:assert/strict';
import { fixtureProfile, fixturePosts } from './final-hybrid-p1-fixture-server.mjs';
import { mountPage, elements, text } from './helpers/component-harness.mjs';

for (const count of [0, 3, 20, 50, 100]) {
  const id = `fixture${count}`;
  const requests = [];
  const page = await mountPage('src/pages/Profile.jsx', {
    fetchUserProfile: async userId => ({ data: fixtureProfile(userId) }),
    fetchRankings: async options => { requests.push(options); return { data: fixturePosts(options.authorId, options.page || 1, options.limit) }; },
  }, { routeParams: { userId: id }, location: { pathname: '/profile/' + id, search: '' } });
  try {
    await page.flush();
    const nodes = elements(page.state.tree);
    const header = nodes.findIndex(node => node.type === 'header' && node.props.className.includes('profile-header'));
    const education = nodes.findIndex(node => node.props.className?.includes('profile-education'));
    const content = nodes.findIndex(node => node.props.className?.includes('profile-community-content'));
    assert(header >= 0 && header < education && education < content, 'Education sits inside the header before rankings');
    assert(text(nodes[education]).includes('University:'));
    assert(text(nodes[education]).includes('Admission Year:'));
    assert.match(text(nodes.find(node => node.props.className?.includes('profile-header-joined'))), /Aug 1, 2026/, 'Join date includes the day');
    assert.deepEqual(requests[0], { authorId: id, sort: 'recent', limit: 50 });
    const tiles = () => elements(page.state.tree).filter(node => node.props.post);
    assert.equal(tiles().length, Math.min(50, count));
    if (count) {
      const grid = nodes.find(node => node.props.className?.includes('profile-ranking-grid'));
      for (const breakpoint of ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4']) assert(grid.props.className.split(' ').includes(breakpoint));
    } else assert(text(page.state.tree).includes('profile.emptyRankingsTitle'));
    const next = nodes.find(node => node.type === 'button' && text(node) === 'common.next');
    assert.equal(!!next, count > 50, 'Do not show a redundant next button');
    if (next) {
      await next.props.onClick(); await page.flush();
      assert.deepEqual(requests[1], { authorId: id, sort: 'recent', limit: 50, page: 2 });
      assert.equal(tiles().length, count);
      assert.equal(new Set(tiles().map(node => node.props.post.id)).size, count, 'Append pages without duplicate tiles');
      assert(!elements(page.state.tree).some(node => node.type === 'button' && text(node) === 'common.next'), 'No third page after all 100 rankings load');
    }
  } finally { await page.dispose(); }
}
const bare = await mountPage('src/pages/Profile.jsx', {
  fetchUserProfile: async () => ({ data: fixtureProfile('bare3') }),
  fetchRankings: async () => ({ data: [] }),
}, { routeParams: { userId: 'bare3' }, location: { pathname: '/profile/bare3', search: '' } });
try {
  await bare.flush();
  const education = elements(bare.state.tree).find(node => node.props.className?.includes('profile-education'));
  for (const label of ['University:', 'Faculty:', 'Major:', 'Admission Year:']) assert(text(education).includes(label), 'Labels stay visible when values are missing');
} finally { await bare.dispose(); }
console.log('Current Profile header/education/join date/grid and 0/3/20/50/100 pagination passed; browser geometry is checked separately.');
