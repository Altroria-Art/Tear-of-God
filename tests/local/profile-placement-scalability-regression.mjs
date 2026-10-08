import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixtureProfile,fixturePosts } from './final-hybrid-p1-fixture-server.mjs';
const source=await readFile(new URL('../../src/pages/Profile.jsx',import.meta.url),'utf8');
const education=source.indexOf('profile-education');
const taste=source.indexOf('profile-taste-summary');
const rankings=source.indexOf('profile-community-content');
assert(education<taste && taste<rankings,'Student identity and taste must precede the rankings region');
assert.match(source,/grid-cols-1 sm:grid-cols-2 xl:grid-cols-3/);
assert.match(source,/element\.getBoundingClientRect\(\)\.height <= window\.innerHeight - 112/);
for(const count of [3,20,100]){
  assert.equal(fixtureProfile(`fixture${count}`).posts_count,count);
  const first=fixturePosts(`fixture${count}`);const second=fixturePosts(`fixture${count}`,2);
  assert.equal(first.length,Math.min(count,50));
  assert.equal(first.length+second.length,count);
}
const evidence=await readFile(new URL('../../artifacts/production-visual-restoration/profile-results.json',import.meta.url),'utf8').then(JSON.parse).catch(()=>null);
if(evidence){
  assert(evidence.length>=54);
  for(const row of evidence){assert.equal(row.width,row.expectedWidth);assert(row.scrollWidth<=row.width,JSON.stringify(row));assert(row.educationBefore || !row.hasEducation);assert(row.tasteBefore);assert(row.mobileEntryBeforeFeed);assert(!row.sticky || row.sidebarHeight<=row.height-112);}
}
console.log('Profile placement/scalability: education/taste order, mobile density, 3/20/100 pagination fixtures'+(evidence?' and recorded browser geometry':'')+' pass.');
