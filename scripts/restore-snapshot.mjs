import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATABASE = 'tear-of-god-db';
const BATCH_SIZE = 200;

// ถ้าใช้ --ddl-only จะไม่ CREATE TABLE / INSERT DATA ใหม่
// ใช้สำหรับทำต่อจาก restore ที่ข้อมูลเข้า local ครบแล้ว
const DDL_ONLY = process.argv.includes('--ddl-only');

function splitStatements(sql) {
  const out = [];

  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  let word = '';
  let statementTokens = [];

  let inTrigger = false;
  let triggerBeginDepth = 0;
  let caseDepth = 0;
  let seenTriggerBegin = false;
  let lastWord = '';

  function resetStatementState() {
    word = '';
    statementTokens = [];

    inTrigger = false;
    triggerBeginDepth = 0;
    caseDepth = 0;
    seenTriggerBegin = false;
    lastWord = '';
  }

  function processWord() {
    if (!word) {
      return;
    }

    const upper = word.toUpperCase();
    lastWord = upper;

    if (statementTokens.length < 4) {
      statementTokens.push(upper);
    }

    if (!inTrigger) {
      const t = statementTokens;

      if (
        (t[0] === 'CREATE' && t[1] === 'TRIGGER') ||
        (
          t[0] === 'CREATE' &&
          (t[1] === 'TEMP' || t[1] === 'TEMPORARY') &&
          t[2] === 'TRIGGER'
        )
      ) {
        inTrigger = true;
      }
    }

    if (inTrigger) {
      if (upper === 'BEGIN') {
        triggerBeginDepth++;
        seenTriggerBegin = true;
      } else if (seenTriggerBegin && upper === 'CASE') {
        caseDepth++;
      } else if (seenTriggerBegin && upper === 'END') {
        if (caseDepth > 0) {
          caseDepth--;
        } else if (triggerBeginDepth > 0) {
          triggerBeginDepth--;
        }
      }
    }

    word = '';
  }

  function finishStatement() {
    processWord();

    const statement = current.trim();

    if (statement) {
      out.push(statement);
    }

    current = '';
    resetStatementState();
  }

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    if (quote) {
      current += char;

      if (char === quote) {
        if (next === quote) {
          current += next;
          i++;
        } else {
          quote = null;
        }
      }

      continue;
    }

    if (lineComment) {
      current += char;

      if (char === '\n') {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      current += char;

      if (char === '*' && next === '/') {
        current += next;
        i++;
        blockComment = false;
      }

      continue;
    }

    if (char === '-' && next === '-') {
      processWord();

      current += '--';
      i++;
      lineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      processWord();

      current += '/*';
      i++;
      blockComment = true;
      continue;
    }

    if (
      char === "'" ||
      char === '"' ||
      char === '`'
    ) {
      processWord();

      quote = char;
      current += char;
      continue;
    }

    if (/[A-Za-z0-9_]/.test(char)) {
      word += char;
      current += char;
      continue;
    }

    processWord();

    if (char === ';') {
      if (inTrigger) {
        if (
          seenTriggerBegin &&
          triggerBeginDepth === 0 &&
          caseDepth === 0 &&
          lastWord === 'END'
        ) {
          finishStatement();
        } else {
          current += ';';
        }
      } else {
        finishStatement();
      }

      continue;
    }

    current += char;
  }

  processWord();

  if (current.trim()) {
    out.push(current.trim());
  }

  return out;
}

