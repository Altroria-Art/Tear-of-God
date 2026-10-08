import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../../src/pages/Discover.jsx',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const start=source.indexOf('  useEffect(() => {\n    if (!isQuiet)');
const end=source.indexOf('\n  }, [isQuiet, retry]);',start)+'\n  }, [isQuiet, retry]);'.length;
assert(start>=0 && end>start,'Quiet fallback effect must be found before executing its contract');
for(const mode of ['quiet','populated','failure','late']) {
  let data,loading,resolve,cleanup,requests=0;
  const scope=vm.createContext({isQuiet:mode!=='populated',retry:0,useEffect:fn=>{cleanup=fn();},setQuietTopics:v=>{data=v;},setQuietTopicsLoading:v=>{loading=v;},fetchTemplates:opts=>{assert.equal(opts.sort,'popular');assert.equal(opts.limit,6);requests++;return new Promise(r=>{resolve=r;});}});
  vm.runInContext(source.slice(start,end),scope);
  if(mode==='populated'){assert.equal(requests,0);assert.equal(data.length,0);continue;}
  if(mode==='late')cleanup();
  resolve(mode==='failure'?{error:'offline',data:[{id:'stale'}]}:{data:[{id:'real-topic'}]});
  await Promise.resolve();
  if(mode==='late'){assert.equal(data,undefined);continue;}
  assert.equal(loading,false);assert.equal(data.length,mode==='failure'?0:1);
}
assert.match(source,/isQuiet && <section/);
assert.match(source,/pulse\.popularToTry/);
assert(!source.includes('Recommended for you'));
console.log('Discover quiet fallback: real popular query, active-window suppression, failure and cancelled response pass.');
