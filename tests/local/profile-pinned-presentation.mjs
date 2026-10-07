import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the page's existing ordering with pins beyond the loaded first page.
const source = await readFile(new URL('../../src/pages/Profile.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const pinnedSet =');
const end = source.indexOf('\n  return (', start);
assert(start >= 0 && end > start);
function visible(posts, extraPins, pinnedRankings, postTab) {
  const scope = vm.createContext({ posts, extraPins, pinnedRankings, postTab });
  return Array.from(vm.runInContext(`${source.slice(start, end)}\nvisiblePosts.map(post => post.id)`, scope));
}
const posts = [{ id: 'recent' }, { id: 'loaded-pin' }, { id: 'older' }];
const extra = [{ id: 'loaded-pin' }, { id: 'outside-page-pin' }];
const pins = [{ ranking_id: 'loaded-pin' }, { id: 'outside-page-pin' }];
assert.deepEqual(visible(posts, extra, pins, 'all'), ['loaded-pin', 'outside-page-pin', 'recent', 'older']);
assert.deepEqual(visible(posts, extra, pins, 'pinned'), ['loaded-pin', 'outside-page-pin']);
assert.deepEqual(visible(posts, [], [], 'all'), ['recent', 'loaded-pin', 'older']);
assert.deepEqual(visible([], [], [], 'all'), []);
assert.deepEqual(visible(posts, [], [], 'pinned'), []);
console.log('Profile pinned presentation: deduplication, off-page pins, ordering and empty states pass.');
