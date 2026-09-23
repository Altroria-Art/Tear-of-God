import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  buildCommunityExcelWorkbook,
  getExportFilename,
  sanitizeFilenamePart,
  getFacultyShortName,
  getMajorShortName,
} from '../../src/lib/communityExcelExport.js'

console.log('Testing Community Participants Excel export...')

const mockTemplate = {
  id: 'tpl-101',
  title: 'ร้านกาแฟใน มหาวิทยาลัยพะเยา',
}

const mockParticipantOptions = [
  {
    user_id: 'user-001',
    username: 'มะเหมี่ยว',
    faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    major: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
    year: '67',
  },
  {
    user_id: 'user-002',
    username: 'สมชาย',
    faculty: 'คณะวิศวกรรมศาสตร์',
    major: 'สาขาวิชาวิศวกรรมคอมพิวเตอร์',
    year: '66',
  },
]

const mockDisplayTiers = [
  {
    label: 'S',
    color: '#ef4444',
    items: [{ name: 'Cafe Amazon' }, { name: 'Inthanin' }],
  },
  {
    label: 'A',
    color: '#f97316',
    items: [{ name: 'All Cafe' }],
  },
]

// ─────────────────────────────────────────────────────────────
// Test 1: เลือก participant -> Excel มีชื่อ + คณะ + สาขา + ปี
// ─────────────────────────────────────────────────────────────
console.log('Running Test 1: เลือก participant -> Excel มีชื่อ + คณะ + สาขา + ปี...')
{
  const { wb, ws, filename } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantOptions: mockParticipantOptions,
    participantFilter: 'user-001',
    facultyFilter: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    majorFilter: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
    yearFilter: '67',
    displayTiers: mockDisplayTiers,
  })

  assert(wb, 'Workbook must be created')
  assert(ws, 'Worksheet must be created')

  // Check metadata rows (rows 0-4)
  assert.equal(ws['A1']?.v, 'Template', 'A1 label must be Template')
  assert.equal(ws['B1']?.v, 'ร้านกาแฟใน มหาวิทยาลัยพะเยา', 'B1 must be template title')

  assert.equal(ws['A2']?.v, 'Participant', 'A2 label must be Participant')
  assert.equal(ws['B2']?.v, 'มะเหมี่ยว', 'B2 must be username (NOT user_id user-001)')

  assert.equal(ws['A3']?.v, 'Faculty', 'A3 label must be Faculty')
  assert.equal(ws['B3']?.v, 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร', 'B3 must be faculty name')

  assert.equal(ws['A4']?.v, 'Major', 'A4 label must be Major')
  assert.equal(ws['B4']?.v, 'สาขาวิชาวิศวกรรมซอฟต์แวร์', 'B4 must be major name')

  assert.equal(ws['A5']?.v, 'Academic Year', 'A5 label must be Academic Year')
  assert.equal(ws['B5']?.v, '67', 'B5 must be academic year 67')

  // Check blank row (row 5: A6/B6 empty or undefined)
  assert(!ws['A6']?.v, 'Row 6 (A6) must be blank row before table')
  assert(!ws['B6']?.v, 'Row 6 (B6) must be blank row before table')

  // Check table header row (row 6: A7:B7)
  assert.equal(ws['A7']?.v, 'Tier', 'A7 must be Tier header')
  assert.equal(ws['B7']?.v, 'Items', 'B7 must be Items header')

  // Check tier data rows (row 7+: A8:B8, A9:B9)
  assert.equal(ws['A8']?.v, 'S', 'A8 must be tier label S')
  assert.equal(ws['B8']?.v, 'Cafe Amazon, Inthanin', 'B8 must be item names')
  assert.equal(ws['A9']?.v, 'A', 'A9 must be tier label A')
  assert.equal(ws['B9']?.v, 'All Cafe', 'B9 must be item names')

  // Check styling
  // Metadata labels bold
  assert.equal(ws['A1']?.s?.font?.bold, true, 'A1 must be bold')
  assert.equal(ws['A2']?.s?.font?.bold, true, 'A2 must be bold')
  assert.equal(ws['A3']?.s?.font?.bold, true, 'A3 must be bold')
  assert.equal(ws['A4']?.s?.font?.bold, true, 'A4 must be bold')
  assert.equal(ws['A5']?.s?.font?.bold, true, 'A5 must be bold')

  // Table header bold
  assert.equal(ws['A7']?.s?.font?.bold, true, 'A7 must be bold')
  assert.equal(ws['B7']?.s?.font?.bold, true, 'B7 must be bold')

  // Tier color fill
  assert.equal(ws['A8']?.s?.font?.bold, true, 'A8 tier label must be bold')
  assert.equal(ws['A8']?.s?.fill?.fgColor?.rgb, 'FFEF4444', 'A8 must have tier color #ef4444')
  assert.equal(ws['A9']?.s?.fill?.fgColor?.rgb, 'FFF97316', 'A9 must have tier color #f97316')

  // Column width
  assert(ws['!cols']?.[0]?.wch >= 16, 'Column A must be wide enough for labels')
  assert(ws['!cols']?.[1]?.wch >= 60, 'Column B must be wide enough for faculty/major/items')

  // Filename contains participant name and major
  assert(filename.includes('มะเหมี่ยว'), `Filename must include username: ${filename}`)
  assert(filename.includes('วิศวกรรมซอฟต์แวร์'), `Filename must include major: ${filename}`)
  assert(filename.includes('67'), `Filename must include year: ${filename}`)
  assert(!filename.includes('user-001'), `Filename must NOT include user_id: ${filename}`)
  console.log('✔ Test 1 passed! Filename:', filename)
}

