// 📍 Logic สำหรับจัดเตรียมข้อมูลและการ export Excel ในหน้า Community Participants
// เพิ่ม metadata (Template, Participant, Faculty, Major, Academic Year) ด้านบนก่อนเริ่มตาราง
// และจัดทำ filename ให้สื่อความหมายพร้อม sanitize อักขระต้องห้าม

export const FACULTY_SHORT_NAMES = {
  'คณะเทคโนโลยีสารสนเทศและการสื่อสาร': 'ICT',
  'คณะวิศวกรรมศาสตร์': 'ENGR',
  'คณะบริหารธุรกิจและนิเทศศาสตร์': 'BCA',
  'คณะวิทยาศาสตร์': 'SCI',
  'คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ': 'AGR',
  'คณะนิติศาสตร์': 'LAW',
  'คณะแพทยศาสตร์': 'MED',
  'คณะทันตแพทยศาสตร์': 'DENT',
  'คณะพยาบาลศาสตร์': 'NUR',
  'คณะเภสัชศาสตร์': 'PHARM',
  'คณะพลังงานและสิ่งแวดล้อม': 'SEEN',
  'คณะรัฐศาสตร์และสังคมศาสตร์': 'POL',
  'คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์': 'ARCH',
  'คณะสหเวชศาสตร์': 'AHS',
  'คณะสาธารณสุขศาสตร์': 'PH',
  'คณะวิทยาศาสตร์การแพทย์': 'MEDSCI',
  'คณะศิลปศาสตร์': 'LIBARTS',
  'วิทยาลัยการศึกษา': 'EDU',
}

/**
 * Sanitize filename segment:
 * - ตัดอักขระต้องห้ามใน OS ( / \ : * ? " < > | )
 * - แปลงช่องว่างและ underscore เป็น hyphen
 * - ยุบ hyphen ซ้ำซ้อน
 */
