import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Download, Users, Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/ui/Toast'
import TierRow from '../components/feed/TierRow'
import TierLabel from '../components/tier/TierLabel'
import ShareExportModal from '../components/ui/ShareExportModal'
import CommunityAvgExportPreview from '../components/feed/CommunityAvgExportPreview'
import { fetchTemplateParticipants, fetchTemplate } from '../lib/api'
import { FACULTIES, getMajorsForFaculty, getAdmissionYears } from '../lib/university'
import { ArrowLeftIcon, AlertTriangleIcon } from '../components/ui/Icons'

// คำนวณค่าเฉลี่ย Community Average จาก rankings ที่ filter แล้ว
// คืนค่า [{ label, color, index, items: [{ name, avg, votes }] }]
function calculateCommunityAverage(filteredRankings, tiersDef) {
  const tierCount = tiersDef.length
  const tierIndexByLabel = {}
  tiersDef.forEach((t, i) => { tierIndexByLabel[t.label] = i })

  // รวบรวมคะแนนของแต่ละ item จากทุก ranking ที่ filter ได้
  const itemData = {} // itemName → { sum, count }

  filteredRankings.forEach(ranking => {
    ranking.ranking_items.forEach(item => {
      if (!item.tier) return // ยังไม่ได้จัด — ข้าม
      const tierIdx = tierIndexByLabel[item.tier]
      if (tierIdx === undefined) return // tier ไม่ตรงกับ template — ข้าม

      const name = item.item_name || item.item_id
      if (!itemData[name]) itemData[name] = { sum: 0, count: 0 }
      // score = tierCount - tierIdx → แถวบนสุดได้คะแนนสูงสุด
      itemData[name].sum += (tierCount - tierIdx)
      itemData[name].count += 1
    })
  })

  // จัดกลุ่ม item ตาม tier เฉลี่ย
  const tierGroups = {}
  tiersDef.forEach(t => { tierGroups[t.label] = [] })

  Object.entries(itemData).forEach(([name, data]) => {
    const avg = data.sum / data.count
    // แปลง avg score กลับเป็น tier index → tier label
    const tierIdx = Math.max(0, Math.min(tierCount - 1, tierCount - Math.round(avg)))
    const tierLabel = tiersDef[tierIdx]?.label || tiersDef[0]?.label

    tierGroups[tierLabel].push({
      name,
      avg: Math.round(avg * 100) / 100,
      votes: data.count,
    })
  })

  return tiersDef.map((t, i) => ({
    label: t.label,
    color: t.color,
    index: i,
    items: (tierGroups[t.label] || []).sort((a, b) => b.avg - a.avg),
  }))
}