// ─────────────────────────────────────────────────────────────
// Test 2: Avg + filters -> แสดง Avg + filter ทั้งหมด
// ─────────────────────────────────────────────────────────────
console.log('Running Test 2: Avg + filters -> แสดง Avg + filter ทั้งหมด...')
{
  const { ws, filename } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantOptions: mockParticipantOptions,
    participantFilter: '', // empty = Avg
    facultyFilter: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    majorFilter: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
    yearFilter: '67',
    displayTiers: mockDisplayTiers,
  })

  // Check metadata
  assert.equal(ws['A2']?.v, 'Participant', 'A2 label must be Participant')
  assert.equal(ws['B2']?.v, 'Avg', 'B2 must show Avg when participantFilter is empty')

  assert.equal(ws['A3']?.v, 'Faculty', 'A3 label must be Faculty')
  assert.equal(ws['B3']?.v, 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร', 'B3 must show filtered faculty')

  assert.equal(ws['A4']?.v, 'Major', 'A4 label must be Major')
  assert.equal(ws['B4']?.v, 'สาขาวิชาวิศวกรรมซอฟต์แวร์', 'B4 must show filtered major')

  assert.equal(ws['A5']?.v, 'Academic Year', 'A5 label must be Academic Year')
  assert.equal(ws['B5']?.v, '67', 'B5 must show filtered year 67')

  // Filename for Avg + filters
  assert(filename.includes('avg'), `Filename must include avg: ${filename}`)
  assert(filename.includes('ICT'), `Filename must include ICT: ${filename}`)
  assert(filename.includes('วิศวกรรมซอฟต์แวร์'), `Filename must include major: ${filename}`)
  assert(filename.includes('67'), `Filename must include year: ${filename}`)
  console.log('✔ Test 2 passed! Filename:', filename)
}

// ─────────────────────────────────────────────────────────────
// Test 3: All -> metadata แสดง All ถูกต้อง
// ─────────────────────────────────────────────────────────────
console.log('Running Test 3: All -> metadata แสดง All ถูกต้อง...')
{
  const { ws, filename } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantOptions: mockParticipantOptions,
    participantFilter: '',
    facultyFilter: '',
    majorFilter: '',
    yearFilter: '',
    displayTiers: mockDisplayTiers,
  })

  assert.equal(ws['B2']?.v, 'Avg', 'Participant must be Avg')
  assert.equal(ws['B3']?.v, 'All', 'Faculty must be All when unselected')
  assert.equal(ws['B4']?.v, 'All', 'Major must be All when unselected')
  assert.equal(ws['B5']?.v, 'All', 'Academic Year must be All when unselected')

  assert(filename.includes('avg'), `Filename must include avg: ${filename}`)
  assert(!filename.includes('All'), `Filename should omit All filters: ${filename}`)
  console.log('✔ Test 3 passed! Filename:', filename)
}

