import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../../src/components/feed/VirtualFeedContainer.jsx',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const start=source.indexOf('  const updateWindow = useCallback(');
const end=source.indexOf('\n  useEffect(',start);
assert(start>=0 && end>start);
let calls=0;
const range={current:{start:0,end:11}};
const window={scrollY:0,innerHeight:800};
const context=vm.createContext({useCallback:fn=>fn,items:Array.from({length:24}),windowSize:12,bufferBefore:3,
  rangeRef:range,containerRef:{current:{getBoundingClientRect:()=>({top:-window.scrollY})}},window,
  getOffsets:()=>Float64Array.from({length:25},(_,i)=>i*440),setRange:value=>{range.current=value},triggerLoadMore:()=>calls++,
});
vm.runInContext(source.slice(start,end)+'\nthis.update=updateWindow;',context);
context.update();assert.equal(calls,0,'mount must not eagerly load the remaining pages');
window.scrollY=5280;context.update();assert.equal(calls,0,'overscan near the end is not viewport proximity');
assert.equal(range.current.end-range.current.start+1,12);
window.scrollY=9600;context.update();assert.equal(calls,1,'viewport reaching loaded content fetches another batch');
window.scrollY=0;context.update();assert.equal(range.current.start,0,'scrolling back restores the first cards');
const triggerStart=source.indexOf('  const triggerLoadMore = useCallback(');
const triggerEnd=source.indexOf('\n  // Track item',triggerStart);
let release;let requests=0;
const guard=vm.createContext({useCallback:fn=>fn,inFlightTriggerRef:{current:false},isLoadingMoreRef:{current:false},hasMoreRef:{current:true},onLoadMoreRef:{current:()=>{requests++;return new Promise(resolve=>{release=resolve})}}});
vm.runInContext(source.slice(triggerStart,triggerEnd)+'\nthis.trigger=triggerLoadMore;',guard);
for(let i=0;i<10;i++)guard.trigger();assert.equal(requests,1,'scroll and observer bursts coalesce');
release();await new Promise(resolve=>setImmediate(resolve));guard.trigger();assert.equal(requests,2,'next completed batch unlocks loading');release();
const home=await readFile(new URL('../../src/pages/HomeFeed.jsx',import.meta.url),'utf8');
assert.match(home,/windowSize=\{12\}/);assert.doesNotMatch(home,/displayData\.map|recycleCountRef/);
console.log('Actual virtual window: 12 cards, viewport-based fetching, restore scroll, duplicate trigger guard and all Home tabs passed.');

const detailSource = await readFile(new URL('../../src/pages/PostDetail.jsx', import.meta.url), 'utf8');
assert.match(detailSource, /profile: data\.profile/, 'Post Detail retains the API follow state in its mapped post');
assert.match(detailSource, /location\.state\?\.feedAction/, 'explicit Home export/share opens the full Post Detail modal');
assert.doesNotMatch(home, /await fetchRanking\(/, 'Home never fetches full placements, including export/share actions');
assert.match(home, /onExport=\{\(\) => openExport\('export'\)\}/, 'pass a serializable action, never the click event into navigation state');
assert.match(source, /useEffect\(\(\) => \{ updateWindow\(\); \}, \[updateWindow\]\)/, 'new batches update the current viewport without requiring another scroll');
