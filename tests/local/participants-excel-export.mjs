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

console.log('All Community Participants Excel export tests passed successfully!')