// ─────────────────────────────────────────────────────────────
// Test 4: filename ไม่มีอักขระต้องห้าม
// ─────────────────────────────────────────────────────────────
console.log('Running Test 4: filename ไม่มีอักขระต้องห้าม...')
{
  const forbiddenCharsRegex = /[/\\:*?"<>|]/

  const edgeCases = [
    {
      template: { title: 'คาเฟ่/2026: The "Best" <Coffee>? *Yes* | No' },
      participantName: 'user/test\\name:with*bad?chars"here<and>there|pipe',
      faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
      major: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
      year: '67',
    },
    {
      template: { title: 'Very Long Title That Exceeds Normal Limits '.repeat(5) },
      participantName: 'SuperLongUsernameThatMightOverflowTheSystemFilenameLimit'.repeat(3),
      faculty: 'คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ',
      major: 'สาขาวิชาเทคโนโลยีนวัตกรรมการประมง',
      year: '65',
    },
    {
      template: { title: 'Special $#@!%^&()_+ Characters' },
      participantName: 'Avg',
      faculty: '',
      major: '',
      year: '',
    },
  ]

  for (const tc of edgeCases) {
    const filename = getExportFilename(tc)
    assert(!forbiddenCharsRegex.test(filename), `Filename contains forbidden characters: ${filename}`)
    assert(filename.endsWith('.xlsx'), `Filename must end with .xlsx: ${filename}`)
    assert(filename.length <= 120, `Filename must not be excessively long (${filename.length}): ${filename}`)
  }

  // Also test sanitizeFilenamePart, getFacultyShortName, and getMajorShortName helpers directly
  const sanitized = sanitizeFilenamePart('a/b\\c:d*e?f"g<h>i|j')
  assert.equal(sanitized, 'abcdefghij', 'All forbidden characters must be removed')

  assert.equal(getFacultyShortName('คณะเทคโนโลยีสารสนเทศและการสื่อสาร'), 'ICT')
  assert.equal(getMajorShortName('สาขาวิชาวิศวกรรมซอฟต์แวร์'), 'วิศวกรรมซอฟต์แวร์')

  console.log('✔ Test 4 passed!')
}

// ─────────────────────────────────────────────────────────────
// Test 5: Participant = All -> วาง User A, User B, User C ในแนวนอน (ต่อขวา)
// ─────────────────────────────────────────────────────────────
console.log('Running Test 5: Participant = All -> วาง User A, User B, User C แนวนอน (ต่อขวา)...')
{
  const mockParticipantsMulti = [
    {
      user_id: 'user-001',
      username: 'มะเหมี่ยว',
      faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
      major: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
      year: '67',
      ranking_items: [
        { item_name: 'Cafe Amazon', tier: 'S', position: 0 },
        { item_name: 'Inthanin', tier: 'S', position: 1 },
        { item_name: 'All Cafe', tier: 'A', position: 0 },
      ],
    },
    {
      user_id: 'user-002',
      username: 'สมชาย',
      faculty: 'คณะวิศวกรรมศาสตร์',
      major: 'สาขาวิชาวิศวกรรมคอมพิวเตอร์',
      year: '66',
      ranking_items: [
        { item_name: 'Starbucks', tier: 'S', position: 0 },
        { item_name: 'Inthanin', tier: 'A', position: 0 },
      ],
    },
    {
      user_id: 'user-003',
      username: 'กานดา',
      faculty: 'คณะบริหารธุรกิจและนิเทศศาสตร์',
      major: 'สาขาวิชาการตลาด',
      year: '65',
      ranking_items: [
        { item_name: 'True Coffee', tier: 'A', position: 0 },
        { item_name: 'All Cafe', tier: 'B', position: 0 },
      ],
    },
  ]

  const mockTiersWithB = [
    ...mockDisplayTiers,
    { label: 'B', color: '#eab308', items: [] },
  ]

  const { wb, ws, filename } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantFilter: 'all',
    facultyFilter: '',
    majorFilter: '',
    yearFilter: '',
    displayTiers: mockTiersWithB,
    filteredRankings: mockParticipantsMulti,
  })

  assert(wb, 'Workbook must be created')
  assert(ws, 'Worksheet must be created')

  // ผู้ใช้เรียงตาม username: กานดา (Col 0, 1 -> A, B), มะเหมี่ยว (Col 3, 4 -> D, E), สมชาย (Col 6, 7 -> G, H)
  // ── Block 0: กานดา (Columns A & B) ──
  assert.equal(ws['A1']?.v, 'Template')
  assert.equal(ws['B1']?.v, 'ร้านกาแฟใน มหาวิทยาลัยพะเยา')
  assert.equal(ws['A2']?.v, 'Participant')
  assert.equal(ws['B2']?.v, 'กานดา')
  assert.equal(ws['A3']?.v, 'Faculty')
  assert.equal(ws['B3']?.v, 'คณะบริหารธุรกิจและนิเทศศาสตร์')
  assert.equal(ws['A4']?.v, 'Major')
  assert.equal(ws['B4']?.v, 'สาขาวิชาการตลาด')
  assert.equal(ws['A5']?.v, 'Academic Year')
  assert.equal(ws['B5']?.v, '65')
  assert(!ws['A6']?.v, 'Row 6 must be blank spacer')
  assert.equal(ws['A7']?.v, 'Tier')
  assert.equal(ws['B7']?.v, 'Items')
  assert.equal(ws['A8']?.v, 'S')
  assert.equal(ws['B8']?.v, '-', 'กานดา ไม่มีไอเทมใน S')
  assert.equal(ws['A9']?.v, 'A')
  assert.equal(ws['B9']?.v, 'True Coffee')
  assert.equal(ws['A10']?.v, 'B')
  assert.equal(ws['B10']?.v, 'All Cafe')

  // ── Spacer Column C (ระหว่าง Block 0 กับ Block 1) ──
  assert(!ws['C1']?.v, 'Column C row 1 must be blank spacer')
  assert(!ws['C2']?.v, 'Column C row 2 must be blank spacer')
  assert(!ws['C7']?.v, 'Column C row 7 must be blank spacer')
  assert(!ws['C8']?.v, 'Column C row 8 must be blank spacer')

  // ── Block 1: มะเหมี่ยว (Columns D & E) ──
  assert.equal(ws['D1']?.v, 'Template')
  assert.equal(ws['E1']?.v, 'ร้านกาแฟใน มหาวิทยาลัยพะเยา')
  assert.equal(ws['D2']?.v, 'Participant')
  assert.equal(ws['E2']?.v, 'มะเหมี่ยว')
  assert.equal(ws['D3']?.v, 'Faculty')
  assert.equal(ws['E3']?.v, 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร')
  assert.equal(ws['D4']?.v, 'Major')
  assert.equal(ws['E4']?.v, 'สาขาวิชาวิศวกรรมซอฟต์แวร์')
  assert.equal(ws['D5']?.v, 'Academic Year')
  assert.equal(ws['E5']?.v, '67')
  assert(!ws['D6']?.v, 'Row 6 must be blank spacer')
  assert.equal(ws['D7']?.v, 'Tier')
  assert.equal(ws['E7']?.v, 'Items')
  assert.equal(ws['D8']?.v, 'S')
  assert.equal(ws['E8']?.v, 'Cafe Amazon, Inthanin')
  assert.equal(ws['D9']?.v, 'A')
  assert.equal(ws['E9']?.v, 'All Cafe')
  assert.equal(ws['D10']?.v, 'B')
  assert.equal(ws['E10']?.v, '-', 'มะเหมี่ยว ไม่มีไอเทมใน B')

  // ── Spacer Column F (ระหว่าง Block 1 กับ Block 2) ──
  assert(!ws['F1']?.v, 'Column F row 1 must be blank spacer')
  assert(!ws['F7']?.v, 'Column F row 7 must be blank spacer')

  // ── Block 2: สมชาย (Columns G & H) ──
  assert.equal(ws['G1']?.v, 'Template')
  assert.equal(ws['H1']?.v, 'ร้านกาแฟใน มหาวิทยาลัยพะเยา')
  assert.equal(ws['G2']?.v, 'Participant')
  assert.equal(ws['H2']?.v, 'สมชาย')
  assert.equal(ws['G3']?.v, 'Faculty')
  assert.equal(ws['H3']?.v, 'คณะวิศวกรรมศาสตร์')
  assert.equal(ws['G4']?.v, 'Major')
  assert.equal(ws['H4']?.v, 'สาขาวิชาวิศวกรรมคอมพิวเตอร์')
  assert.equal(ws['G5']?.v, 'Academic Year')
  assert.equal(ws['H5']?.v, '66')
  assert(!ws['G6']?.v, 'Row 6 must be blank spacer')
  assert.equal(ws['G7']?.v, 'Tier')
  assert.equal(ws['H7']?.v, 'Items')
  assert.equal(ws['G8']?.v, 'S')
  assert.equal(ws['H8']?.v, 'Starbucks')
  assert.equal(ws['G9']?.v, 'A')
  assert.equal(ws['H9']?.v, 'Inthanin')
  assert.equal(ws['G10']?.v, 'B')
  assert.equal(ws['H10']?.v, '-', 'สมชาย ไม่มีไอเทมใน B')

  // ── ตรวจสอบความกว้างของแต่ละบล็อกเท่ากัน ──
  // Col 0, 1, 2 (Block 0): 18, 60, 4
  assert.equal(ws['!cols']?.[0]?.wch, 18)
  assert.equal(ws['!cols']?.[1]?.wch, 60)
  assert.equal(ws['!cols']?.[2]?.wch, 4)
  // Col 3, 4, 5 (Block 1): 18, 60, 4
  assert.equal(ws['!cols']?.[3]?.wch, 18)
  assert.equal(ws['!cols']?.[4]?.wch, 60)
  assert.equal(ws['!cols']?.[5]?.wch, 4)
  // Col 6, 7, 8 (Block 2): 18, 60, 4
  assert.equal(ws['!cols']?.[6]?.wch, 18)
  assert.equal(ws['!cols']?.[7]?.wch, 60)
  assert.equal(ws['!cols']?.[8]?.wch, 4)

  // ── ตรวจสอบ styling และ tier colors ──
  // Metadata bold
  assert.equal(ws['A2']?.s?.font?.bold, true)
  assert.equal(ws['D2']?.s?.font?.bold, true)
  assert.equal(ws['G2']?.s?.font?.bold, true)

  // Header bold
  assert.equal(ws['A7']?.s?.font?.bold, true)
  assert.equal(ws['D7']?.s?.font?.bold, true)
  assert.equal(ws['G7']?.s?.font?.bold, true)

  // Tier S color #ef4444
  assert.equal(ws['A8']?.s?.fill?.fgColor?.rgb, 'FFEF4444')
  assert.equal(ws['D8']?.s?.fill?.fgColor?.rgb, 'FFEF4444')
  assert.equal(ws['G8']?.s?.fill?.fgColor?.rgb, 'FFEF4444')

  // Tier A color #f97316
  assert.equal(ws['A9']?.s?.fill?.fgColor?.rgb, 'FFF97316')
  assert.equal(ws['D9']?.s?.fill?.fgColor?.rgb, 'FFF97316')
  assert.equal(ws['G9']?.s?.fill?.fgColor?.rgb, 'FFF97316')

  // Filename contains 'all'
  assert(filename.includes('all'), `Filename must include 'all': ${filename}`)

  console.log('✔ Test 5 passed! Filename:', filename)
}

