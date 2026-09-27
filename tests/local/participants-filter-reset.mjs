import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

console.log('Testing Template Detailed View "All / ทุกคน" filter behavior & reset rules...')

// 1. Static code verification on CommunityParticipants.jsx
const compFile = fs
  .readFileSync(path.join(rootDir, 'src/pages/CommunityParticipants.jsx'), 'utf-8')
  .replace(/\r\n/g, '\n')

// Ensure applyParticipantSelection handles 'all' by resetting facultyFilter, majorFilter, and yearFilter
assert(
  compFile.includes("if (userId === 'all') {\n      setFacultyFilter('')\n      setMajorFilter('')\n      setYearFilter('')\n      return\n    }"),
  "applyParticipantSelection('all') must reset facultyFilter, majorFilter, and yearFilter to ''"
)

// Ensure handleFacultyChange sets participantFilter appropriately
assert(
  compFile.includes("setParticipantFilter(value ? '' : 'all')"),
  "handleFacultyChange must set participantFilter to '' (filtered/avg mode) when value is non-empty, and 'all' when value is ''"
)

// Ensure handleMajorChange does NOT reset facultyFilter (no reverse reset)
assert(
  compFile.includes("const handleMajorChange = useCallback((value) => {\n    setMajorFilter(value)\n    setParticipantFilter('')\n  }, [])"),
  "handleMajorChange must update majorFilter without resetting facultyFilter"
)

// Ensure clearAllFilters resets all filters
assert(
  compFile.includes("const clearAllFilters = useCallback(() => {\n    setSelectedTiers([])\n    setParticipantFilter('all')\n    setFacultyFilter('')\n    setMajorFilter('')\n    setYearFilter('')\n  }, [])"),
  "clearAllFilters must reset selectedTiers, participantFilter to 'all', and faculty/major/year to ''"
)

console.log('✔ Static code structure verified.')

// 2. Behavioral simulation of state transitions and filter calculations
const mockParticipants = [
  {
    user_id: 'u-eng-comp',
    username: 'Bob Eng',
    faculty: 'คณะวิศวกรรมศาสตร์',
    major: 'สาขาวิชาวิศวกรรมคอมพิวเตอร์',
    year: '66',
  },
  {
    user_id: 'u-eng-civil',
    username: 'Alice Eng',
    faculty: 'คณะวิศวกรรมศาสตร์',
    major: 'สาขาวิชาวิศวกรรมโยธา',
    year: '67',
  },
  {
    user_id: 'u-ict-se',
    username: 'Charlie ICT',
    faculty: 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    major: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
    year: '67',
  },
  {
    user_id: 'u-sci-math',
    username: 'Dave Sci',
    faculty: 'คณะวิทยาศาสตร์',
    major: 'สาขาวิชาคณิตศาสตร์',
    year: '65',
  },
]

function runFilterRankings(participants, { participantFilter, facultyFilter, majorFilter, yearFilter }) {
  return participants.filter(p => {
    if (participantFilter && participantFilter !== 'all' && p.user_id !== participantFilter) return false
    if (facultyFilter && p.faculty !== facultyFilter) return false
    if (majorFilter && p.major !== majorFilter) return false
    if (yearFilter && String(p.year) !== yearFilter) return false
    return true
  })
}

// Stateful simulator matching CommunityParticipants.jsx logic
class ParticipantsFilterSimulator {
  constructor(participants) {
    this.participants = participants
    this.participantFilter = 'all'
    this.facultyFilter = ''
    this.majorFilter = ''
    this.yearFilter = ''
  }

  applyParticipantSelection(userId) {
    this.participantFilter = userId
    if (userId === 'all') {
      this.facultyFilter = ''
      this.majorFilter = ''
      this.yearFilter = ''
      return
    }
    if (!userId) return

    const p = this.participants.find(x => x.user_id === userId)
    if (!p) return
    this.facultyFilter = p.faculty || ''
    this.majorFilter = p.major || ''
    this.yearFilter = p.year ? String(p.year) : ''
  }

  handleFacultyChange(value) {
    this.facultyFilter = value
    this.majorFilter = ''
    this.participantFilter = value ? '' : 'all'
  }