function getCreateTableName(statement) {
  const match = statement.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([^"'`\s(]+)/i,
  );

  return match?.[1] ?? null;
}

function getInsertTableName(statement) {
  const match = statement.match(
    /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["'`]?([^"'`\s(]+)/i,
  );

  return match?.[1] ?? null;
}

function getReferences(statement) {
  const refs = [];

  const regex =
    /REFERENCES\s+["'`]?([^"'`\s(]+)/gi;

  let match;

  while ((match = regex.exec(statement)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

// ทำ CREATE INDEX / VIEW / TRIGGER ให้รันซ้ำได้
// เผื่อรอบก่อนสร้างไปบางส่วนแล้ว
function makeDdlIdempotent(statement) {
  let sql = statement;

  if (
    /^\s*CREATE\s+UNIQUE\s+INDEX\s+/i.test(sql) &&
    !/^\s*CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(sql)
  ) {
    sql = sql.replace(
      /^(\s*CREATE\s+UNIQUE\s+INDEX)\s+/i,
      '$1 IF NOT EXISTS ',
    );

    return sql;
  }

  if (
    /^\s*CREATE\s+INDEX\s+/i.test(sql) &&
    !/^\s*CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(sql)
  ) {
    sql = sql.replace(
      /^(\s*CREATE\s+INDEX)\s+/i,
      '$1 IF NOT EXISTS ',
    );

    return sql;
  }

  if (
    /^\s*CREATE\s+VIEW\s+/i.test(sql) &&
    !/^\s*CREATE\s+VIEW\s+IF\s+NOT\s+EXISTS/i.test(sql)
  ) {
    sql = sql.replace(
      /^(\s*CREATE\s+VIEW)\s+/i,
      '$1 IF NOT EXISTS ',
    );

    return sql;
  }

  if (
    /^\s*CREATE\s+TRIGGER\s+/i.test(sql) &&
    !/^\s*CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS/i.test(sql)
  ) {
    sql = sql.replace(
      /^(\s*CREATE\s+TRIGGER)\s+/i,
      '$1 IF NOT EXISTS ',
    );

    return sql;
  }

  return sql;
}

// เรียง table แม่ก่อน table ลูก
function sortTablesByDependencies(createTables) {
  const dependencies = new Map();

  for (const statement of createTables) {
    const table = getCreateTableName(statement);

    if (!table) {
      continue;
    }

    const refs = getReferences(statement)
      .filter((ref) => ref !== table);

    dependencies.set(
      table,
      new Set(refs),
    );
  }

  const result = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(table) {
    if (visited.has(table)) {
      return;
    }

    if (visiting.has(table)) {
      // กัน circular dependency
      return;
    }

    visiting.add(table);

    const refs =
      dependencies.get(table) ?? new Set();

    for (const ref of refs) {
      if (dependencies.has(ref)) {
        visit(ref);
      }
    }

    visiting.delete(table);
    visited.add(table);

    result.push(table);
  }

  for (const table of dependencies.keys()) {
    visit(table);
  }

  return result;
}

function runSqlFile(
  statements,
  label,
  tempDir,
) {
  if (!statements.length) {
    return;
  }

  const safeLabel = label.replace(
    /[^a-zA-Z0-9_-]/g,
    '_',
  );

  const file = join(
    tempDir,
    `${safeLabel}.sql`,
  );

  writeFileSync(
    file,
    statements.join(';\n') + ';\n',
    'utf8',
  );

  console.log(
    `\n▶ ${label} (${statements.length} statements)`,
  );

  const result = spawnSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    DATABASE,
    '--local',
    '--config=wrangler.toml',
    `--file=${file}`,
    '--yes',
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

  if (result.status !== 0) {
    console.error(
      `\n❌ Restore พังที่: ${label}`,
    );

    console.error(
      `ไฟล์: ${file}`,
    );

    console.error(
      '\nSQL ที่ทำให้พัง:',
    );

    console.error(
      '----------------------------------------',
    );

    console.error(
      statements.join(';\n'),
    );

    console.error(
      '----------------------------------------',
    );

    process.exit(
      result.status ?? 1,
    );
  }

  console.log(`✓ ${label}`);
}

// --------------------------------------------------
// อ่าน snapshot
// --------------------------------------------------

const snapshotPath =
  process.argv.find(
    (arg) =>
      !arg.startsWith('--') &&
      arg.endsWith('.sql'),
  ) || './.d1-snapshot.sql';

let sql;

try {
  sql = readFileSync(
    snapshotPath,
    'utf8',
  );
} catch {
  console.error(
    `ไม่พบ ${snapshotPath}`,
  );

  console.error(
    'รัน npm run db:pull ก่อน',
  );

  process.exit(1);
}

const statements =
  splitStatements(sql);

console.log(
  `snapshot: ${statements.length} statements`,
);

// --------------------------------------------------
// แยกประเภท SQL
// --------------------------------------------------

const pragmas = [];
const createTables = [];
const otherDDL = [];
const inserts = [];
const other = [];

for (const statement of statements) {
  const head = statement
    .trimStart()
    .toUpperCase();

  if (
    head.startsWith('PRAGMA')
  ) {
    pragmas.push(statement);
  } else if (
    head.startsWith('CREATE TABLE')
  ) {
    createTables.push(statement);
  } else if (
    head.startsWith('CREATE ')
  ) {
    otherDDL.push(statement);
  } else if (
    head.startsWith('INSERT INTO')
  ) {
    inserts.push(statement);
  } else {
    // BEGIN / COMMIT จาก dump ไม่ต้อง replay
    if (
      head === 'BEGIN' ||
      head === 'BEGIN TRANSACTION' ||
      head === 'COMMIT'
    ) {
      continue;
    }

    other.push(statement);
  }
}

console.log(
  `tables: ${createTables.length}`,
);

console.log(
  `inserts: ${inserts.length}`,
);

console.log(
  `other ddl: ${otherDDL.length}`,
);

console.log(
  `other: ${other.length}`,
);

// --------------------------------------------------
// แยก INSERT ตาม table
// --------------------------------------------------

const insertsByTable =
  new Map();

for (const statement of inserts) {
  const table =
    getInsertTableName(statement);

  if (!table) {
    console.error(
      'อ่านชื่อ table จาก INSERT ไม่ได้:',
    );

    console.error(
      statement.slice(0, 300),
    );

    process.exit(1);
  }

  if (
    !insertsByTable.has(table)
  ) {
    insertsByTable.set(
      table,
      [],
    );
  }

  insertsByTable
    .get(table)
    .push(statement);
}

// --------------------------------------------------
// เรียง table ตาม FOREIGN KEY
// --------------------------------------------------

const tableOrder =
  sortTablesByDependencies(
    createTables,
  );

for (
  const table of
  insertsByTable.keys()
) {
  if (
    !tableOrder.includes(table)
  ) {
    tableOrder.push(table);
  }
}

if (!DDL_ONLY) {
  console.log(
    '\nลำดับ restore table:',
  );

  tableOrder.forEach(
    (table, index) => {
      console.log(
        `${index + 1}. ${table} ` +
        `(${insertsByTable.get(table)?.length ?? 0} rows)`,
      );
    },
  );
}

// --------------------------------------------------
// Temp directory
// --------------------------------------------------

const tempDir = mkdtempSync(
  join(
    tmpdir(),
    'd1-restore-batches-',
  ),
);

console.log(
  `\ntemp: ${tempDir}`,
);

let totalInserted = 0;

// --------------------------------------------------
// STEP 1 + 2
// --------------------------------------------------

if (DDL_ONLY) {
  console.log(
    '\n⚡ DDL-only mode',
  );

  console.log(
    'ข้าม CREATE TABLE และ INSERT DATA',
  );
} else {
  // --------------------------------
  // STEP 1: CREATE TABLE
  // --------------------------------

  runSqlFile(
    createTables,
    '01-create-tables',
    tempDir,
  );

  // Remote snapshot รุ่นเก่าอาจยังไม่มี last_activity_at
  const rankingsCreate = createTables.find(
    (statement) => getCreateTableName(statement) === 'rankings',
  );

  const snapshotHasLastActivity =
    rankingsCreate &&
    /\blast_activity_at\b/i.test(rankingsCreate);

  if (rankingsCreate && !snapshotHasLastActivity) {
    runSqlFile(
      [
        'ALTER TABLE rankings ADD COLUMN last_activity_at DATETIME',
      ],
      '01b-add-rankings-last-activity',
      tempDir,
    );
  }

  // --------------------------------
  // STEP 2: INSERT DATA
  // --------------------------------

  for (
    const table of tableOrder
  ) {
    const tableInserts =
      insertsByTable.get(table) ?? [];

    if (
      !tableInserts.length
    ) {
      continue;
    }

    console.log(
      `\n📦 ${table}: ` +
      `${tableInserts.length} statements`,
    );

    for (
      let start = 0;
      start < tableInserts.length;
      start += BATCH_SIZE
    ) {
      const batch =
        tableInserts.slice(
          start,
          start + BATCH_SIZE,
        );

      const end = Math.min(
        start + BATCH_SIZE,
        tableInserts.length,
      );

      runSqlFile(
        batch,
        `02-${table}-${start + 1}-${end}`,
        tempDir,
      );

      totalInserted +=
        batch.length;

      console.log(
        `progress: ` +
        `${totalInserted}/${inserts.length}`,
      );
    }
  }

  // เติม last_activity_at ให้ข้อมูลเก่าหลัง import เสร็จ
  if (rankingsCreate) {
    runSqlFile(
      [
        `UPDATE rankings
         SET last_activity_at = created_at
         WHERE last_activity_at IS NULL`,
      ],
      '02b-backfill-rankings-last-activity',
      tempDir,
    );
  }
}

// --------------------------------------------------
// STEP 3: INDEX / VIEW / TRIGGER
//
// สำคัญ:
// ยิงทีละ statement เพื่อไม่ให้เกิด error
// "near CREATE" จากการรวม DDL ทั้งหมดเป็นก้อนเดียว
// --------------------------------------------------

console.log(
  `\n🔧 DDL: ${otherDDL.length} statements`,
);

for (
  let i = 0;
  i < otherDDL.length;
  i++
) {
  const original =
    otherDDL[i];

  const statement =
    makeDdlIdempotent(
      original,
    );

  const preview = statement
    .slice(0, 180)
    .replace(/\s+/g, ' ');

  console.log(
    `\nDDL ${i + 1}/${otherDDL.length}: ${preview}`,
  );

  runSqlFile(
    [statement],
    `03-ddl-${String(
      i + 1,
    ).padStart(3, '0')}`,
    tempDir,
  );
}

// --------------------------------------------------
// STEP 4: SQL อื่นๆ
//
// DDL-only ไม่ทำส่วนนี้ เพราะข้อมูล local
// จากรอบก่อนมีครบอยู่แล้ว
// --------------------------------------------------

if (!DDL_ONLY) {
  for (
    let start = 0;
    start < other.length;
    start += BATCH_SIZE
  ) {
    const batch =
      other.slice(
        start,
        start + BATCH_SIZE,
      );

    runSqlFile(
      batch,
      `04-other-${start + 1}`,
      tempDir,
    );
  }
}
// --------------------------------------------------
// STEP 5: ตรวจ Foreign Key
// --------------------------------------------------

runSqlFile(
  [
    'PRAGMA foreign_key_check',
  ],
  '05-foreign-key-check',
  tempDir,
);

runSqlFile(
  [
    'PRAGMA foreign_key_check',
  ],
  '05-foreign-key-check',
  tempDir,
);

// --------------------------------------------------
// DONE
// --------------------------------------------------

console.log(
  '\n================================',
);

if (DDL_ONLY) {
  console.log(
    '✅ DDL local D1 สำเร็จ',
  );

  console.log(
    '✅ ไม่ได้ import ข้อมูลใหม่',
  );
} else {
  console.log(
    '✅ Restore local D1 สำเร็จ',
  );

  console.log(
    `✅ ${totalInserted} INSERT statements`,
  );
}

console.log(
  '================================',
);