// ─────────────────────────────────────────────────────────────
// Test 6: Participant = All + Filter คณะ -> คัดกรองเฉพาะคนที่ตรงกับตัวกรอง
// ─────────────────────────────────────────────────────────────
console.log('Running Test 6: Participant = All + Filter คณะ -> คัดกรองเฉพาะคนที่ตรงกับตัวกรอง...')
{
  const mockParticipantsMulti = [
    {
      user_id: 'user-001',
      username: 'มะเหมี่ยว',
      faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
      major: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
      year: '67',
      ranking_items: [{ item_name: 'Cafe Amazon', tier: 'S' }],
    },
    {
      user_id: 'user-002',
      username: 'สมชาย',
      faculty: 'คณะวิศวกรรมศาสตร์',
      major: 'สาขาวิชาวิศวกรรมคอมพิวเตอร์',
      year: '66',
      ranking_items: [{ item_name: 'Starbucks', tier: 'S' }],
    },
  ]

  const { ws, filename } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantFilter: 'all',
    facultyFilter: 'คณะวิศวกรรมศาสตร์',
    majorFilter: '',
    yearFilter: '',
    displayTiers: mockDisplayTiers,
    filteredRankings: mockParticipantsMulti,
  })

  // เฉพาะสมชายเท่านั้นที่ตรงกับคณะวิศวกรรมศาสตร์ (1 บล็อกที่ A & B)
  assert.equal(ws['B2']?.v, 'สมชาย', 'Participant must be สมชาย')
  assert.equal(ws['B3']?.v, 'คณะวิศวกรรมศาสตร์')
  assert.equal(ws['B8']?.v, 'Starbucks')

  // Column D ไม่ควรมีข้อมูลของมะเหมี่ยว
  assert(!ws['D2']?.v, 'มะเหมี่ยว must not be present when filtered out')

  // Filename contains 'all' and 'ENGR'
  assert(filename.includes('all'), `Filename must include all: ${filename}`)
  assert(filename.includes('ENGR'), `Filename must include ENGR: ${filename}`)
  console.log('✔ Test 6 passed! Filename:', filename)
}

