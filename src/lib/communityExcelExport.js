// 📍 Logic สำหรับจัดเตรียมข้อมูลและการ export Excel ในหน้า Community Participants
// เพิ่ม metadata (Template, Participant, Faculty, Major, Academic Year) ด้านบนก่อนเริ่มตาราง
// และจัดทำ filename ให้สื่อความหมายพร้อม sanitize อักขระต้องห้าม
// พร้อม Sheet การวิเคราะห์รสชาติต่อมวลรวม (Taste & Participant Analysis)

import { calculateTierSimilarity, calculateCommunitySimilarity } from './similarity.js'

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
  if (Object.hasOwn(FACULTY_SHORT_NAMES, faculty)) return FACULTY_SHORT_NAMES[faculty]
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
  const normLabel = String(tierLabel || '')

  // 1. กรณี participant มี tiers array ที่จัดกลุ่มไอเทมไว้แล้ว
  if (Array.isArray(participant.tiers)) {
    const foundTier = participant.tiers.find(
      t => String(t.label || t.name || '') === normLabel
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
      .filter(i => String(i.tier || '') === normLabel)
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
 * ดึง placements แบบ array of { item_id, item_name, tier } จาก participant
 */
export function extractParticipantPlacements(participant) {
  if (!participant) return []

  const flatItems = participant.ranking_items || participant.items
  if (Array.isArray(flatItems) && flatItems.length > 0) {
    return flatItems
      .filter(i => i && (i.item_id || i.id || i.name || i.item_name) && i.tier !== undefined && i.tier !== null && i.tier !== '')
      .map(i => ({
        item_id: String(i.item_id || i.id || i.name || i.item_name || ''),
        item_name: String(i.item_name || i.name || i.item_id || i.id || ''),
        tier: String(i.tier || ''),
      }))
  }

  if (Array.isArray(participant.tiers)) {
    const placements = []
    participant.tiers.forEach(tier => {
      const tierLabel = tier.label || tier.name || ''
      if (Array.isArray(tier.items)) {
        tier.items.forEach(item => {
          if (typeof item === 'string' && item) {
            placements.push({ item_id: item, item_name: item, tier: String(tierLabel) })
          } else if (item && typeof item === 'object') {
            const id = String(item.item_id || item.id || item.name || item.item_name || '')
            const name = String(item.name || item.item_name || id)
            if (id) {
              placements.push({ item_id: id, item_name: name, tier: String(tierLabel) })
            }
          }
        })
      }
    })
    return placements
  }

  return []
}

/**
 * สร้างสถิติเฉลี่ยของแต่ละไอเทมในระดับมวลชน (Community Average by Item)
 * โดยใช้ลำดับ tier index จริงจาก template (0 = แถวสูงสุด)
 */
export function buildCommunityItemStats(rankings = [], tiersDef = []) {
  const tierIndexByLabel = new Map()
  tiersDef.forEach((t, i) => {
    if (t && typeof t.label === 'string') {
      tierIndexByLabel.set(String(t.label), i)
    }
  })

  const tierCount = tiersDef.length
  const communityByItem = Object.create(null) // itemId -> { sum: number, count: number, name: string }

  rankings.forEach(ranking => {
    const placements = extractParticipantPlacements(ranking)
    placements.forEach(p => {
      if (!p.tier) return
      const tierIdx = tierIndexByLabel.get(String(p.tier))
      if (tierIdx === undefined) return

      const id = p.item_id
      if (!communityByItem[id]) {
        communityByItem[id] = { sum: 0, count: 0, name: p.item_name || id }
      }
      communityByItem[id].sum += tierIdx
      communityByItem[id].count += 1
    })
  })

  return { communityByItem, tierIndexByLabel, tierCount }
}

/**
 * สร้างข้อความอธิบายความโดดเด่น/ลักษณะเฉพาะตัวของผู้ใช้ (Standout Summary)
 * จาก deterministic rules โดยไม่ใช้คำเชิงตัดสินคุณค่า (ไม่ใช้ best/worst/better/bad)
 */
export function generateStandoutSummary({ similarity, highestItem, lowestItem }) {
  if (typeof similarity !== 'number') return '-'

  const hasHigh = Boolean(highestItem && highestItem.diff >= 0.75)
  const hasLow = Boolean(lowestItem && lowestItem.diff <= -0.75)

  if (similarity >= 85) {
    if (hasHigh) {
      return `Very close to Community Average; slight preference for "${highestItem.name}"`
    }
    return 'Very close to Community Average'
  }

  if (similarity <= 50) {
    if (hasHigh && hasLow) {
      return `Highly distinctive ranking; strong preference for "${highestItem.name}", rates "${lowestItem.name}" below community`
    }
    if (hasHigh) {
      return `Highly distinctive ranking; strong preference for "${highestItem.name}"`
    }
    if (hasLow) {
      return `Highly distinctive ranking; much less favorable toward "${lowestItem.name}"`
    }
    return 'Highly distinctive ranking'
  }

  // 51 - 84%
  if (hasHigh && hasLow) {
    return `Strong preference for "${highestItem.name}"; rates "${lowestItem.name}" below community`
  }
  if (hasHigh) {
    return `Strong preference for "${highestItem.name}"`
  }
  if (hasLow) {
    return `Much less favorable toward "${lowestItem.name}"`
  }
  return 'Moderate alignment with Community Average'
}

/**
 * คำนวณการวิเคราะห์รสชาติของผู้เข้าร่วมและเปรียบเทียบ Pairwise
 */
export function calculateCommunityTasteAnalysis({
  template,
  participants = [],
  filteredRankings,
  tiersDef = [],
}) {
  const effectiveTiers = (tiersDef && tiersDef.length > 0) ? tiersDef : (template?.tiers || [])
  const rankingPool = filteredRankings ?? participants
  const { communityByItem, tierIndexByLabel, tierCount } = buildCommunityItemStats(
    rankingPool,
    effectiveTiers
  )

  const sampleCount = rankingPool.length

  // 1. วิเคราะห์ผู้เข้าร่วมแต่ละคน
  const analyzedParticipants = participants.map(participant => {
    const placements = extractParticipantPlacements(participant)
    const simScore = calculateCommunitySimilarity(
      placements,
      communityByItem,
      effectiveTiers,
      sampleCount,
      1 // minSamples threshold: allow comparison even with small filtered subsets
    )

    // คำนวณความต่างรายไอเทม
    const itemDiffs = []
    placements.forEach(p => {
      const userTierIdx = tierIndexByLabel.get(String(p.tier))
      if (userTierIdx === undefined) return
      const comm = communityByItem[p.item_id]
      if (comm && comm.count > 0) {
        const commAvgIdx = comm.sum / comm.count
        const diff = commAvgIdx - userTierIdx // positive = user gives higher tier, negative = user gives lower tier
        const absDiff = Math.abs(diff)
        const commNearestIdx = Math.max(0, Math.min(tierCount - 1, Math.round(commAvgIdx)))
        const commTierLabel = effectiveTiers[commNearestIdx]?.label || '-'
        itemDiffs.push({
          id: p.item_id,
          name: p.item_name || p.item_id,
          userTier: p.tier,
          userTierIdx,
          commTier: commTierLabel,
          commAvgIdx,
          diff,
          absDiff,
        })
      }
    })

    // highestItem: User ให้สูงกว่า community มากที่สุด (diff > 0.5)
    const higherItems = itemDiffs
      .filter(i => i.diff > 0.5)
      .sort((a, b) => b.diff - a.diff || a.name.localeCompare(b.name))
    const highestItem = higherItems[0] || null

    // lowestItem: User ให้ต่ำกว่า community มากที่สุด (diff < -0.5)
    const lowerItems = itemDiffs
      .filter(i => i.diff < -0.5)
      .sort((a, b) => a.diff - b.diff || a.name.localeCompare(b.name))
    const lowestItem = lowerItems[0] || null

    // mostDifferentItem: มีความต่างทางความคิดเห็นมากที่สุด (absDiff > 0.5)
    const diffItems = [...itemDiffs]
      .filter(i => i.absDiff > 0.5)
      .sort((a, b) => b.absDiff - a.absDiff || a.name.localeCompare(b.name))
    const mostDifferentItem = diffItems[0] || null

    const similarity = typeof simScore === 'number' ? simScore : 0
    const standoutSummary = generateStandoutSummary({
      similarity,
      highestItem,
      lowestItem,
    })

    const mostDiffStr = mostDifferentItem
      ? `${mostDifferentItem.name} (${mostDifferentItem.userTier} vs Avg ${mostDifferentItem.commTier})`
      : '-'

    const strongPrefStr = highestItem
      ? `${highestItem.name} (+${Math.round(highestItem.diff * 10) / 10} tier)`
      : '-'

    const lowerPrefStr = lowestItem
      ? `${lowestItem.name} (${Math.round(lowestItem.diff * 10) / 10} tier)`
      : '-'

    return {
      user_id: participant.user_id || participant.id || participant.username,
      username: participant.username || participant.display_name || participant.name || 'Unknown',
      faculty: participant.faculty || '-',
      major: participant.major || '-',
      year: participant.year ? String(participant.year) : '-',
      similarity,
      highestItem,
      lowestItem,
      mostDifferentItem,
      mostDifferentItemText: mostDiffStr,
      strongPreferenceText: strongPrefStr,
      lowerPreferenceText: lowerPrefStr,
      standoutSummary,
      placements,
    }
  })

  // เรียงลำดับรายชื่อตามตัวอักษร A-Z และใช้ user_id เป็น tie-breaker ภายในโค้ดเท่านั้น เพื่อให้ได้ผลคงที่ deterministic เสมอ
  analyzedParticipants.sort((a, b) => {
    const cmp = a.username.localeCompare(b.username)
    if (cmp !== 0) return cmp
    return String(a.user_id || '').localeCompare(String(b.user_id || ''))
  })

  // 2. Summary stats (คำนวณจาก participants ทั้งหมดที่ผ่าน filter เสมอ ไม่ใช่แค่ 50 คน)
  const totalParticipants = analyzedParticipants.length

  // Most similar to community (similarity DESC, username ASC)
  const sortedBySimDesc = [...analyzedParticipants].sort(
    (a, b) =>
      b.similarity - a.similarity ||
      a.username.localeCompare(b.username) ||
      String(a.user_id || '').localeCompare(String(b.user_id || ''))
  )
  const mostSimilarUser = sortedBySimDesc[0] || null

  // Most distinctive from community (similarity ASC, username ASC)
  const sortedBySimAsc = [...analyzedParticipants].sort(
    (a, b) =>
      a.similarity - b.similarity ||
      a.username.localeCompare(b.username) ||
      String(a.user_id || '').localeCompare(String(b.user_id || ''))
  )
  const mostDistinctiveUser = sortedBySimAsc[0] || null

  // 3. Pairwise comparisons
  const pairwiseResults = []
  let closestPair = null
  let mostDifferentPair = null
  const isPairwiseLimited = totalParticipants > 50
  const pairwiseParticipants = isPairwiseLimited
    ? analyzedParticipants.slice(0, 50)
    : analyzedParticipants

  if (totalParticipants >= 2) {
    const P = pairwiseParticipants.length
    for (let i = 0; i < P; i++) {
      for (let j = i + 1; j < P; j++) {
        const uA = pairwiseParticipants[i]
        const uB = pairwiseParticipants[j]
        const res = calculateTierSimilarity(uA.placements, uB.placements, effectiveTiers)
        pairwiseResults.push({
          userA: uA.username,
          userB: uB.username,
          similarity: res.score,
        })
      }
    }

    if (pairwiseResults.length > 0) {
      // Find closest pair (highest similarity, userA ASC, userB ASC)
      const sortedPairsDesc = [...pairwiseResults].sort(
        (a, b) => b.similarity - a.similarity || a.userA.localeCompare(b.userA) || a.userB.localeCompare(b.userB)
      )
      closestPair = sortedPairsDesc[0] || null

      // Find most different pair (lowest similarity, userA ASC, userB ASC)
      const sortedPairsAsc = [...pairwiseResults].sort(
        (a, b) => a.similarity - b.similarity || a.userA.localeCompare(b.userA) || a.userB.localeCompare(b.userB)
      )
      mostDifferentPair = sortedPairsAsc[0] || null
    }
  }

  return {
    totalParticipants,
    mostSimilarUser,
    mostDistinctiveUser,
    closestPair,
    mostDifferentPair,
    participants: analyzedParticipants,
    pairwiseResults,
    isPairwiseLimited,
  }
}

/**
 * สร้าง Worksheet สำหรับการวิเคราะห์รสชาติ (Participant Analysis)
 */
export function buildAnalysisWorksheet(XLSX, analysisData, templateTitle = '-') {
  const {
    totalParticipants,
    mostSimilarUser,
    mostDistinctiveUser,
    closestPair,
    mostDifferentPair,
    participants: analyzedList,
    pairwiseResults,
    isPairwiseLimited,
  } = analysisData

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }

  const aoa = []

  // Row 0-1 Title & Template
  aoa.push(['Community Taste Analysis'])
  aoa.push(['Template', templateTitle])
  aoa.push([])

  // Section A: Summary (Rows 3-8)
  aoa.push(['--- Summary ---'])
  aoa.push(['Total Participants', totalParticipants])
  aoa.push([
    'Most Similar to Community',
    mostSimilarUser ? `${mostSimilarUser.username} (${mostSimilarUser.similarity}%)` : '-',
  ])
  aoa.push([
    'Most Distinctive from Community',
    mostDistinctiveUser ? `${mostDistinctiveUser.username} (${mostDistinctiveUser.similarity}%)` : '-',
  ])
  const closestPairLabel = isPairwiseLimited ? 'Closest Pair (among analyzed 50)' : 'Closest Pair'
  const mostDiffPairLabel = isPairwiseLimited
    ? 'Most Different Pair (among analyzed 50)'
    : 'Most Different Pair'

  aoa.push([
    closestPairLabel,
    closestPair
      ? `${closestPair.userA} ↔ ${closestPair.userB} (${closestPair.similarity}%)`
      : 'N/A (Requires at least 2 participants)',
  ])
  aoa.push([
    mostDiffPairLabel,
    mostDifferentPair
      ? `${mostDifferentPair.userA} ↔ ${mostDifferentPair.userB} (${mostDifferentPair.similarity}%)`
      : 'N/A (Requires at least 2 participants)',
  ])
  aoa.push([])

  // Section B: Participant Analysis Table
  const participantHeaderRowIdx = aoa.length + 1
  aoa.push(['--- Participant Analysis ---'])
  aoa.push([
    'User',
    'Faculty',
    'Major',
    'Academic Year',
    'Similarity to Community',
    'Most Different Item',
    'Strong Preference',
    'Lower Preference',
    'Standout Summary',
  ])

  const participantDataStartIdx = aoa.length
  analyzedList.forEach(p => {
    aoa.push([
      p.username,
      p.faculty,
      p.major,
      p.year,
      `${p.similarity}%`,
      p.mostDifferentItemText,
      p.strongPreferenceText,
      p.lowerPreferenceText,
      p.standoutSummary,
    ])
  })
  const participantDataEndIdx = aoa.length - 1

  // Section C: Pairwise Comparison Section (if 2+ participants)
  let pairwiseHeaderRowIdx = -1
  let pairwiseDataStartIdx = -1
  let pairwiseDataEndIdx = -1

  if (totalParticipants >= 2 && pairwiseResults.length > 0) {
    aoa.push([])
    const sectionTitle = isPairwiseLimited
      ? '--- Pairwise Comparison (Limited to 50 participants) ---'
      : '--- Pairwise Comparison ---'
    aoa.push([sectionTitle])
    if (isPairwiseLimited) {
      aoa.push(['Note: Pairwise comparison is limited to 50 participants to ensure smooth export performance.'])
    }
    pairwiseHeaderRowIdx = aoa.length
    aoa.push(['User A', 'User B', 'Similarity'])
    pairwiseDataStartIdx = aoa.length
    pairwiseResults.forEach(pair => {
      aoa.push([pair.userA, pair.userB, `${pair.similarity}%`])
    })
    pairwiseDataEndIdx = aoa.length - 1
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Column widths: สวยงามและกว้างพอสำหรับข้อความทุกคอลัมน์
  ws['!cols'] = [
    { wch: 22 }, // User / Section label
    { wch: 20 }, // Faculty / Value
    { wch: 24 }, // Major
    { wch: 14 }, // Academic Year
    { wch: 24 }, // Similarity to Community
    { wch: 32 }, // Most Different Item
    { wch: 28 }, // Strong Preference
    { wch: 28 }, // Lower Preference
    { wch: 55 }, // Standout Summary
  ]

  // Freeze pane: ตรึงตารางให้อยู่ต่ำกว่า header ของ Participant Analysis
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: participantHeaderRowIdx + 1 }]

  // Bold section labels
  const boldCells = [
    { r: 0, c: 0 },
    { r: 1, c: 0 },
    { r: 3, c: 0 },
    { r: 4, c: 0 },
    { r: 5, c: 0 },
    { r: 6, c: 0 },
    { r: 7, c: 0 },
    { r: 8, c: 0 },
    { r: participantHeaderRowIdx - 1, c: 0 },
  ]

  boldCells.forEach(({ r, c }) => {
    const addr = XLSX.utils.encode_cell({ r, c })
    if (!ws[addr]) ws[addr] = {}
    ws[addr].s = { ...(ws[addr].s || {}), font: { bold: true } }
  })

  // Participant Table Headers (Row: participantHeaderRowIdx, Cols: 0..8)
  for (let c = 0; c <= 8; c++) {
    const addr = XLSX.utils.encode_cell({ r: participantHeaderRowIdx, c })
    if (!ws[addr]) ws[addr] = {}
    ws[addr].s = {
      font: { bold: true },
      border: thinBorder,
    }
  }

  // Participant Table Data Cells
  for (let r = participantDataStartIdx; r <= participantDataEndIdx; r++) {
    for (let c = 0; c <= 8; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) ws[addr] = {}
      ws[addr].s = { border: thinBorder }
    }
  }

  // Pairwise Section Styling
  if (pairwiseHeaderRowIdx >= 0) {
    const titleAddr = XLSX.utils.encode_cell({ r: pairwiseHeaderRowIdx - (isPairwiseLimited ? 2 : 1), c: 0 })
    if (!ws[titleAddr]) ws[titleAddr] = {}
    ws[titleAddr].s = { font: { bold: true } }

    for (let c = 0; c <= 2; c++) {
      const addr = XLSX.utils.encode_cell({ r: pairwiseHeaderRowIdx, c })
      if (!ws[addr]) ws[addr] = {}
      ws[addr].s = { font: { bold: true }, border: thinBorder }
    }

    for (let r = pairwiseDataStartIdx; r <= pairwiseDataEndIdx; r++) {
      for (let c = 0; c <= 2; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) ws[addr] = {}
        ws[addr].s = { border: thinBorder }
      }
    }
  }

  return ws
}

