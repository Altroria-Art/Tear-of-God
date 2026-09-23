// Backfill ranking_item_scores for historical rankings with template_id.
// Formula:
//   tierIndex = index of tier label in template.tiers (0-based)
//   score = tierCount - tierIndex
// Items with tier: null are excluded. Duplicate rows are prevented.
//
// Usage:
//   Preview local:   node scripts/backfill-scores.mjs --preview
//   Execute local:   node scripts/backfill-scores.mjs --execute
//   Preview remote:  node scripts/backfill-scores.mjs --remote --preview
//   Execute remote:  node scripts/backfill-scores.mjs --remote --execute
//   Explicit file:   node scripts/backfill-scores.mjs path/to/database.sqlite [--execute]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const isExecute = args.includes('--execute') || args.includes('--run');
const explicitPath = args.find((a) => !a.startsWith('--'));

function findLocalD1Path() {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      console.error(`Error: File not found: ${explicitPath}`);
      process.exit(1);
    }
    return explicitPath;
  }
  const dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!fs.existsSync(dir)) {
    console.error('Error: Local D1 directory not found (.wrangler/state/v3/d1/miniflare-D1DatabaseObject)');
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  if (files.length === 0) {
    console.error('Error: No sqlite database found in local D1 directory.');
    process.exit(1);
  }
  return path.join(dir, files[0]);
}

import { execSync } from 'node:child_process';

function runWranglerJson(sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  const cmd = `npx wrangler d1 execute tear-of-god-db --remote --json --command="${cleanSql.replace(/"/g, '\\"')}"`;
  const result = execSync(cmd, { encoding: 'utf8' });
  const start = result.indexOf('[');
  const end = result.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error(`Invalid JSON output from wrangler: ${result}`);
  }
  const parsed = JSON.parse(result.slice(start, end + 1));
  return parsed[0]?.results || [];
}

function runWranglerFile(filePath) {
  const result = execFileSync('npx.cmd', ['wrangler', 'd1', 'execute', 'tear-of-god-db', '--remote', `--file=${filePath}`], {
    encoding: 'utf8',
    shell: true,
  });
  return result;
}

const BACKFILL_SQL = `
INSERT OR IGNORE INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score, created_at)
SELECT
  lower(hex(randomblob(16))) AS id,
  r.id AS ranking_id,
  r.template_id,
  ri.item_id,
  CAST(j.key AS INTEGER) AS tier_index,
  (json_array_length(t.tiers) - CAST(j.key AS INTEGER)) AS score,
  COALESCE(r.created_at, CURRENT_TIMESTAMP) AS created_at
FROM rankings r
JOIN templates t ON r.template_id = t.id
JOIN ranking_items ri ON ri.ranking_id = r.id
JOIN json_each(t.tiers) j ON json_extract(j.value, '$.label') = ri.tier
WHERE r.template_id IS NOT NULL
  AND ri.tier IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ranking_item_scores ris
    WHERE ris.ranking_id = r.id AND ris.item_id = ri.item_id
  );
`;

async function handleRemote() {
  console.log('=== Cloudflare D1 Remote Backfill: ranking_item_scores ===\n');

  console.log('Fetching remote statistics...');
  const totalRankings = (runWranglerJson('SELECT COUNT(*) as n FROM rankings WHERE template_id IS NOT NULL'))[0]?.n || 0;
  const existingScores = (runWranglerJson('SELECT COUNT(*) as n FROM ranking_item_scores'))[0]?.n || 0;
  const missingRankings = (runWranglerJson(`
    SELECT COUNT(DISTINCT r.id) as n
    FROM rankings r
    WHERE r.template_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ranking_item_scores ris WHERE ris.ranking_id = r.id)
  `))[0]?.n || 0;
  const itemsBreakdown = (runWranglerJson(`
    SELECT
      COUNT(ri.id) as total_items,
      COUNT(CASE WHEN ri.tier IS NOT NULL THEN 1 END) as tiered_items,
      COUNT(CASE WHEN ri.tier IS NULL THEN 1 END) as untiered_items
    FROM ranking_items ri
    JOIN rankings r ON ri.ranking_id = r.id
    WHERE r.template_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ranking_item_scores ris WHERE ris.ranking_id = r.id)
  `))[0] || {};
  const matchesToScore = (runWranglerJson(`
    SELECT COUNT(*) as matches
    FROM rankings r
    JOIN templates t ON r.template_id = t.id
    JOIN ranking_items ri ON ri.ranking_id = r.id
    JOIN json_each(t.tiers) j ON json_extract(j.value, '$.label') = ri.tier
    WHERE r.template_id IS NOT NULL
      AND ri.tier IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ranking_item_scores ris
        WHERE ris.ranking_id = r.id AND ris.item_id = ri.item_id
      )
  `))[0]?.matches || 0;

  console.log('--- Remote Preview Summary ---');
  console.log(`• Total rankings with template:       ${totalRankings}`);
  console.log(`• Current ranking_item_scores rows:   ${existingScores}`);
  console.log(`• Rankings missing scores:            ${missingRankings}`);
  console.log(`• Item rows to be scored:             ${matchesToScore}`);
  console.log(`• Untiered items skipped (tier:null): ${itemsBreakdown.untiered_items || 0}`);
  console.log('------------------------------\n');

  if (!isExecute) {
    console.log('ℹ️  Preview completed (Dry Run). No changes were made to remote D1.');
    console.log('👉 To execute backfill on remote D1, run:');
    console.log('   node scripts/backfill-scores.mjs --remote --execute\n');
    return;
  }

  console.log('Executing backfill on remote D1...');
  const sqlFile = path.resolve('scripts/sql/backfill-ranking-scores.sql');
  const execResult = runWranglerFile(sqlFile);
  console.log(execResult);

  const newScores = (runWranglerJson('SELECT COUNT(*) as n FROM ranking_item_scores'))[0]?.n || 0;
  console.log(`✅ Remote Backfill complete: scores increased from ${existingScores} to ${newScores} (+${newScores - existingScores})`);
}

