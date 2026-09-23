import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdmissionYears } from '../../src/lib/university.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

console.log('Testing Community Participants filters...')

// 1. Check admissionYears generation logic
const rawYears = getAdmissionYears()
const filteredYears = rawYears
  .map(Number)
  .filter((y) => y >= 53)
  .sort((a, b) => b - a)
  .map(String)

assert(filteredYears.length > 0, 'filteredYears should not be empty')
assert.equal(filteredYears[filteredYears.length - 1], '53', 'Lowest year must be 53')

// Verify strictly descending order
for (let i = 0; i < filteredYears.length - 1; i++) {
  assert(
    Number(filteredYears[i]) > Number(filteredYears[i + 1]),
    `Years must be sorted descending: ${filteredYears[i]} > ${filteredYears[i + 1]}`
  )
}

// Verify years 38-52 are excluded
for (let y = 38; y <= 52; y++) {
  assert(
    !filteredYears.includes(String(y)),
    `Year ${y} must be excluded from filtered years`
  )
}

console.log('✔ Academic years filtered and sorted properly:', filteredYears.slice(0, 5), '...', filteredYears[filteredYears.length - 1])

// 2. Check CommunityParticipants.jsx contains the expected code
const compFile = fs
  .readFileSync(path.join(rootDir, 'src/pages/CommunityParticipants.jsx'), 'utf-8')
  .replace(/\r\n/g, '\n')

// Check participant dropdown first option
assert(
  compFile.includes("<option value=\"\">{t('participants.avg', 'Avg')}</option>"),
  'Participant select must have option value="" with t(\'participants.avg\', \'Avg\')'
)

// Check year filter logic
assert(
  compFile.includes('filter((y) => y >= 53)'),
  'Must filter years >= 53'
)
assert(
  compFile.includes('.sort((a, b) => b - a)'),
  'Must sort years descending'
)

// Check academic year select keeps 'All' option at top
assert(
  compFile.includes('<option value="">{t(\'participants.all\')}</option>\n              {admissionYears.map(y => ('),
  'Academic year dropdown must retain All option at top'
)

console.log('✔ CommunityParticipants.jsx code structure verified')

// 3. Check locales
const enLocales = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'src/locales/en.json'), 'utf-8')
)
const thLocales = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'src/locales/th.json'), 'utf-8')
)

assert.equal(enLocales.participants?.avg, 'Avg', 'en.json must have participants.avg = "Avg"')
assert.equal(thLocales.participants?.avg, 'Avg', 'th.json must have participants.avg = "Avg"')

console.log('✔ Locales verified')
console.log('All tests passed successfully!')
