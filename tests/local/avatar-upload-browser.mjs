import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from './helpers/chromium.mjs';

const source = (await readFile(new URL('../../src/lib/avatarUpload.js',import.meta.url),'utf8')).replace('export async function','async function');
const browser = await chromium({ port:9382 });
try {
  const page = await browser.page();
  const result = await page.evaluate(`(async()=>{
    ${source}
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(1600,900);let seed=123;
    for(let y=0;y<900;y++)for(let x=0;x<1600;x++){
      const pos=(y*1600+x)*4;
      for(let c=0;c<3;c++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data.data[pos+c]=seed>>>24;}
      data.data[pos+3]=x<64&&y<64?0:255;
    }
    ctx.putImageData(data,0,0);
    const checks=[];
    for(const type of ['image/png','image/jpeg']){
      const blob=await new Promise(r=>canvas.toBlob(r,type,0.95));
      const file=new File([blob],'avatar.'+(type==='image/png'?'png':'jpg'),{type});
      const output=await prepareAvatarUpload(file),bitmap=await createImageBitmap(output);
      const check={type,input:file.size,output:output.size,width:bitmap.width,height:bitmap.height,mime:output.type};
      if(type==='image/png'){
        const pixel=document.createElement('canvas');pixel.width=bitmap.width;pixel.height=bitmap.height;
        const pctx=pixel.getContext('2d');pctx.drawImage(bitmap,0,0);check.alpha=pctx.getImageData(0,0,1,1).data[3];
      }
      bitmap.close();checks.push(check);
    }
    const gif=new File([Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0))],'animated.gif',{type:'image/gif'});
    const corrupt=new File(['broken'],'broken.png',{type:'image/png'});
    const unsupported=new File(['webp'],'animated.webp',{type:'image/webp'});
    const apng=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,8,97,99,84,76,0,0,0,2,0,0,0,0,0,0,0,0])],'animated.png',{type:'image/png'});
    const unchanged=[];
    for(const file of [gif,corrupt,unsupported,apng])unchanged.push(await prepareAvatarUpload(file)===file);
    const create=createImageBitmap;globalThis.createImageBitmap=undefined;
    unchanged.push(await prepareAvatarUpload(corrupt)===corrupt);globalThis.createImageBitmap=create;
    return {checks,unchanged};
  })()`);
  for (const check of result.checks) {
    assert.equal(check.width,512);assert.equal(check.height,288);
    assert.equal(check.mime,'image/webp');
    assert(check.output<check.input/4,JSON.stringify(check));
    if(check.type==='image/png')assert.equal(check.alpha,0,'Transparent avatars keep their alpha');
  }
  assert(result.unchanged.every(Boolean),'Animations, unsupported/corrupt files and missing codec keep the original');
  assert.deepEqual(page.errors,[]);
  console.log(JSON.stringify({browser:browser.version,...result}));
  console.log('Avatar dimensions, smaller upload, transparency, animation preservation and fallback checks passed.');
} finally { await browser.close(); }
