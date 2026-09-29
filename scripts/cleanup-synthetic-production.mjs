import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isRemote = args.includes('--remote');
const targetDb = 'tear-of-god-db';
const envArg = isRemote ? '--remote' : '--local';

console.log(`Starting synthetic data cleanup (Target: ${isRemote ? 'PRODUCTION' : 'LOCAL'})`);
if (!isApply) {
  console.log('DRY-RUN MODE. Pass --apply to actually delete data.');
} else {
  console.log('APPLY MODE. Data will be deleted!');
}

const namespaces = {
  profiles: `(id GLOB 'user_[0-9][0-9][0-9]' OR id GLOB 'curator_[0-9][0-9][0-9]' OR id GLOB 'community_[0-9][0-9][0-9]' OR id GLOB 'filler_[0-9][0-9][0-9][0-9]')`,
  rankings: `(id GLOB 'rank_[0-9][0-9][0-9]' OR id GLOB 'rk_[0-9][0-9][0-9]_[0-9][0-9]')`,
  templates: `(id GLOB 'tmpl_[0-9][0-9][0-9]' OR id GLOB 'demo-up-ui-20260920-*')`,
};

function runQuery(sql) {
  const cmd = `npx wrangler d1 execute ${targetDb} ${envArg} --json --command="${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
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

console.log('\n--- 2. CROSS-CONTAMINATION CHECK ---');
console.log(`Real users who ranked a synthetic template: ${getC(`SELECT count(*) as c FROM rankings WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user comments on synthetic rankings: ${getC(`SELECT count(*) as c FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);
console.log(`Real user votes on synthetic rankings: ${getC(`SELECT count(*) as c FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})`)}`);

console.log(`\nExceptions (kept to preserve real user content):`);
console.log(`- Synthetic templates ranked by real users or referenced by preserved rankings: ${getC(`
  SELECT count(DISTINCT template_id) as c FROM rankings WHERE id IN (
    SELECT id FROM rankings WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    UNION
    SELECT ranking_id as id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    UNION
    SELECT ranking_id as id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
  )`)}`);
console.log(`- Synthetic rankings with real user comments/votes: ${getC(`
  SELECT count(DISTINCT id) as c FROM (
    SELECT ranking_id as id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    UNION
    SELECT ranking_id as id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
  )`)}`);
console.log(`- Synthetic profiles authoring those rankings: ${getC(`
  SELECT count(DISTINCT user_id) as c FROM rankings WHERE id IN (
    SELECT ranking_id as id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    UNION
    SELECT ranking_id as id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
  )`)}`);

if (isApply) {
  console.log('\n--- 3. DELETION ---');
  console.log('WARNING: Make sure you backed up the database first!');
  
  const deleteStmts = `
  PRAGMA foreign_keys = ON;

  DELETE FROM profiles WHERE ${namespaces.profiles} AND id NOT IN (
    SELECT user_id FROM rankings WHERE id IN (
      SELECT ranking_id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
      UNION
      SELECT ranking_id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    )
  );

  DELETE FROM templates WHERE ${namespaces.templates} AND id NOT IN (
    SELECT template_id FROM rankings WHERE id IN (
      SELECT id FROM rankings WHERE (${namespaces.templates.replace(/id GLOB/g, 'template_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
      UNION
      SELECT ranking_id as id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
      UNION
      SELECT ranking_id as id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    )
  );

  DELETE FROM rankings WHERE ${namespaces.rankings} AND id NOT IN (
    SELECT ranking_id FROM comments WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
    UNION
    SELECT ranking_id FROM votes WHERE (${namespaces.rankings.replace(/id GLOB/g, 'ranking_id GLOB')}) AND NOT (${namespaces.profiles.replace(/id GLOB/g, 'user_id GLOB')})
  );

  DELETE FROM items WHERE id NOT IN (SELECT item_id FROM template_items) AND id NOT IN (SELECT item_id FROM ranking_items);
  
  -- Post-cleanup reconciliation
  UPDATE rankings SET
      likes_count = (SELECT count(*) FROM votes WHERE ranking_id = rankings.id AND vote_type = 'like'),
      dislikes_count = (SELECT count(*) FROM votes WHERE ranking_id = rankings.id AND vote_type = 'dislike'),
      comments_count = (SELECT count(*) FROM comments WHERE ranking_id = rankings.id);
  `;
  writeFileSync('temp-delete.sql', deleteStmts, 'utf-8');
  const cmdDelete = `npx wrangler d1 execute ${targetDb} ${envArg} --file=temp-delete.sql`;
  const deleteOut = execSync(cmdDelete, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log(deleteOut);
  unlinkSync('temp-delete.sql');
  console.log('Cleanup and reconciliation applied successfully.');
} else {
  console.log('\n--- 3. DRY RUN DELETION ESTIMATE ---');
  console.log('To execute the deletion, run with --apply');
}