/**
 * สร้าง Workbook พร้อม metadata ก่อนตาราง Tier | Items และ styling ครบถ้วน
 * พร้อมแทรก Sheet: Participant Analysis
 * รองรับทั้ง:
 * 1. participantFilter === 'all' -> วางแต่ละ block ไปทางขวา (User A block, User B block...) + Sheet Analysis
 * 2. participantFilter === '' (Avg) -> บล็อกค่าเฉลี่ยชุมชนเดี่ยว + Sheet Analysis (ถ้ามี participants)
 * 3. participantFilter === 'user_id' -> บล็อกผู้ใช้เดี่ยว + Sheet Analysis
 */
export function buildCommunityExcelWorkbook(XLSX, {
  template,
  participantOptions = [],
  participantFilter = '',
  facultyFilter = '',
  majorFilter = '',
  yearFilter = '',
  displayTiers = [],
  filteredRankings,
  participants = [],
}) {
  const isAllMode = String(participantFilter).toLowerCase() === 'all'
  const templateTitle = template?.title || template?.name || template?.id || '-'
  const facultyDisplay = facultyFilter || 'All'
  const majorDisplay = majorFilter || 'All'
  const yearDisplay = yearFilter ? String(yearFilter) : 'All'
  const fullTiersDef = (template?.tiers && template.tiers.length > 0) ? template.tiers : displayTiers

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
    const candidateList = filteredRankings ?? (participants.length > 0 ? participants : participantOptions)

    // กรองตาม faculty, major, year
    const matching = candidateList.filter(p => {
      if (facultyFilter && p.faculty !== facultyFilter) return false
      if (majorFilter && p.major !== majorFilter) return false
      if (yearFilter && String(p.year) !== String(yearFilter)) return false
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

    // ─────────────────────────────────────────────────────────────
    // แทรก Sheet 2: Participant Analysis
    // ─────────────────────────────────────────────────────────────
    if (targetParticipants.length > 0) {
      const analysisData = calculateCommunityTasteAnalysis({
        template,
        participants: targetParticipants,
        filteredRankings: matching,
        tiersDef: fullTiersDef,
      })
      const wsAnalysis = buildAnalysisWorksheet(XLSX, analysisData, templateTitle)
      XLSX.utils.book_append_sheet(wb, wsAnalysis, 'Participant Analysis')
    }

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
      Array.isArray(tier.items)
        ? tier.items.map(i => (typeof i === 'string' ? i : i.name || i.item_name || i.item_id || '')).filter(Boolean).join(', ') || '-'
        : '-',
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

  // ─────────────────────────────────────────────────────────────
  // แทรก Sheet 2: Participant Analysis ในกรณีที่มีข้อมูล participant
  // ─────────────────────────────────────────────────────────────
  const candidateRankings = filteredRankings ?? participants
  if (candidateRankings.length > 0) {
    const seenUserIds = new Set()
    const targetParticipants = []
    for (const p of candidateRankings) {
      const uid = p.user_id || p.id || p.username
      if (uid && !seenUserIds.has(uid)) {
        seenUserIds.add(uid)
        targetParticipants.push(p)
      }
    }

    if (targetParticipants.length > 0) {
      const analysisData = calculateCommunityTasteAnalysis({
        template,
        participants: targetParticipants,
        filteredRankings: candidateRankings,
        tiersDef: fullTiersDef,
      })
      const wsAnalysis = buildAnalysisWorksheet(XLSX, analysisData, templateTitle)
      XLSX.utils.book_append_sheet(wb, wsAnalysis, 'Participant Analysis')
    }
  }

  const filename = getExportFilename({
    template,
    participantName: participantDisplay,
    faculty: facultyDisplay,
    major: majorDisplay,
    year: yearDisplay,
  })

  return { wb, ws, filename }
}
