/**
 * Synthetic Data Cleanup Audit Tool
 * 
 * This script identifies synthetic profiles, rankings, and templates,
 * and highlights any cross-contamination with real user data (e.g. real users
 * ranking a synthetic template, or commenting on a synthetic ranking).
 * 
 * NOTE: This is a READ-ONLY audit tool. 
 * DO NOT add an `--apply` flag or generic deletion SQL here.
 * D1 cascading deletes are not completely reliable. Any cleanup must be 
 * done via a carefully reviewed, exact-ID explicit SQL script.
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const targetDb = 'tear-of-god-db';
const envArg = isRemote ? '--remote' : '--local';

console.log(`Starting synthetic data audit (Target: ${isRemote ? 'PRODUCTION' : 'LOCAL'})`);
console.log('Mode: READ-ONLY (No destructive actions will be performed)');

const namespaces = {
  profiles: `(id GLOB 'user_[0-9][0-9][0-9]' OR id GLOB 'curator_[0-9][0-9][0-9]' OR id GLOB 'community_[0-9][0-9][0-9]' OR id GLOB 'filler_[0-9][0-9][0-9][0-9]')`,
  rankings: `(id GLOB 'rank_[0-9][0-9][0-9]' OR id GLOB 'rk_[0-9][0-9][0-9]_[0-9][0-9]')`,
  templates: `(id GLOB 'tmpl_[0-9][0-9][0-9]' OR id GLOB 'demo-up-ui-20260920-*')`,
};

function runQuery(sql) {
  const cmd = `npx wrangler d1 execute ${targetDb} ${envArg} --json --command="${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const jsonMatch = stdout.match(/\[\s*\{.*\}\s*\]/s);
    if (!jsonMatch) return JSON.parse(stdout)[0].results;
    return JSON.parse(jsonMatch[0])[0].results;
  } catch (err) {
    console.error('Query failed:', sql);
    console.error(err.stderr || err.message);
    process.exit(1);
  }
}

const getC = (sql) => {
  const res = runQuery(sql);
  return res && res[0] ? res[0].c : 0;
};

console.log('\n--- 1. AUDIT COUNTS ---');
console.log(`profiles        Total: ${String(getC(`SELECT count(*) as c FROM profiles`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM profiles WHERE ${namespaces.profiles}`)}`);
console.log(`rankings        Total: ${String(getC(`SELECT count(*) as c FROM rankings`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM rankings WHERE ${namespaces.rankings}`)}`);
console.log(`templates       Total: ${String(getC(`SELECT count(*) as c FROM templates`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM templates WHERE ${namespaces.templates}`)}`);

console.log('\n--- 2. ADOPTED CONTENT (Must be preserved) ---');
console.log(`Real users who ranked a synthetic template: ${getC(`SELECT count(*) as c FROM rankings WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user comments on synthetic rankings: ${getC(`SELECT count(*) as c FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user votes on synthetic rankings: ${getC(`SELECT count(*) as c FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user bookmarks on synthetic templates: ${getC(`SELECT count(*) as c FROM template_bookmarks WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user contributions to synthetic templates: ${getC(`SELECT count(*) as c FROM template_user_contributions WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);

console.log('\n--- 3. BOT-DEPENDENT INTERACTIONS (To be retired) ---');
console.log(`Real user follows involving synthetic profiles: ${getC(`SELECT count(*) as c FROM follows WHERE (follower_id GLOB 'user_*' AND NOT ${namespaces.profiles.replace(/id GLOB/g, 'follower_id GLOB')}) AND (${namespaces.profiles.replace(/id GLOB/g, 'following_id GLOB')})`)}`);
console.log(`Real user duels against synthetic profiles: ${getC(`SELECT count(*) as c FROM duels WHERE (challenger_id GLOB 'user_*' AND NOT ${namespaces.profiles.replace(/id GLOB/g, 'challenger_id GLOB')}) AND (${namespaces.profiles.replace(/id GLOB/g, 'owner_id GLOB')})`)}`);

console.log('\n--- 4. AMBIGUOUS CASES (Requires Manual Review) ---');
console.log('Check for any unexpected cascading dependencies like missing templates for existing views.');
const orphanViews = getC(`SELECT count(*) as c FROM template_views WHERE template_id NOT IN (SELECT id FROM templates)`);
console.log(`Orphaned template views: ${orphanViews}`);
const invalidCreators = getC(`SELECT count(*) as c FROM templates WHERE creator_id IS NOT NULL AND creator_id NOT IN (SELECT id FROM profiles)`);
console.log(`Templates with missing creator_id (needs NULLing): ${invalidCreators}`);

console.log('\nAudit complete. To execute a cleanup, build an explicit SQL script based on these findings and carefully review it before running.');
