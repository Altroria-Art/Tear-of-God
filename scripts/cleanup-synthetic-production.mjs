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

console.log(`Starting synthetic data completeness audit (Target: ${isRemote ? 'PRODUCTION' : 'LOCAL'})`);
console.log('Mode: READ-ONLY (No destructive actions will be performed)');

const isProfileSynth = (col) => `(${col} GLOB 'user_[0-9][0-9][0-9]' OR ${col} GLOB 'curator_[0-9][0-9][0-9]' OR ${col} GLOB 'community_[0-9][0-9][0-9]' OR ${col} GLOB 'filler_[0-9][0-9][0-9][0-9]')`;
// A real user is ANY user ID that does NOT match the known synthetic namespaces. Do not assume 'user_'.
const isRealUser = (col) => `(${col} IS NOT NULL AND NOT ${isProfileSynth(col)})`;
const isRankingSynth = (col) => `(${col} GLOB 'rank_[0-9][0-9][0-9]' OR ${col} GLOB 'rk_[0-9][0-9][0-9]_[0-9][0-9]')`;
const isTemplateSynth = (col) => `(${col} GLOB 'tmpl_[0-9][0-9][0-9]' OR ${col} GLOB 'demo-up-ui-20260920-*')`;

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

console.log('\n--- 1. AUDIT COUNTS (SAFE SYNTHETIC DATA) ---');
console.log(`profiles        Total: ${String(getC(`SELECT count(*) as c FROM profiles`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM profiles WHERE ${isProfileSynth('id')}`)}`);
console.log(`rankings        Total: ${String(getC(`SELECT count(*) as c FROM rankings`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM rankings WHERE ${isRankingSynth('id')}`)}`);
console.log(`templates       Total: ${String(getC(`SELECT count(*) as c FROM templates`)).padEnd(6)} Synthetic: ${getC(`SELECT count(*) as c FROM templates WHERE ${isTemplateSynth('id')}`)}`);

console.log('\n--- 2. ADOPTED REAL-USER CONTENT (Must be preserved) ---');
console.log(`rankings                       Real users ranked synthetic templates: ${getC(`SELECT count(*) as c FROM rankings WHERE ${isTemplateSynth('template_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`comments                       Real user comments on synthetic rankings: ${getC(`SELECT count(*) as c FROM comments WHERE ${isRankingSynth('ranking_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`votes                          Real user votes on synthetic rankings: ${getC(`SELECT count(*) as c FROM votes WHERE ${isRankingSynth('ranking_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`template_bookmarks             Real user bookmarks on synthetic templates: ${getC(`SELECT count(*) as c FROM template_bookmarks WHERE ${isTemplateSynth('template_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`template_user_contributions    Real user contributions to synthetic templates: ${getC(`SELECT count(*) as c FROM template_user_contributions WHERE ${isTemplateSynth('template_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`template_reactions             Real user reactions on synthetic templates: ${getC(`SELECT count(*) as c FROM template_reactions WHERE ${isTemplateSynth('template_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`template_comments              Real user comments on synthetic templates: ${getC(`SELECT count(*) as c FROM template_comments WHERE ${isTemplateSynth('template_id')} AND ${isRealUser('user_id')}`)}`);
console.log(`profile_pins                   Real user pinned a synthetic ranking: ${getC(`SELECT count(*) as c FROM profile_pins WHERE ${isRankingSynth('ranking_id')} AND ${isRealUser('user_id')}`)}`);

console.log('\n--- 3. BOT-DEPENDENT INTERACTIONS (May be intentionally retired) ---');
console.log(`follows                        Real user following synthetic profile: ${getC(`SELECT count(*) as c FROM follows WHERE ${isRealUser('follower_id')} AND ${isProfileSynth('following_id')}`)}`);
console.log(`follows                        Synthetic profile following real user: ${getC(`SELECT count(*) as c FROM follows WHERE ${isProfileSynth('follower_id')} AND ${isRealUser('following_id')}`)}`);
console.log(`duels                          Real user dueling synthetic owner: ${getC(`SELECT count(*) as c FROM duels WHERE ${isRealUser('challenger_id')} AND ${isProfileSynth('owner_id')}`)}`);
console.log(`duels                          Synthetic challenger dueling real owner: ${getC(`SELECT count(*) as c FROM duels WHERE ${isProfileSynth('challenger_id')} AND ${isRealUser('owner_id')}`)}`);

console.log('\n--- 4. MODERATION/SYSTEM REFERENCES ---');
console.log(`reports                        Filed by synthetic users: ${getC(`SELECT count(*) as c FROM reports WHERE ${isProfileSynth('reporter_id')}`)}`);
console.log(`reports                        Filed by real users against synthetic content: ${getC(`SELECT count(*) as c FROM reports WHERE ${isRealUser('reporter_id')} AND (${isTemplateSynth('template_id')} OR ${isRankingSynth('ranking_id')})`)}`);
console.log(`notifications                  Sent TO real users FROM synthetic actors: ${getC(`SELECT count(*) as c FROM notifications WHERE ${isRealUser('user_id')} AND ${isProfileSynth('actor_id')}`)}`);
console.log(`notifications                  Sent TO synthetic users FROM real actors: ${getC(`SELECT count(*) as c FROM notifications WHERE ${isProfileSynth('user_id')} AND ${isRealUser('actor_id')}`)}`);
console.log(`topic_follows                  Synthetic user followed a topic: ${getC(`SELECT count(*) as c FROM topic_follows WHERE ${isProfileSynth('user_id')}`)}`);

console.log('\n--- 5. LOGICAL ORPHANS (Data Integrity Risks) ---');
console.log(`template_views                 Orphaned template views: ${getC(`SELECT count(*) as c FROM template_views WHERE template_id NOT IN (SELECT id FROM templates)`)}`);
console.log(`templates                      Missing creator_id: ${getC(`SELECT count(*) as c FROM templates WHERE creator_id IS NOT NULL AND creator_id NOT IN (SELECT id FROM profiles)`)}`);

console.log('\nAudit complete. To execute a cleanup, build an explicit SQL script based on these findings and carefully review it before running.');