  handleMajorChange(value) {
    this.majorFilter = value
    this.participantFilter = ''
  }

  handleYearChange(value) {
    this.yearFilter = value
    this.participantFilter = value || this.facultyFilter || this.majorFilter ? '' : 'all'
  }

  getFiltered() {
    return runFilterRankings(this.participants, {
      participantFilter: this.participantFilter,
      facultyFilter: this.facultyFilter,
      majorFilter: this.majorFilter,
      yearFilter: this.yearFilter,
    })
  }
}

// ─────────────────────────────────────────────────────────────
// Scenario 1: Faculty = specific, Major = specific -> เลือก All -> Faculty = All, Major = All, ผลลัพธ์แสดงทุกคน
// ─────────────────────────────────────────────────────────────
console.log('Testing Scenario 1: Faculty = specific, Major = specific -> เลือก All...')
{
  const sim = new ParticipantsFilterSimulator(mockParticipants)

  // User sets Faculty = คณะวิศวกรรมศาสตร์, Major = สาขาวิชาวิศวกรรมคอมพิวเตอร์
  sim.handleFacultyChange('คณะวิศวกรรมศาสตร์')
  sim.handleMajorChange('สาขาวิชาวิศวกรรมคอมพิวเตอร์')

  assert.equal(sim.facultyFilter, 'คณะวิศวกรรมศาสตร์')
  assert.equal(sim.majorFilter, 'สาขาวิชาวิศวกรรมคอมพิวเตอร์')
  let filtered = sim.getFiltered()
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].user_id, 'u-eng-comp')

  // User selects "All / ทุกคน"
  sim.applyParticipantSelection('all')

  assert.equal(sim.participantFilter, 'all', 'participantFilter must be "all"')
  assert.equal(sim.facultyFilter, '', 'facultyFilter must be reset to All ("")')
  assert.equal(sim.majorFilter, '', 'majorFilter must be reset to All ("")')
  assert.equal(sim.yearFilter, '', 'yearFilter must be reset to All ("")')

  filtered = sim.getFiltered()
  assert.equal(filtered.length, mockParticipants.length, 'Results must contain all participants with zero stale filtering')
  console.log('✔ Scenario 1 passed!')
}

// ─────────────────────────────────────────────────────────────
// Scenario 2: Faculty = specific, Major = All -> เลือก All -> Faculty = All, Major = All
// ─────────────────────────────────────────────────────────────
console.log('Testing Scenario 2: Faculty = specific, Major = All -> เลือก All...')
{
  const sim = new ParticipantsFilterSimulator(mockParticipants)

  // User sets Faculty = คณะวิศวกรรมศาสตร์, Major = All ('')
  sim.handleFacultyChange('คณะวิศวกรรมศาสตร์')
  assert.equal(sim.facultyFilter, 'คณะวิศวกรรมศาสตร์')
  assert.equal(sim.majorFilter, '')

  let filtered = sim.getFiltered()
  assert.equal(filtered.length, 2, 'Only Engineering students before selecting All')
  assert(filtered.every(p => p.faculty === 'คณะวิศวกรรมศาสตร์'))

  // User selects "All / ทุกคน"
  sim.applyParticipantSelection('all')

  assert.equal(sim.participantFilter, 'all', 'participantFilter must be "all"')
  assert.equal(sim.facultyFilter, '', 'facultyFilter must be reset to All ("")')
  assert.equal(sim.majorFilter, '', 'majorFilter must be reset to All ("")')

  filtered = sim.getFiltered()
  assert.equal(filtered.length, mockParticipants.length, 'Results must contain all participants')
  console.log('✔ Scenario 2 passed!')
}