// ─────────────────────────────────────────────────────────────
// Test 7: Participant = All + selectedTiers filter -> แสดงเฉพาะเทียร์ที่เลือก
// ─────────────────────────────────────────────────────────────
console.log('Running Test 7: Participant = All + selectedTiers filter -> แสดงเฉพาะเทียร์ที่เลือก...')
{
  const mockParticipantsMulti = [
    {
      user_id: 'user-001',
      username: 'มะเหมี่ยว',
      ranking_items: [
        { item_name: 'Cafe Amazon', tier: 'S' },
        { item_name: 'All Cafe', tier: 'A' },
      ],
    },
    {
      user_id: 'user-002',
      username: 'สมชาย',
      ranking_items: [
        { item_name: 'Starbucks', tier: 'S' },
        { item_name: 'Inthanin', tier: 'A' },
      ],
    },
  ]

  // เลือกแสดงเฉพาะ Tier S
  const onlyTierS = [{ label: 'S', color: '#ef4444', items: [] }]

  const { ws } = buildCommunityExcelWorkbook(XLSX, {
    template: mockTemplate,
    participantFilter: 'all',
    facultyFilter: '',
    majorFilter: '',
    yearFilter: '',
    displayTiers: onlyTierS,
    filteredRankings: mockParticipantsMulti,
  })

  // แถว 8 คือ Tier S
  assert.equal(ws['A8']?.v, 'S')
  assert.equal(ws['B8']?.v, 'Cafe Amazon')
  assert.equal(ws['D8']?.v, 'S')
  assert.equal(ws['E8']?.v, 'Starbucks')

  // แถว 9 ต้องไม่มีข้อมูลเทียร์ A เพราะไม่ได้เลือก
  assert(!ws['A9']?.v, 'Tier A must not be shown when not in displayTiers')
  assert(!ws['D9']?.v, 'Tier A must not be shown when not in displayTiers')

  console.log('✔ Test 7 passed!')
}

console.log('All Community Participants Excel export tests passed successfully!')
