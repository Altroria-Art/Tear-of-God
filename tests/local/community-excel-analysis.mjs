import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import {
  calculateTierSimilarity,
  calculateCommunitySimilarity,
} from '../../src/lib/similarity.js';

import {
  calculateTierSimilarity as duelCalculateTierSimilarity,
  calculateCommunitySimilarity as duelCalculateCommunitySimilarity,
} from '../../functions/lib/similarity.js';

import {
  generateStandoutSummary,
  calculateCommunityTasteAnalysis,
  buildAnalysisWorksheet,
  buildCommunityExcelWorkbook,
  getExportFilename,
} from '../../src/lib/communityExcelExport.js';

console.log('🧪 Starting Community Participants Excel Analysis Test Suite...\n');

const standardTiers = [
  { label: 'S', color: '#ff4d4f' },
  { label: 'A', color: '#ff7a45' },
  { label: 'B', color: '#ffa940' },
  { label: 'C', color: '#52c41a' },
  { label: 'D', color: '#1890ff' },
];

const customTiers = [
  { label: 'GOAT', color: '#ffd700' },
  { label: 'GOOD', color: '#52c41a' },
  { label: 'MID', color: '#faad14' },
  { label: 'BAD', color: '#f5222d' },
];

// -------------------------------------------------------------
// Test 1: identical rankings -> 100%
// -------------------------------------------------------------
{
  const pA = [
    { item_id: 'i1', tier: 'S' },
    { item_id: 'i2', tier: 'A' },
  ];
  const pB = [
    { item_id: 'i1', tier: 'S' },
    { item_id: 'i2', tier: 'A' },
  ];
  const res = calculateTierSimilarity(pA, pB, standardTiers);
  assert.equal(res.score, 100, 'Identical rankings must yield 100%');
  assert.equal(res.score, duelCalculateTierSimilarity(pA, pB, standardTiers).score);
  console.log('✔ Test 1 passed: identical rankings -> 100%');
}

// -------------------------------------------------------------
// Test 2: completely opposite ranking -> similarity lowest (0%)
// -------------------------------------------------------------
{
  const pA = [
    { item_id: 'i1', tier: 'S' }, // idx 0
    { item_id: 'i2', tier: 'S' },
  ];
  const pB = [
    { item_id: 'i1', tier: 'D' }, // idx 4, dist = 4/4 = 1.0
    { item_id: 'i2', tier: 'D' },
  ];
  const res = calculateTierSimilarity(pA, pB, standardTiers);
  assert.equal(res.score, 0, 'Opposite rankings must yield 0%');
  console.log('✔ Test 2 passed: completely opposite ranking -> 0%');
}

// -------------------------------------------------------------
// Test 3: User vs Community correct & identical to Duel formula
// -------------------------------------------------------------
{
  const communityByItem = {
    i1: { sum: 0, count: 4 }, // avgIndex = 0 (S)
    i2: { sum: 8, count: 4 }, // avgIndex = 2 (B)
  };
  const placements = [
    { item_id: 'i1', tier: 'S' }, // dist 0
    { item_id: 'i2', tier: 'S' }, // idx 0 vs avg 2 -> dist = 2/4 = 0.5
  ];
  // avg dist = 0.25 -> (1 - 0.25) * 100 = 75%
  const resFrontend = calculateCommunitySimilarity(placements, communityByItem, standardTiers, 4, 1);
  const resBackend = duelCalculateCommunitySimilarity(placements, communityByItem, standardTiers, 4, 1);
  assert.equal(resFrontend, 75);
  assert.equal(resFrontend, resBackend, 'Frontend similarity must match Duel backend formula exactly');
  console.log('✔ Test 3 passed: User vs Community correct and matches Duel formula 100%');
}