// ─────────────────────────────────────────────────────────────
// Scenario 3: การเลือก filter อื่นที่ไม่ใช่ All ยังต้องทำงานได้ตามปกติ ไม่เผลอถูก reset กลายเป็น All
// ─────────────────────────────────────────────────────────────
console.log('Testing Scenario 3: Non-All filters function normally without accidental reset...')
{
  const sim = new ParticipantsFilterSimulator(mockParticipants)

  // 3a. Selecting specific faculty
  sim.handleFacultyChange('คณะวิทยาศาสตร์')
  assert.equal(sim.facultyFilter, 'คณะวิทยาศาสตร์', 'Faculty must be คณะวิทยาศาสตร์')
  assert.equal(sim.majorFilter, '', 'Major defaults to empty for new faculty')
  assert.equal(sim.getFiltered().length, 1)

  // 3b. Selecting specific major
  sim.handleMajorChange('สาขาวิชาคณิตศาสตร์')
  assert.equal(sim.facultyFilter, 'คณะวิทยาศาสตร์', 'Faculty remains คณะวิทยาศาสตร์')
  assert.equal(sim.majorFilter, 'สาขาวิชาคณิตศาสตร์', 'Major remains สาขาวิชาคณิตศาสตร์')
  assert.equal(sim.getFiltered().length, 1)

  // 3c. Reset Rule: Selecting Major = All does NOT reset Faculty to All!
  sim.handleMajorChange('')
  assert.equal(sim.majorFilter, '', 'Major is All')
  assert.equal(sim.facultyFilter, 'คณะวิทยาศาสตร์', 'Faculty must NOT be reset when Major = All (no reverse reset)')
  assert.equal(sim.getFiltered().length, 1)

  // 3d. Selecting specific participant auto-populates their profile
  sim.applyParticipantSelection('u-ict-se')
  assert.equal(sim.participantFilter, 'u-ict-se')
  assert.equal(sim.facultyFilter, 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร')
  assert.equal(sim.majorFilter, 'สาขาวิชาวิศวกรรมซอฟต์แวร์')
  assert.equal(sim.yearFilter, '67')
  assert.equal(sim.getFiltered().length, 1)
  assert.equal(sim.getFiltered()[0].user_id, 'u-ict-se')

  // 3e. Transition from participant selection to "All / ทุกคน" resets profile filters
  sim.applyParticipantSelection('all')
  assert.equal(sim.participantFilter, 'all')
  assert.equal(sim.facultyFilter, '')
  assert.equal(sim.majorFilter, '')
  assert.equal(sim.yearFilter, '')
  assert.equal(sim.getFiltered().length, mockParticipants.length)

  console.log('✔ Scenario 3 passed!')
}

// ─────────────────────────────────────────────────────────────
// Scenario D: Repeat: Specific -> All -> Specific -> All (No stale state)
// ─────────────────────────────────────────────────────────────
console.log('Testing Scenario D: Repeat Specific -> All -> Specific -> All...')
{
  const sim = new ParticipantsFilterSimulator(mockParticipants)

  // Cycle 1: Specific
  sim.handleFacultyChange('คณะวิศวกรรมศาสตร์')
  sim.handleMajorChange('สาขาวิชาวิศวกรรมคอมพิวเตอร์')
  sim.handleYearChange('66')
  assert.equal(sim.getFiltered().length, 1)

  // Cycle 1: All
  sim.applyParticipantSelection('all')
  assert.equal(sim.participantFilter, 'all')
  assert.equal(sim.facultyFilter, '')
  assert.equal(sim.majorFilter, '')
  assert.equal(sim.yearFilter, '')
  assert.equal(sim.getFiltered().length, mockParticipants.length)

  // Cycle 2: Specific
  sim.handleFacultyChange('คณะเทคโนโลยีสารสนเทศและการสื่อสาร')
  sim.handleMajorChange('สาขาวิชาวิศวกรรมซอฟต์แวร์')
  assert.equal(sim.facultyFilter, 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร')
  assert.equal(sim.majorFilter, 'สาขาวิชาวิศวกรรมซอฟต์แวร์')
  assert.equal(sim.getFiltered().length, 1)
  assert.equal(sim.getFiltered()[0].user_id, 'u-ict-se')

  // Cycle 2: All
  sim.applyParticipantSelection('all')
  assert.equal(sim.participantFilter, 'all')
  assert.equal(sim.facultyFilter, '')
  assert.equal(sim.majorFilter, '')
  assert.equal(sim.yearFilter, '')
  assert.equal(sim.getFiltered().length, mockParticipants.length)

  console.log('✔ Scenario D passed! No stale state across repeated cycles.')
}

console.log('All "All / ทุกคน" filter behavior tests passed successfully!')
