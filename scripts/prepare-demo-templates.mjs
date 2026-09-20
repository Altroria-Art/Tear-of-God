import { readFileSync, writeFileSync } from 'node:fs';
import { demoTemplateCatalog } from './demo-template-catalog.mjs';

// Generates INSERT-only SQL. It does not connect to or mutate any database.
const [preflightPath, outputPath] = process.argv.slice(2);
if (!preflightPath || !outputPath) throw new Error('Usage: node scripts/prepare-demo-templates.mjs preflight.json output.sql');
const preflight = JSON.parse(readFileSync(preflightPath, 'utf8').replace(/^\uFEFF/, ''));
if (preflight.some(result => !result.success)) throw new Error('Preflight failed');
if (preflight[3].results[0].existing_demo !== 0) throw new Error('Demo namespace already exists; inspect before proceeding');
const bots = preflight[0].results.map(row => row.id).filter(id => /^community_\d{3}$/.test(id));
if (bots.length < 30) throw new Error('Need at least 30 preverified existing test accounts');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const eligible = id => `EXISTS (SELECT 1 FROM profiles WHERE id = ${quote(id)} AND lower(email) LIKE '%@example.com')`;
const likes = [24, 21, 18, 15, 8, 6, 5, 4, 3, 2];
const dislikes = [1, 2, 1, 2, 1, 1, 2, 1, 1, 1];
const comments = [5, 4, 5, 4, 3, 2, 3, 2, 3, 2];
const statements = [];
const manifest = [];
for (const [index, template] of demoTemplateCatalog.entries()) {
  const author = bots[index];
  const tid = quote(template.id);
  statements.push(`INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) SELECT ${tid}, ${quote(author)}, ${quote(template.title)}, ${quote(template.description)}, ${quote(template.hashtags)}, ${quote(JSON.stringify(template.tiers))} WHERE ${eligible(author)} ON CONFLICT(id) DO NOTHING;`);
  const scope = `EXISTS (SELECT 1 FROM templates WHERE id = ${tid} AND creator_id = ${quote(author)}) AND ${eligible(author)}`;
  for (const [position, item] of template.items.entries()) {
    // Existing items with the same natural ID are reused, never edited.
    statements.push(`INSERT INTO items (id, name) SELECT ${quote(item)}, ${quote(item)} WHERE ${scope} ON CONFLICT(id) DO NOTHING;`);
    statements.push(`INSERT INTO template_items (id, template_id, item_id, tier, position) SELECT ${quote(`${template.id}-item-${position}`)}, ${tid}, ${quote(item)}, ${quote(template.tiers[Math.floor(position / 2) % 5].label)}, ${position} WHERE ${scope} ON CONFLICT(id) DO NOTHING;`);
  }
  const reactionBots = [];
  for (let j = 0; j < likes[index] + dislikes[index]; j++) {
    const bot = bots[(index * 3 + j + 1) % bots.length];
    const vote = j < likes[index] ? 'like' : 'dislike';
    reactionBots.push({ id: bot, vote });
    statements.push(`INSERT INTO template_reactions (id, template_id, user_id, vote_type) SELECT ${quote(`${template.id}-vote-${bot}`)}, ${tid}, ${quote(bot)}, ${quote(vote)} WHERE ${scope} AND ${eligible(bot)} ON CONFLICT DO NOTHING;`);
  }
  const commentBots = [];
  for (let j = 0; j < comments[index]; j++) {
    const bot = bots[(index * 3 + j + 1) % bots.length];
    commentBots.push(bot);
    const text = [
      `[ข้อมูลทดสอบ] ลองจัด ${template.items[0]} ไว้ระดับ S เพื่อดูการแสดงผล`,
      `[ข้อมูลทดสอบ] อยากลองเทียบ ${template.items[1]} กับ ${template.items[2]}`,
      `[ข้อมูลทดสอบ] รายการ ${template.items[3]} ใช้ทดสอบชื่อไอเทมบนมือถือ`,
      `[ข้อมูลทดสอบ] ลองจัดอันดับต่างกันแล้วเปรียบเทียบมุมมองของแต่ละคน`,
      `[ข้อมูลทดสอบ] ใช้คอมเมนต์นี้ตรวจจำนวนและลำดับข้อความในหน้าเทมเพลต`,
    ][j];
    statements.push(`INSERT INTO template_comments (id, template_id, user_id, content, parent_id) SELECT ${quote(`${template.id}-comment-${j}`)}, ${tid}, ${quote(bot)}, ${quote(text)}, NULL WHERE ${scope} AND ${eligible(bot)} ON CONFLICT(id) DO NOTHING;`);
  }
  manifest.push({ id: template.id, title: template.title, author, likes: likes[index], dislikes: dislikes[index], comments: comments[index], reactionBots, commentBots });
}
writeFileSync(outputPath, statements.join('\n') + '\n');
writeFileSync(outputPath + '.manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ templates: manifest.length, statements: statements.length, likes: likes.reduce((a,b)=>a+b), dislikes: dislikes.reduce((a,b)=>a+b), comments: comments.reduce((a,b)=>a+b) }));