async function handleLocal() {
  const dbPath = findLocalD1Path();
  console.log(`=== Local D1 Backfill: ranking_item_scores ===`);
  console.log(`Database: ${dbPath}\n`);

  const db = new DatabaseSync(dbPath);

  const hasTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ranking_item_scores'"
  ).get();
  if (!hasTable) {
    console.error('Error: ranking_item_scores table does not exist. Apply schema.sql first.');
    process.exit(1);
  }

  const totalRankings = db.prepare('SELECT COUNT(*) as n FROM rankings WHERE template_id IS NOT NULL').get().n;
  const existingScores = db.prepare('SELECT COUNT(*) as n FROM ranking_item_scores').get().n;
  const missingRankings = db.prepare(`
    SELECT COUNT(DISTINCT r.id) as n
    FROM rankings r
    WHERE r.template_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ranking_item_scores ris WHERE ris.ranking_id = r.id)
  `).get().n;
  const itemsBreakdown = db.prepare(`
    SELECT
      COUNT(ri.id) as total_items,
      COUNT(CASE WHEN ri.tier IS NOT NULL THEN 1 END) as tiered_items,
      COUNT(CASE WHEN ri.tier IS NULL THEN 1 END) as untiered_items
    FROM ranking_items ri
    JOIN rankings r ON ri.ranking_id = r.id
    WHERE r.template_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ranking_item_scores ris WHERE ris.ranking_id = r.id)
  `).get();
  const matchesToScore = db.prepare(`
    SELECT COUNT(*) as matches
    FROM rankings r
    JOIN templates t ON r.template_id = t.id
    JOIN ranking_items ri ON ri.ranking_id = r.id
    JOIN json_each(t.tiers) j ON json_extract(j.value, '$.label') = ri.tier
    WHERE r.template_id IS NOT NULL
      AND ri.tier IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ranking_item_scores ris
        WHERE ris.ranking_id = r.id AND ris.item_id = ri.item_id
      )
  `).get().matches;

  // Breakdown of top templates needing backfill
  const topTemplates = db.prepare(`
    SELECT t.id, t.title, COUNT(DISTINCT r.id) as missing_rankings, COUNT(ri.id) as items_to_score
    FROM templates t
    JOIN rankings r ON r.template_id = t.id
    JOIN ranking_items ri ON ri.ranking_id = r.id
    JOIN json_each(t.tiers) j ON json_extract(j.value, '$.label') = ri.tier
    WHERE ri.tier IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ranking_item_scores ris
        WHERE ris.ranking_id = r.id AND ris.item_id = ri.item_id
      )
    GROUP BY t.id
    ORDER BY missing_rankings DESC
    LIMIT 5
  `).all();

  console.log('--- Local Preview Summary ---');
  console.log(`• Total rankings with template:       ${totalRankings}`);
  console.log(`• Current ranking_item_scores rows:   ${existingScores}`);
  console.log(`• Rankings missing scores:            ${missingRankings}`);
  console.log(`• Item rows to be scored:             ${matchesToScore}`);
  console.log(`• Untiered items skipped (tier:null): ${itemsBreakdown.untiered_items || 0}`);
  if (topTemplates.length > 0) {
    console.log('\nTop templates to gain Community Average:');
    topTemplates.forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.id}] ${t.title || 'Untitled'} (${t.missing_rankings} rankings, ${t.items_to_score} items)`);
    });
  }
  console.log('-----------------------------\n');

  if (!isExecute) {
    console.log('ℹ️  Preview completed (Dry Run). No changes were made.');
    console.log('👉 To execute backfill on local D1, run:');
    console.log('   node scripts/backfill-scores.mjs --execute\n');
    return;
  }

  console.log('Executing backfill on local D1...');
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec(BACKFILL_SQL);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Error during backfill transaction:', err);
    process.exit(1);
  }

  const newScores = db.prepare('SELECT COUNT(*) as n FROM ranking_item_scores').get().n;
  console.log(`✅ Local Backfill complete: scores increased from ${existingScores} to ${newScores} (+${newScores - existingScores})`);
}

if (isRemote) {
  await handleRemote();
} else {
  await handleLocal();
}
