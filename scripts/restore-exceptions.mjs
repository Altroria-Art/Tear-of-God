import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const backup = readFileSync('.d1-backups/prod-before-synthetic-cleanup-20260930-0349.sql', 'utf-8');

const missingTemplates = ['tmpl_006', 'tmpl_009', 'tmpl_019', 'tmpl_027', 'tmpl_028', 'tmpl_029', 'tmpl_030', 'tmpl_031', 'tmpl_033', 'tmpl_036', 'tmpl_059', 'tmpl_063', 'tmpl_064'];

let restoreSql = 'PRAGMA foreign_keys = OFF;\n';

for (const tmpl of missingTemplates) {
  const tMatch = backup.match(new RegExp(`INSERT INTO "templates".*?VALUES\\('${tmpl}'.*?\\);`, 'g'));
  if (tMatch) restoreSql += tMatch[0] + '\n';
  
  const itemsMatch = backup.match(new RegExp(`INSERT INTO "template_items".*?VALUES\\('[^']*','${tmpl}'.*?\\);`, 'g'));
  if (itemsMatch) {
    itemsMatch.forEach(m => restoreSql += m + '\n');
  }
}

const realUserCommentsMatches = [...backup.matchAll(/INSERT INTO "comments".*?VALUES\('([^']*)','([^']*)','([^']*)',(.*)\);/g)];
const realUserVotesMatches = [...backup.matchAll(/INSERT INTO "votes".*?VALUES\('([^']*)','([^']*)','([^']*)',(.*)\);/g)];

const isRealUser = (id) => id && !id.startsWith('community_') && !id.startsWith('curator_') && !id.startsWith('filler_') && !(id.startsWith('user_') && id.length < 10);

const exceptionRankingIds = new Set();
for (const match of realUserCommentsMatches) {
  if (isRealUser(match[3])) exceptionRankingIds.add(match[2]);
}
for (const match of realUserVotesMatches) {
  if (isRealUser(match[3])) exceptionRankingIds.add(match[2]);
}

for (const rid of exceptionRankingIds) {
  const rMatch = backup.match(new RegExp(`INSERT INTO "rankings".*?VALUES\\('${rid}'.*?\\);`, 'g'));
  if (rMatch) restoreSql += rMatch[0] + '\n';
  
  const rkiMatch = backup.match(new RegExp(`INSERT INTO "ranking_items".*?VALUES\\('[^']*','${rid}'.*?\\);`, 'g'));
  if (rkiMatch) rkiMatch.forEach(m => restoreSql += m + '\n');
}

const itemsMatch = backup.match(/INSERT INTO "items".*?VALUES.*?;/g);
if (itemsMatch) {
  itemsMatch.forEach(m => {
    restoreSql += m.replace('INSERT INTO', 'INSERT OR IGNORE INTO') + '\n';
  });
}

for (const match of realUserCommentsMatches) {
  if (isRealUser(match[3]) && exceptionRankingIds.has(match[2])) {
    restoreSql += `INSERT OR IGNORE INTO "comments" ("id","ranking_id","user_id","content","created_at","parent_id") VALUES('${match[1]}','${match[2]}','${match[3]}',${match[4]});\n`;
  }
}
for (const match of realUserVotesMatches) {
  if (isRealUser(match[3]) && exceptionRankingIds.has(match[2])) {
    restoreSql += `INSERT OR IGNORE INTO "votes" ("id","ranking_id","user_id","vote_type") VALUES('${match[1]}','${match[2]}','${match[3]}',${match[4]});\n`;
  }
}

writeFileSync('restore-exceptions.sql', restoreSql);
console.log(`Generated restore script for ${missingTemplates.length} templates and ${exceptionRankingIds.size} rankings.`);