// -------------------------------------------------------------
// Test 4: 3 users -> 3 unique pairs (n*(n-1)/2)
// -------------------------------------------------------------
{
  const participants = [
    { username: 'Alice', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { username: 'Bob', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
    { username: 'Charlie', ranking_items: [{ item_id: 'i1', tier: 'B' }] },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Test Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  assert.equal(analysis.pairwiseResults.length, 3, '3 users must produce exactly 3 pairs');
  console.log('✔ Test 4 passed: 3 users -> 3 unique pairs');
}

// -------------------------------------------------------------
// Test 5: No duplicate A-B / B-A
// -------------------------------------------------------------
{
  const participants = [
    { username: 'Alice', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { username: 'Bob', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
    { username: 'Charlie', ranking_items: [{ item_id: 'i1', tier: 'B' }] },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Test Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  const hasReverse = analysis.pairwiseResults.some((p) => p.userA === 'Bob' && p.userB === 'Alice');
  assert.equal(hasReverse, false, 'Must not contain reverse pair B vs A');
  console.log('✔ Test 5 passed: no duplicate A-B / B-A');
}

// -------------------------------------------------------------
// Test 6: No self pair (A vs A)
// -------------------------------------------------------------
{
  const participants = [
    { username: 'Alice', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { username: 'Bob', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Test Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  const hasSelf = analysis.pairwiseResults.some((p) => p.userA === p.userB);
  assert.equal(hasSelf, false, 'Must not contain self pair A vs A');
  console.log('✔ Test 6 passed: no self pair');
}

// -------------------------------------------------------------
// Test 7: Custom tier names work dynamically
// -------------------------------------------------------------
{
  const pA = [{ item_id: 'i1', tier: 'GOAT' }];
  const pB = [{ item_id: 'i1', tier: 'BAD' }]; // dist = 3/3 = 1.0 -> 0%
  const res = calculateTierSimilarity(pA, pB, customTiers);
  assert.equal(res.score, 0, 'Custom tiers (GOAT vs BAD) must yield 0%');

  const pC = [{ item_id: 'i1', tier: 'GOAT' }];
  const resMatch = calculateTierSimilarity(pA, pC, customTiers);
  assert.equal(resMatch.score, 100, 'Custom tiers (GOAT vs GOAT) must yield 100%');
  console.log('✔ Test 7 passed: custom tier names dynamically supported');
}

// -------------------------------------------------------------
// Test 8: Most higher-than-community item identified correctly
// -------------------------------------------------------------
{
  const participants = [
    {
      username: 'UserA',
      ranking_items: [
        { item_id: 'i1', item_name: 'Item X', tier: 'S' }, // User = 0, Comm = 2 -> diff = +2.0
        { item_id: 'i2', item_name: 'Item Y', tier: 'B' }, // User = 2, Comm = 2 -> diff = 0
      ],
    },
    {
      username: 'UserB',
      ranking_items: [
        { item_id: 'i1', item_name: 'Item X', tier: 'C' }, // User = 3
        { item_id: 'i2', item_name: 'Item Y', tier: 'B' }, // User = 2
      ],
    },
    {
      username: 'UserC',
      ranking_items: [
        { item_id: 'i1', item_name: 'Item X', tier: 'C' }, // User = 3
        { item_id: 'i2', item_name: 'Item Y', tier: 'B' }, // User = 2
      ],
    },
  ];
  // Item X comm avg: (0 + 3 + 3) / 3 = 2.0 (B). UserA gave S (0) -> diff = +2.0
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  const userA = analysis.participants.find((p) => p.username === 'UserA');
  assert.ok(userA.highestItem);
  assert.equal(userA.highestItem.name, 'Item X');
  assert.ok(userA.highestItem.diff >= 1.9);
  console.log('✔ Test 8 passed: most higher-than-community item correct');
}

// -------------------------------------------------------------
// Test 9: Most lower-than-community item identified correctly
// -------------------------------------------------------------
{
  const participants = [
    {
      username: 'UserLow',
      ranking_items: [
        { item_id: 'i1', item_name: 'Item Popular', tier: 'D' }, // User = 4, Comm = 1.33 -> diff = -2.67
      ],
    },
    {
      username: 'UserA',
      ranking_items: [{ item_id: 'i1', item_name: 'Item Popular', tier: 'S' }], // User = 0
    },
    {
      username: 'UserB',
      ranking_items: [{ item_id: 'i1', item_name: 'Item Popular', tier: 'S' }], // User = 0
    },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  const userLow = analysis.participants.find((p) => p.username === 'UserLow');
  assert.ok(userLow.lowestItem);
  assert.equal(userLow.lowestItem.name, 'Item Popular');
  assert.ok(userLow.lowestItem.diff <= -2.5);
  console.log('✔ Test 9 passed: most lower-than-community item correct');
}

// -------------------------------------------------------------
// Test 10: Missing item does not crash & penalized gracefully
// -------------------------------------------------------------
{
  const pA = [{ item_id: 'i1', tier: 'S' }, { item_id: 'i2', tier: 'A' }];
  const pB = [{ item_id: 'i1', tier: 'S' }]; // missing i2
  const pEmpty = [];

  const res = calculateTierSimilarity(pA, pB, standardTiers);
  assert.equal(res.score, 50); // i1 dist 0, i2 missing (dist 1.0) -> avg 0.5 -> 50%

  const resEmpty = calculateTierSimilarity(pA, pEmpty, standardTiers);
  assert.equal(resEmpty.score, 0);
  console.log('✔ Test 10 passed: missing item does not crash');
}

// -------------------------------------------------------------
// Test 11: Tie result deterministic
// -------------------------------------------------------------
{
  const participants = [
    { username: 'Zoe', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { username: 'Alex', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  // Both have 100% similarity. Tie-break must pick Alex before Zoe alphabetically
  assert.equal(analysis.mostSimilarUser.username, 'Alex');
  console.log('✔ Test 11 passed: tie result is deterministic (alphabetical sort)');
}

// -------------------------------------------------------------
// Test 12, 13, 14: Faculty, Major, and Year filters respected
// -------------------------------------------------------------
{
  const participants = [
    { user_id: 'u1', username: 'ICT User', faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร', major: 'วิศวกรรมซอฟต์แวร์', year: '66', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { user_id: 'u2', username: 'Engr User', faculty: 'คณะวิศวกรรมศาสตร์', major: 'วิศวกรรมโยธา', year: '65', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
    { user_id: 'u3', username: 'Sci User', faculty: 'คณะวิทยาศาสตร์', major: 'เคมี', year: '66', ranking_items: [{ item_id: 'i1', tier: 'B' }] },
  ];

  // Faculty filter test
  const wbFaculty = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: 'all',
    facultyFilter: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    filteredRankings: [participants[0]],
    participants,
    displayTiers: standardTiers,
  });
  assert.ok(wbFaculty.wb.Sheets['Participant Analysis'], 'Participant Analysis sheet must exist');
  const facultyJson = XLSX.utils.sheet_to_json(wbFaculty.wb.Sheets['Participant Analysis'], { header: 1 });
  const facultyText = JSON.stringify(facultyJson);
  assert.ok(facultyText.includes('ICT User'));
  assert.ok(!facultyText.includes('Engr User'));
  assert.ok(!facultyText.includes('Sci User'));
  console.log('✔ Test 12 passed: faculty filter respected');

  // Major filter test
  const wbMajor = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: 'all',
    majorFilter: 'วิศวกรรมโยธา',
    filteredRankings: [participants[1]],
    participants,
    displayTiers: standardTiers,
  });
  const majorText = JSON.stringify(XLSX.utils.sheet_to_json(wbMajor.wb.Sheets['Participant Analysis'], { header: 1 }));
  assert.ok(majorText.includes('Engr User'));
  assert.ok(!majorText.includes('ICT User'));
  console.log('✔ Test 13 passed: major filter respected');

  // Year filter test
  const wbYear = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: 'all',
    yearFilter: '65',
    filteredRankings: [participants[1]],
    participants,
    displayTiers: standardTiers,
  });
  const yearText = JSON.stringify(XLSX.utils.sheet_to_json(wbYear.wb.Sheets['Participant Analysis'], { header: 1 }));
  assert.ok(yearText.includes('Engr User'));
  assert.ok(!yearText.includes('ICT User'));
  console.log('✔ Test 14 passed: year filter respected');
}

// -------------------------------------------------------------
// Test 15: One participant -> no pairwise rows & N/A in summary
// -------------------------------------------------------------
{
  const participants = [
    { username: 'Solo User', faculty: 'ICT', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
  ];
  const analysis = calculateCommunityTasteAnalysis({
    template: { title: 'Tpl', tiers: standardTiers },
    participants,
    filteredRankings: participants,
    tiersDef: standardTiers,
  });
  assert.equal(analysis.pairwiseResults.length, 0, 'Single participant must have 0 pairwise rows');
  assert.equal(analysis.closestPair, null);
  assert.equal(analysis.mostDifferentPair, null);

  const ws = buildAnalysisWorksheet(XLSX, analysis, 'Tpl');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const text = JSON.stringify(rows);
  assert.ok(text.includes('Requires at least 2 participants'));
  assert.ok(!text.includes('--- Pairwise Comparison ---'));
  console.log('✔ Test 15 passed: one participant -> no pairwise rows');
}

// -------------------------------------------------------------
// Test 16: All Participants sheet remains intact with original layout
// -------------------------------------------------------------
{
  const participants = [
    { user_id: 'u1', username: 'User One', faculty: 'ICT', major: 'CS', year: '66', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { user_id: 'u2', username: 'User Two', faculty: 'ENGR', major: 'ME', year: '65', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
  ];
  const { wb } = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Coffee Tpl', tiers: standardTiers },
    participantFilter: 'all',
    filteredRankings: participants,
    participants,
    displayTiers: standardTiers,
  });

  assert.ok(wb.Sheets['All Participants'], 'Sheet 1: All Participants must exist');
  assert.ok(wb.Sheets['Participant Analysis'], 'Sheet 2: Participant Analysis must exist');

  const rows = XLSX.utils.sheet_to_json(wb.Sheets['All Participants'], { header: 1 });
  // Verify horizontal layout headers
  assert.equal(rows[0][0], 'Template');
  assert.equal(rows[0][1], 'Coffee Tpl');
  assert.equal(rows[1][0], 'Participant');
  assert.equal(rows[6][0], 'Tier');
  assert.equal(rows[6][1], 'Items');
  console.log('✔ Test 16 passed: All Participants sheet remains intact with original layout');
}

// -------------------------------------------------------------
// Test 17: Metadata Faculty/Major/Year present
// -------------------------------------------------------------
{
  const participants = [
    { user_id: 'u1', username: 'MetaUser', faculty: 'คณะนิติศาสตร์', major: 'นิติศาสตร์', year: '64', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
  ];
  const { wb } = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: 'all',
    filteredRankings: participants,
    participants,
    displayTiers: standardTiers,
  });
  const analysisText = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Participant Analysis'], { header: 1 }));
  assert.ok(analysisText.includes('คณะนิติศาสตร์'));
  assert.ok(analysisText.includes('นิติศาสตร์'));
  assert.ok(analysisText.includes('64'));
  console.log('✔ Test 17 passed: metadata Faculty/Major/Year preserved');
}

// -------------------------------------------------------------
// Test 18: Standout Summary uses respectful, non-judgmental wording
// -------------------------------------------------------------
{
  const s85 = generateStandoutSummary({ similarity: 90, highestItem: null, lowestItem: null });
  assert.ok(s85.includes('Very close to Community Average'));
  assert.ok(!s85.includes('best') && !s85.includes('worst') && !s85.includes('better'));

  const s50 = generateStandoutSummary({
    similarity: 45,
    highestItem: { name: 'Item X', diff: 2.0 },
    lowestItem: { name: 'Item Y', diff: -2.0 },
  });
  assert.ok(s50.includes('Highly distinctive ranking'));
  assert.ok(s50.includes('strong preference for "Item X"'));
  assert.ok(s50.includes('rates "Item Y" below community'));
  assert.ok(!s50.includes('best') && !s50.includes('worst'));
  console.log('✔ Test 18 passed: standout summary strictly uses neutral/taste phrasing without best/worst');
}

// -------------------------------------------------------------
// Test 19: Export filename generation remains correct
// -------------------------------------------------------------
{
  const nameAll = getExportFilename({
    template: { title: 'Anime List' },
    participantName: 'All',
    faculty: 'All',
  });
  assert.equal(nameAll, 'template-Anime-List-all.xlsx');

  const nameAvg = getExportFilename({
    template: { title: 'Coffee' },
    participantName: 'Avg',
    faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    major: 'วิศวกรรมซอฟต์แวร์',
    year: '67',
  });
  assert.equal(nameAvg, 'template-Coffee-avg-ICT-วิศวกรรมซอฟต์แวร์-67.xlsx');
  console.log('✔ Test 19 passed: export filename generation correct');
}

// -------------------------------------------------------------
// Test 20: 50 participants performance & safety
// -------------------------------------------------------------
{
  const fiftyUsers = [];
  for (let i = 1; i <= 50; i++) {
    fiftyUsers.push({
      user_id: `u_${i}`,
      username: `User ${String(i).padStart(2, '0')}`,
      faculty: 'ICT',
      major: 'CS',
      year: '66',
      ranking_items: [
        { item_id: 'i1', tier: i % 2 === 0 ? 'S' : 'A' },
        { item_id: 'i2', tier: i % 3 === 0 ? 'B' : 'C' },
        { item_id: 'i3', tier: i % 5 === 0 ? 'D' : 'S' },
      ],
    });
  }

  const startTime = Date.now();
  const analysis50 = calculateCommunityTasteAnalysis({
    template: { title: 'Large Tpl', tiers: standardTiers },
    participants: fiftyUsers,
    filteredRankings: fiftyUsers,
    tiersDef: standardTiers,
  });
  const duration = Date.now() - startTime;

  assert.equal(analysis50.totalParticipants, 50);
  assert.equal(analysis50.pairwiseResults.length, (50 * 49) / 2); // 1,225 pairs
  assert.equal(analysis50.isPairwiseLimited, false);
  assert.ok(duration < 250, `50 users pairwise should compute in < 250ms (actual: ${duration}ms)`);
  console.log(`✔ Test 20 passed: 50 participants computed 1,225 pairs in ${duration}ms without freeze`);
}

// -------------------------------------------------------------
// Test 21: 51+ participants safety guard limits pairwise to 50 deterministically
// -------------------------------------------------------------
{
  const sixtyUsers = [];
  for (let i = 1; i <= 60; i++) {
    sixtyUsers.push({
      user_id: `u_${String(i).padStart(2, '0')}`,
      username: `User ${String(i).padStart(2, '0')}`,
      ranking_items: [{ item_id: 'i1', tier: i === 59 ? 'D' : 'S' }], // User 59 is most distinctive
    });
  }

  // Input order 1: original order
  const analysis60A = calculateCommunityTasteAnalysis({
    template: { title: 'Large Tpl', tiers: standardTiers },
    participants: sixtyUsers,
    filteredRankings: sixtyUsers,
    tiersDef: standardTiers,
  });

  // Input order 2: completely reversed input order
  const reversedSixtyUsers = [...sixtyUsers].reverse();
  const analysis60B = calculateCommunityTasteAnalysis({
    template: { title: 'Large Tpl', tiers: standardTiers },
    participants: reversedSixtyUsers,
    filteredRankings: reversedSixtyUsers,
    tiersDef: standardTiers,
  });

  // 1. Total participants reflects all 60
  assert.equal(analysis60A.totalParticipants, 60);
  assert.equal(analysis60B.totalParticipants, 60);
  assert.equal(analysis60A.participants.length, 60);
  assert.equal(analysis60B.participants.length, 60);

  // 2. Deterministic subset: Pairwise results are identical regardless of input order
  assert.equal(analysis60A.isPairwiseLimited, true);
  assert.equal(analysis60B.isPairwiseLimited, true);
  assert.equal(analysis60A.pairwiseResults.length, (50 * 49) / 2); // 1,225 pairs
  assert.equal(analysis60B.pairwiseResults.length, (50 * 49) / 2);
  assert.deepEqual(analysis60A.pairwiseResults, analysis60B.pairwiseResults, 'Pairwise subset must be deterministic regardless of input order');

  // Pairwise contains User 01 .. User 50 only
  const pairUsers = new Set();
  analysis60A.pairwiseResults.forEach((p) => {
    pairUsers.add(p.userA);
    pairUsers.add(p.userB);
  });
  assert.equal(pairUsers.size, 50);
  assert.ok(pairUsers.has('User 01'));
  assert.ok(pairUsers.has('User 50'));
  assert.ok(!pairUsers.has('User 59'), 'User 59 must not be in pairwise subset');

  // 3. Community similarity analyzes ALL 60 participants (User 59 detected as most distinctive)
  assert.equal(analysis60A.mostDistinctiveUser.username, 'User 59', 'Most distinctive must consider all 60 participants');
  assert.equal(analysis60B.mostDistinctiveUser.username, 'User 59');

  // 4. Worksheet summary labels for 51+ participants
  const ws = buildAnalysisWorksheet(XLSX, analysis60A, 'Large Tpl');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const text = JSON.stringify(rows);
  assert.ok(text.includes('Closest Pair (among analyzed 50)'), 'Summary must specify closest pair is among analyzed 50');
  assert.ok(text.includes('Most Different Pair (among analyzed 50)'), 'Summary must specify most different pair is among analyzed 50');
  assert.ok(text.includes('Note: Pairwise comparison is limited to 50 participants to ensure smooth export performance.'));
  console.log('✔ Test 21 passed: 51+ participants safely guards pairwise deterministically and analyzes all 60 for community');
}

// -------------------------------------------------------------
// Test 22: No PII (email, password, tokens) exported in Excel
// -------------------------------------------------------------
{
  const participants = [
    {
      user_id: 'u_secret',
      username: 'SafeUser',
      email: 'secret@gmail.com',
      password: 'pbkdf2-sha256$hidden',
      token: 'session_token_123',
      faculty: 'ICT',
      major: 'CS',
      year: '66',
      ranking_items: [{ item_id: 'i1', tier: 'S' }],
    },
  ];
  const { wb } = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: 'all',
    filteredRankings: participants,
    participants,
    displayTiers: standardTiers,
  });

  for (const sheetName of wb.SheetNames) {
    const sheetData = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }));
    assert.ok(!sheetData.includes('secret@gmail.com'), `Sheet ${sheetName} must not contain email`);
    assert.ok(!sheetData.includes('pbkdf2-sha256$hidden'), `Sheet ${sheetName} must not contain password hash`);
    assert.ok(!sheetData.includes('session_token_123'), `Sheet ${sheetName} must not contain session token`);
  }
  console.log('✔ Test 22 passed: no PII (email/password/token) exported');
}

// -------------------------------------------------------------
// Test 23: Community Average mode appends Analysis sheet when data present
// -------------------------------------------------------------
{
  const participants = [
    { user_id: 'u1', username: 'User Alpha', faculty: 'ICT', major: 'CS', year: '66', ranking_items: [{ item_id: 'i1', tier: 'S' }] },
    { user_id: 'u2', username: 'User Beta', faculty: 'ICT', major: 'CS', year: '66', ranking_items: [{ item_id: 'i1', tier: 'A' }] },
  ];
  const { wb } = buildCommunityExcelWorkbook(XLSX, {
    template: { title: 'Tpl', tiers: standardTiers },
    participantFilter: '', // Avg mode
    facultyFilter: 'ICT',
    filteredRankings: participants,
    participants,
    displayTiers: standardTiers,
  });

  assert.ok(wb.Sheets['Community Average'], 'Sheet 1: Community Average must exist');
  assert.ok(wb.Sheets['Participant Analysis'], 'Sheet 2: Participant Analysis must exist');
  console.log('✔ Test 23 passed: Community Average mode appends Participant Analysis safely');
}

console.log('\n🎉 ALL 23 COMMUNITY EXCEL ANALYSIS TESTS PASSED SUCCESSFULLY!');