export function sanitizeFilenamePart(str) {
  if (!str) return ''
  return String(str)
    .replace(/[/\\:*?"<>|]/g, '')
    .split('')
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function getFacultyShortName(faculty) {
  if (!faculty || faculty === 'All') return ''
  if (FACULTY_SHORT_NAMES[faculty]) return FACULTY_SHORT_NAMES[faculty]
  const stripped = faculty.replace(/^(คณะ|วิทยาลัย)/, '').trim()
  return sanitizeFilenamePart(stripped)
}

export function getMajorShortName(major) {
  if (!major || major === 'All') return ''
  const stripped = major
    .replace(/^(สาขาวิชา|สาขา|หลักสูตร)/, '')
    .replace(/บัณฑิต$/, '')
    .trim()
  return sanitizeFilenamePart(stripped)
}

/**
 * สร้างชื่อไฟล์ให้สื่อความหมายและปลอดภัยจากอักขระต้องห้าม
 * ตัวอย่าง:
 * template-ร้านกาแฟ-มะเหมี่ยว-วิศวกรรมซอฟต์แวร์-67.xlsx
 * หรือกรณี Avg:
 * template-ร้านกาแฟ-avg-ICT-วิศวกรรมซอฟต์แวร์-67.xlsx
 */
export function getExportFilename({
  template,
  participantName,
  faculty,
  major,
  year,
}) {
  const parts = ['template']

  // Template title (จำกัดความยาวไม่เกิน 30 ตัวอักษรเพื่อไม่ให้ชื่อไฟล์ยาวเกินไป)
  const rawTitle = template?.title || template?.name || template?.id || 'community'
  const titlePart = sanitizeFilenamePart(rawTitle)
  const shortTitle = titlePart.length > 30 ? titlePart.slice(0, 30).replace(/-$/, '') : titlePart
  if (shortTitle) parts.push(shortTitle)

  const isAvg = !participantName || String(participantName).toLowerCase() === 'avg'

  if (isAvg) {
    parts.push('avg')
    const facultyShort = getFacultyShortName(faculty)
    if (facultyShort) parts.push(facultyShort)
  } else {
    parts.push(sanitizeFilenamePart(participantName))
    // ถ้ามี participant แต่ไม่มี major ให้ใส่ faculty ด้วย (ถ้ามี)
    const majorShort = getMajorShortName(major)
    if (!majorShort) {
      const facultyShort = getFacultyShortName(faculty)
      if (facultyShort) parts.push(facultyShort)
    }
  }

  const majorShort = getMajorShortName(major)
  if (majorShort) parts.push(majorShort)

  if (year && year !== 'All') {
    const yearPart = sanitizeFilenamePart(String(year))
    if (yearPart) parts.push(yearPart)
  }

  let finalName = parts.filter(Boolean).join('-')
  finalName = sanitizeFilenamePart(finalName)
  if (finalName.length > 90) {
    finalName = finalName.slice(0, 90).replace(/-$/, '')
  }

  return `${finalName}.xlsx`
}

/**
 * สร้าง Workbook พร้อม metadata ก่อนตาราง Tier | Items และ styling ครบถ้วน
 */
export function buildCommunityExcelWorkbook(XLSX, {
  template,
  participantOptions = [],
  participantFilter = '',
  facultyFilter = '',
  majorFilter = '',
  yearFilter = '',
  displayTiers = [],
}) {
  // ดึงชื่อผู้เข้าร่วม: ถ้าเลือกคนใดให้ใช้ username/display name ห้ามใช้ user_id
  let participantDisplay = 'Avg'
  if (participantFilter) {
    const found = participantOptions.find(p => p.user_id === participantFilter)
    participantDisplay = found?.username || found?.display_name || found?.name || 'Unknown'
  }

  const templateTitle = template?.title || template?.name || template?.id || '-'
  const facultyDisplay = facultyFilter || 'All'
  const majorDisplay = majorFilter || 'All'
  const yearDisplay = yearFilter ? String(yearFilter) : 'All'

  // Metadata แถว 0-4
  // แถว 5 ว่าง 1 แถว
  // แถว 6 Table Header: Tier | Items
  // แถว 7+ Tier Data rows
  const aoaRows = [
    ['Template', templateTitle],
    ['Participant', participantDisplay],
    ['Faculty', facultyDisplay],
    ['Major', majorDisplay],
    ['Academic Year', yearDisplay],
    [],
    ['Tier', 'Items'],
    ...displayTiers.map(tier => [
      tier.label,
      tier.items.map(i => i.name).join(', ') || '-',
    ]),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaRows)

  // Column widths: A ให้พอดีกับ label, B กว้างพอให้อ่านชื่อคณะ/สาขา/items ได้สบาย
  ws['!cols'] = [{ wch: 18 }, { wch: 80 }]

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }

  // 1. Metadata labels (Column A, rows 0-4): font bold
  for (let r = 0; r < 5; r++) {
    const labelCell = XLSX.utils.encode_cell({ r, c: 0 })
    if (ws[labelCell]) {
      ws[labelCell].s = {
        font: { bold: true },
      }
    }
  }

  // 2. Table Header (A7:B7 -> r: 6, c: 0 and c: 1): bold + thin border
  const headerRowIdx = 6
  for (let c = 0; c <= 1; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIdx, c })
    if (!ws[cellAddress]) ws[cellAddress] = {}
    ws[cellAddress].s = {
      border: thinBorder,
      font: { bold: true },
    }
  }

  // 3. Table data rows (r: 7+): tier color in col A + thin border
  displayTiers.forEach((tier, idx) => {
    const rowIdx = 7 + idx

    // Tier cell (col A)
    const tierCell = XLSX.utils.encode_cell({ r: rowIdx, c: 0 })
    if (!ws[tierCell]) ws[tierCell] = {}
    const hexColor = (tier.color || '').replace('#', '').toUpperCase()
    ws[tierCell].s = {
      border: thinBorder,
      fill: hexColor ? { fgColor: { rgb: 'FF' + hexColor } } : undefined,
      font: { bold: true },
    }

    // Items cell (col B)
    const itemsCell = XLSX.utils.encode_cell({ r: rowIdx, c: 1 })
    if (!ws[itemsCell]) ws[itemsCell] = {}
    ws[itemsCell].s = { border: thinBorder }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Community Average')

  const filename = getExportFilename({
    template,
    participantName: participantDisplay,
    faculty: facultyDisplay,
    major: majorDisplay,
    year: yearDisplay,
  })

  return { wb, ws, filename }
}
