// Browser QA only: serves the real build against deterministic in-memory API data.
// No D1 binding, credentials, production network or persistence. All mutations reject.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const tiers = [{label:'ร้านประจำ',color:'bg-[#ff7f7f]'}, {label:'อร่อย',color:'bg-[#ffbf7f]'}];
export function fixtureProfile(id = 'fixture3') {
  const count = Number(id.match(/\d+/)?.[0] || 3);
  const emptyIdentity = id.includes('bare');
  return {id,username:id.includes('long') ? 'นักศึกษามหาวิทยาลัยพะเยาผู้ชอบจัดอันดับร้านกาแฟและแสดงความคิดเห็นกับเพื่อนๆ'.repeat(2) : 'นักศึกษาทดสอบ UX',bio:'ข้อมูลจำลองสำหรับทดสอบการอ่านรสนิยม',posts_count:count,followers_count:2,following_count:1,created_at:'2026-08-01 00:00:00',
    ...(emptyIdentity ? {} : {university:'มหาวิทยาลัยพะเยา',faculty:'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',major:'สาขาวิชาวิศวกรรมซอฟต์แวร์และระบบสารสนเทศที่มีชื่อยาว',year:'67'}),
    taste_identity:emptyIdentity ? {} : {hashtag_distribution:[{hashtag:'กาแฟ',percentage:60},{hashtag:'มพ',percentage:40}],top_items:[{id:'coffee',name:'Agri Coffee Pavilion'}],badges:[]}};
}
export function fixturePosts(id, page = 1, limit = 50) {
  const count=fixtureProfile(id).posts_count;
  return Array.from({length:Math.max(0,Math.min(limit,count-(page-1)*limit))},(_,n)=>({id:`${id}-post-${(page-1)*limit+n}`,title:`อันดับ ${(page-1)*limit+n+1} · ร้านกาแฟในมหาวิทยาลัยพะเยา`,hashtags:'["กาแฟ","มพ"]',created_at:'2026-10-01 00:00:00',tiers,is_original:true,stats:{likes:2,comments:1},ranking_items:[{tier:'ร้านประจำ',item:{id:'coffee',name:'Agri Coffee Pavilion'}},{tier:'อร่อย',item:{id:'library',name:'ร้านกาแฟห้องสมุดมหาวิทยาลัยพะเยา'}}]}));
}
let fallbackFailure=false;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='GET') return json({error:'Fixture server rejects all mutations'},405);
  if(url.pathname==='/api/auth') return json({data:fixtureProfile()});
  if(url.pathname==='/api/users') return json({data:fixtureProfile(url.searchParams.get('id'))});
  if(url.pathname==='/api/rankings') return json({data:fixturePosts(url.searchParams.get('author_id')||'fixture3',Number(url.searchParams.get('page')||1),Number(url.searchParams.get('limit')||50))});
  if(url.pathname==='/api/discover-pulse') {
    const period=url.searchParams.get('window')||'now';fallbackFailure=period==='last_week';
    return json({success:true,window:period,active_rankings:period==='week'?3:0,topics:period==='week'?[{key:'coffee',label:'หัวข้อกาแฟที่กำลังมี activity ใน fixture',href:'/template/coffee',ranking_count:3}]:[],rankings:[],templates:[],hashtags:[],discussions:[]});
  }
  if(url.pathname==='/api/templates') return fallbackFailure ? json({error:'Simulated fallback failure'},503) : json({data:Array.from({length:6},(_,i)=>({id:`topic${i}`,title:`หัวข้อจำลอง ${i+1} · กาแฟ`,profile:fixtureProfile(),use_count:20-i,template_items:[{item_id:'coffee',item:{name:'Agri Coffee Pavilion'}},{item_id:'library',item:{name:'ร้านกาแฟห้องสมุด'}}],tiers})),total:6});
  if(url.pathname.startsWith('/api/')) return json({data:[],success:true,ids:[],unreadCount:0});
  try {
    const filename=path.resolve(root, '.'+url.pathname);
    if(!filename.startsWith(root+path.sep)&&filename!==root) return json({error:'Invalid path'},400);
    const ext=path.extname(filename);
    const data=await readFile(ext?filename:path.join(root,'index.html'));
    res.writeHead(200,{'Content-Type':mime[ext]||'text/html','Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
if(process.argv[1]===fileURLToPath(import.meta.url)) server.listen(8790,'127.0.0.1',()=>console.log('Read-only fixture QA: http://127.0.0.1:8790'));
