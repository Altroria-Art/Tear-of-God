import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const profile = await readFile(new URL('../../src/pages/Profile.jsx', import.meta.url), 'utf8');
const start = profile.indexOf('  const loadMorePosts = async () => {');
const end = profile.indexOf('\n  };', start) + '\n  };'.length;
assert(start >= 0 && end > start);
let resolveRequest;
let requests = 0;
let posts = [{ id: 'a' }];
let page = 1;
let more = true;
let errors = 0;
const scope = { current: 'user-a' };
const lock = { current: false };
const context = vm.createContext({
  profileScope: 'user-a', profileScopeRef: scope, profileUserId: 'user-a', postPage: 1,
  loadingPostsRef: lock, setLoadingPosts() {},
  fetchRankings: options => { assert.equal(options.page, 2); requests++; return new Promise(resolve => { resolveRequest = resolve; }); },
  setPosts: update => { posts = update(posts); }, setPostPage: update => { page = update(page); },
  setHasMorePosts: value => { more = value; }, toast: { error: () => errors++ }, t: key => key,
});
vm.runInContext(profile.slice(start, end) + '\nthis.load = loadMorePosts;', context);
let loading = context.load();
await context.load();
assert.equal(requests, 1, 'rapid clicks must share the pending lock');
resolveRequest({ data: [{ id: 'a' }, { id: 'b' }] });
await loading;
assert.deepEqual(Array.from(posts, post => post.id), ['a', 'b']);
assert.equal(page, 2);
assert.equal(more, false, 'short final page must stop pagination even with stale profile counts');
assert.equal(lock.current, false);
loading = context.load();
resolveRequest({ error: 'temporary failure' });
await loading;
assert.equal(page, 2, 'failed request must not skip a page');
assert.equal(errors, 1);
loading = context.load();
scope.current = 'user-b';
resolveRequest({ data: [{ id: 'private-old-user' }] });
await loading;
assert.deepEqual(Array.from(posts, post => post.id), ['a', 'b'], 'late old-profile result must be discarded');

const discover = await readFile(new URL('../../src/pages/Discover.jsx', import.meta.url), 'utf8');
const loadStart = discover.indexOf('    async function loadResults()');
const loadEnd = discover.indexOf('    loadResults();', loadStart);
assert(loadStart >= 0 && loadEnd > loadStart);
let params = new URLSearchParams('view=saved&page=2&q=hello');
const discoverContext = vm.createContext({
  saved: true, currentUser: { id: 'user' }, browsingResults: true, q: 'hello', page: 2, cancelled: false,
  URLSearchParams, setIsLoading() {}, setLoadError() {}, setTotal() {},
  setTemplates() { throw Error('must redirect before rendering an invalid page'); },
  fetchTemplates: async () => ({ data: [], total: 12 }),
  setParams: (update, options) => { assert.equal(options.replace, true); params = update(params); },
});
vm.runInContext(discover.slice(loadStart, loadEnd) + '\nthis.run = loadResults;', discoverContext);
await discoverContext.run();
assert.equal(params.get('page'), null);
assert.equal(params.get('view'), 'saved');
assert.equal(params.get('q'), 'hello');
console.log('Profile pagination: pending lock, deduplication, failed retry, final page and identity changes; saved-results page clamp passed.');