export default function CommunityParticipants() {
  const { templateId } = useParams()
  const { t } = useTranslation()
  const toast = useToast()

  const [template, setTemplate] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter states
  const [selectedTiers, setSelectedTiers] = useState([]) // tiers ที่ต้องการแสดง (display filter)
  const [facultyFilter, setFacultyFilter] = useState('')
  const [majorFilter, setMajorFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  // Export modal
  const [modal, setModal] = useState(null) // 'image' | null

  const admissionYears = useMemo(() => getAdmissionYears(), [])

  const availableMajors = useMemo(() => {
    return facultyFilter ? getMajorsForFaculty(facultyFilter) : []
  }, [facultyFilter])

  // โหลดข้อมูล
  useEffect(() => {
    if (!templateId) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      const [tplRes, participantsRes] = await Promise.all([
        fetchTemplate(templateId),
        fetchTemplateParticipants(templateId),
      ])

      if (cancelled) return

      if (tplRes.data) setTemplate(tplRes.data)
      if (participantsRes.data) {
        setParticipants(participantsRes.data)
      } else {
        setError(participantsRes.error || 'Failed to load participants')
      }

      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [templateId])

  const tiersDef = template?.tiers || []

  // 1. Filter rankings ตาม Faculty/Major/Year (ไม่ใช่ filter คน → filter ว่าจะเอาข้อมูลใครมาคำนวณ)
  const filteredRankings = useMemo(() => {
    return participants.filter(p => {
      if (facultyFilter && p.faculty !== facultyFilter) return false
      if (majorFilter && p.major !== majorFilter) return false
      if (yearFilter && p.year !== yearFilter) return false
      return true
    })
  }, [participants, facultyFilter, majorFilter, yearFilter])

  // 2. คำนวณค่าเฉลี่ยจาก filtered rankings
  const calculatedAverage = useMemo(() => {
    return calculateCommunityAverage(filteredRankings, tiersDef)
  }, [filteredRankings, tiersDef])

  // 3. เลือก tier ที่ต้องการแสดง (display filter)
  const displayTiers = useMemo(() => {
    if (selectedTiers.length === 0) return calculatedAverage // แสดงทุก tier
    return calculatedAverage.filter(t => selectedTiers.includes(t.label))
  }, [calculatedAverage, selectedTiers])

  const toggleTier = useCallback((tierLabel) => {
    setSelectedTiers(prev =>
      prev.includes(tierLabel) ? prev.filter(t => t !== tierLabel) : [...prev, tierLabel]
    )
  }, [])

  const clearAllFilters = useCallback(() => {
    setSelectedTiers([])
    setFacultyFilter('')
    setMajorFilter('')
    setYearFilter('')
  }, [])

  const hasActiveFilters = selectedTiers.length > 0 || facultyFilter || majorFilter || yearFilter
  const hasData = filteredRankings.length > 0

  // ── Export: Image ──
  const handleExportImage = () => setModal('image')

  // ── Export: Excel ──
  const handleExportExcel = useCallback(() => {
    import('xlsx').then(XLSX => {
      if (displayTiers.length === 0) {
        toast.warning(t('participants.noDataToExport'))
        return
      }

      // Format: Tier | Items
      const rows = displayTiers.map(tier => ({
        'Tier': tier.label,
        'Items': tier.items.map(i => i.name).join(', ') || '-',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 8 }, { wch: 80 }]

      // ใส่ thin border ทุก cell
      const thinBorder = [
        { top: { style: 'thin', color: { rgb: '000000' } } },
        { bottom: { style: 'thin', color: { rgb: '000000' } } },
        { left: { style: 'thin', color: { rgb: '000000' } } },
        { right: { style: 'thin', color: { rgb: '000000' } } },
      ]

      // ใส่ border ที่ header row (A1:B1)
      const headerRange = XLSX.utils.decode_range(ws['!ref'])
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRange.s.r, c: col })
        if (!ws[cellAddress]) ws[cellAddress] = {}
        ws[cellAddress].s = { border: thinBorder, font: { bold: true } }
      }

      // ใส่ border + สี tier ที่ data rows
      displayTiers.forEach((tier, idx) => {
        const rowIdx = idx + 1 // +1 เพราะ header อยู่ row 0

        // Tier cell (column A) — ใส่สีพื้นหลังจาก tier.color
        const tierCell = XLSX.utils.encode_cell({ r: rowIdx, c: 0 })
        if (!ws[tierCell]) ws[tierCell] = {}
        const hexColor = (tier.color || '').replace('#', '').toUpperCase()
        ws[tierCell].s = {
          border: thinBorder,
          fill: hexColor ? { fgColor: { rgb: 'FF' + hexColor } } : undefined,
          font: { bold: true },
        }

        // Items cell (column B)
        const itemsCell = XLSX.utils.encode_cell({ r: rowIdx, c: 1 })
        if (!ws[itemsCell]) ws[itemsCell] = {}
        ws[itemsCell].s = { border: thinBorder }
      })

      XLSX.utils.book_append_sheet(wb, ws, 'Community Average')
      XLSX.writeFile(wb, `template-${templateId}-community-average.xlsx`)
      toast.success(t('participants.excelDownloaded'))
    }).catch(() => {
      toast.error(t('participants.exportFailed'))
    })
  }, [displayTiers, templateId, toast, t])

  // ── Loading ──
  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-sm font-medium text-muted animate-pulse text-center">{t('common.loading')}</p>
      </main>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <AlertTriangleIcon className="mx-auto h-10 w-10 text-status-error mb-3" />
        <p className="text-lg font-bold text-ink">{t('common.error')}</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Link to={`/template/${templateId}/community`} className="mt-4 inline-block text-sm font-bold text-brand hover:underline">
          {t('template.backToTemplate')}
        </Link>
      </main>
    )
  }

  // ── No participants ──
  if (participants.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <Link to={`/template/${templateId}/community`} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft glass p-2 text-ink-soft transition-colors hover:bg-surface-glass">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <Users className="mx-auto h-12 w-12 text-muted mt-6" />
        <p className="mt-4 text-lg font-bold text-ink">{t('participants.noUsers')}</p>
        <p className="mt-1 text-sm text-muted">{t('participants.noUsersDesc')}</p>
        <Link to={`/rank?template=${templateId}`} className="mt-4 inline-block rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95">
          {t('template.use')}
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      {/* Back */}
      <Link to={`/template/${templateId}/community`} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft glass p-2 text-ink-soft transition-colors hover:bg-surface-glass">
        <ArrowLeftIcon className="h-5 w-5" />
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-ink">{template?.title}</h1>
        <p className="text-sm text-muted">{t('participants.pageTitle')}</p>
      </div>

      {/* ── Filters ── */}
      <div className="mt-5 rounded-2xl border border-line-soft glass p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">{t('participants.filters')}</span>
          {hasActiveFilters && (
            <button type="button" onClick={clearAllFilters} className="ml-auto text-xs font-bold text-brand hover:underline">
              {t('participants.clearAll')}
            </button>
          )}
        </div>

        {/* Tier checkboxes — เลือกว่าจะแสดง tier ไหน */}
        {tiersDef.length > 0 && (
          <div className="mb-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{t('participants.selectTiersToDisplay')}</label>
            <div className="flex flex-wrap gap-2">
              {tiersDef.map((tier, idx) => {
                const checked = selectedTiers.includes(tier.label)
                return (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => toggleTier(tier.label)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                      checked
                        ? 'border-brand bg-brand/10 text-ink'
                        : 'border-line-soft bg-surface-glass text-muted hover:bg-surface'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 rounded-sm border ${checked ? 'border-brand bg-brand' : 'border-line bg-surface'}`}
                    />
                    <TierLabel label={tier.label} color={tier.color} index={idx} className="px-1.5 py-0.5 text-[11px]" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Faculty / Major / Year — filter ว่าจะเอาข้อมูลใครมาคำนวณ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">{t('participants.faculty')}</label>
            <select
              value={facultyFilter}
              onChange={(e) => { setFacultyFilter(e.target.value); setMajorFilter('') }}
              className="w-full rounded-lg border border-line-soft bg-surface p-2.5 text-sm text-ink outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">{t('participants.all')}</option>
              {FACULTIES.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">{t('participants.major')}</label>
            <select
              value={majorFilter}
              onChange={(e) => setMajorFilter(e.target.value)}
              disabled={!facultyFilter}
              className="w-full rounded-lg border border-line-soft bg-surface p-2.5 text-sm text-ink outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t('participants.all')}</option>
              {availableMajors.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">{t('participants.year')}</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-lg border border-line-soft bg-surface p-2.5 text-sm text-ink outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">{t('participants.all')}</option>
              {admissionYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Participant count + Export ── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExportImage}
          className="flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3.5 py-1.5 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
        >
          <Download size={14} /> {t('participants.exportImage')}
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3.5 py-1.5 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
        >
          <Download size={14} /> {t('participants.exportExcel')}
        </button>
        <span className="ml-auto text-xs text-muted">
          {filteredRankings.length === participants.length
            ? t('participants.calculatedFromSame', { count: participants.length })
            : t('participants.calculatedFrom', { count: filteredRankings.length, total: participants.length })}
        </span>
      </div>

      {/* ── Tier List (ค่าเฉลี่ย) ── */}
      {!hasData ? (
        <div className="mt-6 rounded-2xl border border-line-soft glass p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm font-bold text-ink">{t('participants.noResults')}</p>
          {hasActiveFilters && (
            <button type="button" onClick={clearAllFilters} className="mt-2 text-xs font-bold text-brand hover:underline">
              {t('participants.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line-soft glass p-3 shadow-sm space-y-2">
          {displayTiers.map(({ label, color, index, items }) => (
            <TierRow key={label} tier={label} color={color} index={index} items={items} />
          ))}
        </div>
      )}

      {/* ── Export modal (Image) ── */}
      <ShareExportModal
        open={modal === 'image'}
        mode="export"
        onClose={() => setModal(null)}
        preview={
          <CommunityAvgExportPreview
            title={`${template?.title} · ${t('participants.pageTitle')}`}
            updatedText={
              filteredRankings.length === participants.length
                ? t('participants.calculatedFromSame', { count: participants.length })
                : t('participants.calculatedFrom', { count: filteredRankings.length, total: participants.length })
            }
            tiers={displayTiers}
          />
        }
        filename={`template-${templateId}-community-average.png`}
      />
    </main>
  )
}
