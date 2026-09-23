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
  const isAll = String(participantName).toLowerCase() === 'all'

  if (isAvg) {
    parts.push('avg')
    const facultyShort = getFacultyShortName(faculty)
    if (facultyShort) parts.push(facultyShort)
  } else if (isAll) {
    parts.push('all')
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
 * ดึงรายการไอเทมใน tier ที่ระบุของผู้เข้าร่วม
 */
export function getUserTierItems(participant, tierLabel) {
  if (!participant) return '-'
  const normLabel = String(tierLabel || '').trim().toLowerCase()

  // 1. กรณี participant มี tiers array ที่จัดกลุ่มไอเทมไว้แล้ว
  if (Array.isArray(participant.tiers)) {
    const foundTier = participant.tiers.find(
      t => String(t.label || t.name || '').trim().toLowerCase() === normLabel
    )
    if (foundTier && Array.isArray(foundTier.items) && foundTier.items.length > 0) {
      const names = foundTier.items
        .map(i => (typeof i === 'string' ? i : i.name || i.item_name || i.item_id || ''))
        .filter(Boolean)
      if (names.length > 0) return names.join(', ')
    }
  }

  // 2. กรณี participant มี ranking_items หรือ items แบบ flat array
  const flatItems = participant.ranking_items || participant.items || []
  if (Array.isArray(flatItems) && flatItems.length > 0) {
    const matching = flatItems
      .filter(i => String(i.tier || '').trim().toLowerCase() === normLabel)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(i => i.item_name || i.name || i.item_id || '')
      .filter(Boolean)

    if (matching.length > 0) {
      return matching.join(', ')
    }
  }

  return '-'
}

/**
 * สร้าง Workbook พร้อม metadata ก่อนตาราง Tier | Items และ styling ครบถ้วน
 * รองรับทั้ง:
 * 1. participantFilter === 'all' -> วางแต่ละ block ไปทางขวา (User A block, User B block...)
 * 2. participantFilter === '' (Avg) -> บล็อกค่าเฉลี่ยชุมชนเดี่ยว
 * 3. participantFilter === 'user_id' -> บล็อกผู้ใช้เดี่ยว
 */
export function buildCommunityExcelWorkbook(XLSX, {
  template,
  participantOptions = [],
  participantFilter = '',
  facultyFilter = '',
  majorFilter = '',
  yearFilter = '',
  displayTiers = [],
  filteredRankings = [],
  participants = [],
}) {
  const isAllMode = String(participantFilter).toLowerCase() === 'all'
  const templateTitle = template?.title || template?.name || template?.id || '-'
  const facultyDisplay = facultyFilter || 'All'
  const majorDisplay = majorFilter || 'All'
  const yearDisplay = yearFilter ? String(yearFilter) : 'All'

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }

  const wb = XLSX.utils.book_new()

  // ─────────────────────────────────────────────────────────────
  // โหมด Participant = All: วางแต่ละ user block ต่อกันไปทางขวา (แนวนอน)
  // ─────────────────────────────────────────────────────────────
  if (isAllMode) {
    // รวมรายชื่อ participants จาก filteredRankings > participants > participantOptions
    const candidateList = filteredRankings.length > 0
      ? filteredRankings
      : (participants.length > 0 ? participants : participantOptions)

    // กรองตาม faculty, major, year
    const matching = candidateList.filter(p => {
      if (facultyFilter && p.faculty && p.faculty !== facultyFilter) return false
      if (majorFilter && p.major && p.major !== majorFilter) return false
      if (yearFilter && p.year && String(p.year) !== String(yearFilter)) return false
      return true
    })

    // Deduplicate ตาม user_id
    const seenUserIds = new Set()
    const targetParticipants = []
    for (const p of matching) {
      const uid = p.user_id || p.id || p.username
      if (uid && !seenUserIds.has(uid)) {
        seenUserIds.add(uid)
        targetParticipants.push(p)
      }
    }

    // เรียงตาม username ก-ฮ เพื่อความเป็นระเบียบและคาดเดาได้
    targetParticipants.sort((a, b) =>
      String(a.username || '').localeCompare(String(b.username || ''))
    )

    // กรณีไม่มีข้อมูล ให้มี 1 block แสดง empty state
    const effectiveParticipants = targetParticipants.length > 0 ? targetParticipants : [
      {
        username: 'All',
        faculty: facultyDisplay,
        major: majorDisplay,
        year: yearDisplay,
        ranking_items: [],
      }
    ]

    const N = effectiveParticipants.length
    const totalRowsCount = 7 + displayTiers.length
    const aoaRows = Array.from({ length: totalRowsCount }, () => [])

    effectiveParticipants.forEach((p, k) => {
      const startCol = k * 3
      const username = p.username || p.display_name || p.name || 'Unknown'
      const faculty = p.faculty || facultyDisplay
      const major = p.major || majorDisplay
      const year = p.year ? String(p.year) : yearDisplay

      // แถว 0-4 Metadata ของผู้ใช้แต่ละคน
      aoaRows[0][startCol] = 'Template'
      aoaRows[0][startCol + 1] = templateTitle
      aoaRows[0][startCol + 2] = ''

      aoaRows[1][startCol] = 'Participant'
      aoaRows[1][startCol + 1] = username
      aoaRows[1][startCol + 2] = ''

      aoaRows[2][startCol] = 'Faculty'
      aoaRows[2][startCol + 1] = faculty
      aoaRows[2][startCol + 2] = ''

      aoaRows[3][startCol] = 'Major'
      aoaRows[3][startCol + 1] = major
      aoaRows[3][startCol + 2] = ''

      aoaRows[4][startCol] = 'Academic Year'
      aoaRows[4][startCol + 1] = year
      aoaRows[4][startCol + 2] = ''

      // แถว 5 ช่องว่างคั่นระหว่าง metadata กับตาราง
      aoaRows[5][startCol] = ''
      aoaRows[5][startCol + 1] = ''
      aoaRows[5][startCol + 2] = ''

      // แถว 6 Header ตาราง: Tier | Items
      aoaRows[6][startCol] = 'Tier'
      aoaRows[6][startCol + 1] = 'Items'
      aoaRows[6][startCol + 2] = ''

      // แถว 7+ Tier Data rows
      displayTiers.forEach((tier, tIdx) => {
        const rIdx = 7 + tIdx
        aoaRows[rIdx][startCol] = tier.label
        aoaRows[rIdx][startCol + 1] = getUserTierItems(p, tier.label)
        aoaRows[rIdx][startCol + 2] = ''
      })
    })

    const ws = XLSX.utils.aoa_to_sheet(aoaRows)

    // Column widths: แต่ละ block กว้างเท่ากัน (Tier 18 wch, Items 60 wch, spacer 4 wch)
    const colWidths = []
    for (let k = 0; k < N; k++) {
      colWidths.push({ wch: 18 })
      colWidths.push({ wch: 60 })
      colWidths.push({ wch: 4 })
    }
    ws['!cols'] = colWidths

    // Styling สำหรับแต่ละบล็อก
    effectiveParticipants.forEach((_, k) => {
      const startCol = k * 3

      // 1. Metadata labels bold (Col startCol, แถว 0-4)
      for (let r = 0; r < 5; r++) {
        const labelCell = XLSX.utils.encode_cell({ r, c: startCol })
        if (ws[labelCell]) {
          ws[labelCell].s = { font: { bold: true } }
        }
      }

      // 2. Table Header bold + border (แถว 6: Col startCol และ startCol + 1)
      for (let c = startCol; c <= startCol + 1; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 6, c })
        if (!ws[cellAddress]) ws[cellAddress] = {}
        ws[cellAddress].s = {
          border: thinBorder,
          font: { bold: true },
        }
      }

      // 3. Table data rows (แถว 7+): tier color fill + border
      displayTiers.forEach((tier, tIdx) => {
        const rowIdx = 7 + tIdx

        // Tier cell (Col startCol)
        const tierCell = XLSX.utils.encode_cell({ r: rowIdx, c: startCol })
        if (!ws[tierCell]) ws[tierCell] = {}
        const hexColor = (tier.color || '').replace('#', '').toUpperCase()
        ws[tierCell].s = {
          border: thinBorder,
          fill: hexColor ? { fgColor: { rgb: 'FF' + hexColor } } : undefined,
          font: { bold: true },
        }

        // Items cell (Col startCol + 1)
        const itemsCell = XLSX.utils.encode_cell({ r: rowIdx, c: startCol + 1 })
        if (!ws[itemsCell]) ws[itemsCell] = {}
        ws[itemsCell].s = { border: thinBorder }
      })
    })

    XLSX.utils.book_append_sheet(wb, ws, 'All Participants')

    const filename = getExportFilename({
      template,
      participantName: 'All',
      faculty: facultyDisplay,
      major: majorDisplay,
      year: yearDisplay,
    })

    return { wb, ws, filename }
  }

  // ─────────────────────────────────────────────────────────────
  // โหมด Avg หรือ เลือกผู้ใช้คนเดียว (1 block ที่คอลัมน์ A & B)
  // ─────────────────────────────────────────────────────────────
  let participantDisplay = 'Avg'
  if (participantFilter) {
    const found = participantOptions.find(p => p.user_id === participantFilter)
    participantDisplay = found?.username || found?.display_name || found?.name || 'Unknown'
  }

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
      tier.items.map(i => i.name || i.item_name || i.item_id).join(', ') || '-',
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoaRows)

  // Column widths: A ให้พอดีกับ label, B กว้างพอให้อ่านชื่อคณะ/สาขา/items ได้สบาย
  ws['!cols'] = [{ wch: 18 }, { wch: 80 }]

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
