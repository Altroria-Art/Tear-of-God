import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Download, Star, Users, Eye, Flag } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Pagination from '../components/ui/Pagination'
import SortDropdown from '../components/ui/SortDropdown'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import ShareExportModal from '../components/ui/ShareExportModal'
import ExportCard from '../components/ui/ExportCard'
import EmptyState from '../components/ui/EmptyState'
import CommunityAvgExportPreview from '../components/feed/CommunityAvgExportPreview'
import { fetchTemplate, fetchRankings, recordTemplateView, fetchTemplateReaction, voteTemplate, voteRanking, reportTemplate } from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { shareUrl } from '../lib/share'
import TierLabel from '../components/tier/TierLabel'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE = 5
const SORT_OPTIONS = [
  { value: 'liked', label: 'Most Liked' },
  { value: 'recent', label: 'Recent' },
]

// tier ที่เป็น NULL (ยังไม่ถูกจัด) ไม่นับเป็นแถวไอเทม — แต่ทุกแถว tier ของ template ยังคงแสดงเสมอ
function groupItemsByTierOrder(rankingItems, tiersDef) {
  const map = {}
  tiersDef.forEach((t) => { map[t.label] = [] })
  ;(rankingItems || []).forEach((ri) => {
    if (!ri.tier || !(ri.tier in map)) return
    map[ri.tier].push(ri.item || { id: ri.item_id, name: ri.item_id, image_url: null })
  })
  return tiersDef.map((t) => ({ tier: t, items: map[t.label] }))
}

function TierListRow({ tier, items }) {
  const isLong = tier.label.length > 2
  return (
    <div className="flex items-stretch gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <TierLabel
        label={tier.label}
        color={tier.color}
        className={`w-12 min-h-12 rounded-sm font-bold px-1 ${isLong ? 'text-[10px]' : 'text-base'}`}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {items.map((item, idx) => {
          const name = typeof item === 'object' ? (item.name || '') : item;
          const imageUrl = typeof item === 'object' ? (item.image_url || null) : null;
          return imageUrl ? (
            <span key={idx} className="relative shrink-0 w-14 h-10 rounded-md overflow-hidden border border-line-soft shadow-md">
              <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            </span>
          ) : (
            <span
              key={idx}
              className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg px-3 py-1 text-sm break-words"
            >
              {name}
            </span>
          );
        })}
      </div>
    </div>
  )
}

function UserTopBar({ username, avatarUrl, timeLabel }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-line-soft/50">
      <Avatar size="sm" name={username} src={avatarUrl} />
      <span className="text-sm font-semibold text-ink">{username}</span>
      <span className="text-sm text-muted">·</span>
      <span className="text-sm text-muted">{timeLabel}</span>
    </div>
  )
}

function RankingCard({ ranking, tiersDef }) {
  const { currentUser } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useTranslation()
  // seed จาก ranking.user_vote เท่านั้น — ห้าม useState(null) เฉยๆ (ดู docs/feature-like-dislike-voting.md §8)
  const [userVote, setUserVote] = useState(ranking.user_vote ?? null)
  const [likes, setLikes] = useState(ranking.stats?.likes || 0)
  const [dislikes, setDislikes] = useState(ranking.stats?.dislikes || 0)

  const tierRows = groupItemsByTierOrder(ranking.ranking_items, tiersDef)

  // state machine: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginVote'))
      navigate('/login')
      return
    }

    const nextVote = userVote === type ? null : type
    const prevVote = userVote
    const prevLikes = likes
    const prevDislikes = dislikes

    let optimisticLikes = prevLikes
    let optimisticDislikes = prevDislikes
    if (prevVote === 'like') optimisticLikes = Math.max(0, optimisticLikes - 1)
    if (prevVote === 'dislike') optimisticDislikes = Math.max(0, optimisticDislikes - 1)
    if (nextVote === 'like') optimisticLikes += 1
    if (nextVote === 'dislike') optimisticDislikes += 1

    setUserVote(nextVote)
    setLikes(optimisticLikes)
    setDislikes(optimisticDislikes)

    const result = await voteRanking({ rankingId: ranking.id, userId: currentUser.id, voteType: nextVote })

    if (result.success !== false) {
      setUserVote(result.userVote ?? null)
      setLikes(result.likes ?? optimisticLikes)
      setDislikes(result.dislikes ?? optimisticDislikes)
    } else {
      setUserVote(prevVote)
      setLikes(prevLikes)
      setDislikes(prevDislikes)
      console.error('vote failed:', result.error)
    }
  }

  const [modal, setModal] = useState(null) // 'share' | 'export' | null

  const handleShare = () => setModal('share')

  const handleExport = () => setModal('export')

  return (
    <div className="mb-6">
      <div className="rounded-lg glass shadow-sm overflow-hidden">
      <UserTopBar
        username={ranking.profile?.username || 'User'}
        avatarUrl={ranking.profile?.avatar_url}
        timeLabel={timeAgo(ranking.created_at)}
      />
      <div
        onClick={() => navigate(`/post/${ranking.id}`)}
        className="cursor-pointer transition-colors hover:bg-surface-glass/50"
        role="button"
        aria-label={t('template.openRankingPost')}
      >
        {tierRows.map(({ tier, items }) => (
          <TierListRow key={tier.id ?? tier.label} tier={tier} items={items} />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-sm text-muted">
        <div className="flex items-center gap-5">
          <span
            onClick={() => handleVote('like')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userVote === 'like' ? 'text-vote-up' : 'hover:text-ink'}`}
          >
            <ThumbsUp size={16} /> {formatCount(likes)}
          </span>
          <span
            onClick={() => handleVote('dislike')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userVote === 'dislike' ? 'text-vote-down' : 'hover:text-ink'}`}
          >
            <ThumbsDown size={16} /> {formatCount(dislikes)}
          </span>
          <Link to={`/post/${ranking.id}`} className="flex items-center gap-1.5 hover:text-ink transition-colors">
            <MessageSquare size={16} /> {formatCount(ranking.stats?.comments || 0)}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-muted transition-all shadow-sm hover:-translate-y-0.5 hover:bg-surface hover:text-ink hover:shadow-md active:scale-[0.95]"
          >
            <Download size={14} /> {t('common.export')}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink transition-all shadow-sm hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
          >
            <Share2 size={14} /> {t('common.share')}
          </button>
        </div>
      </div>
      </div>

      <ShareExportModal
        open={modal !== null}
        mode={modal}
        onClose={() => setModal(null)}
        link={`${window.location.origin}/post/${ranking.id}`}
        preview={
          <ExportCard
            title={ranking.title}
            authorName={ranking.profile?.username}
            authorAvatar={ranking.profile?.avatar_url}
            postedAt={timeAgo(ranking.created_at)}
            category={ranking.category}
            tiers={tierRows.map(({ tier, items }) => ({
              tier: tier.label,
              color: tier.color,
              items: (items || []).map((i) => (typeof i === 'object' ? i.name : i)),
            }))}
          />
        }
        filename={`ranking-${ranking.id}.png`}
      />
    </div>
  )
}

export default function TemplateDetailPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useUser()
  const toast = useToast()
  const { t } = useTranslation()
  const avgTableRef = useRef(null)
  const [modal, setModal] = useState(null) // 'share' | 'export' | null
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  const [template, setTemplate] = useState(null)
  const [communityAllTime, setCommunityAllTime] = useState(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true)
  const [periodDays, setPeriodDays] = useState(0) // 0 = ทั้งหมด, 7/30/90 = ช่วงกี่วันล่าสุด

  const [rankings, setRankings] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('liked')
  const [isLoadingRankings, setIsLoadingRankings] = useState(true)

  // like/dislike/comment ของ Community Average (ผูกกับ template_id — ดู schema.sql)
  // seed from template.stats เริ่มต้น ส่วน GET จะ override เลขจริง + user_vote
  const [templateReaction, setTemplateReaction] = useState({ userVote: null, likes: 0, dislikes: 0 })
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!template) return
    setCommentCount(template.stats?.comments || 0)
    setTemplateReaction((r) => ({ ...r, likes: template.stats?.likes || 0, dislikes: template.stats?.dislikes || 0 }))
  }, [template])

  // ดึงสถานะโหวตของผู้ใช้ + จำนวนล่าสุดของ Community Average นี้
  useEffect(() => {
    if (!templateId || !template) return
    let cancelled = false
    fetchTemplateReaction({ templateId, userId: currentUser?.id }).then((r) => {
      if (cancelled) return
      setTemplateReaction((prev) => ({
        userVote: r.userVote ?? null,
        likes: r.likes ?? prev.likes,
        dislikes: r.dislikes ?? prev.dislikes
      }))
    })
    return () => { cancelled = true }
  }, [templateId, template, currentUser])

  useEffect(() => {
    let cancelled = false
    async function loadTemplate() {
      setIsLoadingTemplate(true)
      const wantsPeriod = periodDays > 0
      const [tplRes, allTimeRes] = await Promise.all([
        fetchTemplate(templateId, { period: wantsPeriod ? { days: periodDays } : null }),
        wantsPeriod ? fetchTemplate(templateId, { period: null }) : Promise.resolve(null),
      ])
      if (cancelled) return
      if (tplRes.data) {
        setTemplate(tplRes.data)
        setCommunityAllTime(
          wantsPeriod
            ? (allTimeRes?.data?.community_average ?? null)
            : (tplRes.data.community_average ?? null)
        )
      }
      setIsLoadingTemplate(false)
    }
    if (templateId) loadTemplate()
    return () => { cancelled = true }
  }, [templateId, currentUser?.id, periodDays])

  // 📍 Record view แยก effect — ยิงเฉพาะครั้งแรกที่เข้ามาดู template (หรือ login/logout)
  // ไม่ต้อง re-fire เมื่อผู้ใช้เปลี่ยน periodDays
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!templateId || !currentUser) return
    recordTemplateView(templateId, currentUser.id)
  }, [templateId, currentUser?.id])

  useEffect(() => {
    async function loadRankings() {
      setIsLoadingRankings(true)
      // ส่ง userId ไปด้วยเพื่อให้ API คืน user_vote กลับมา — sort ที่ระบุไว้ (liked/recent) ยัง
      // ชนะ personalized order เสมอ ไม่ถูก userId แย่งไป (แก้ไว้ที่ functions/api/rankings.js แล้ว)
      const { data, total: t } = await fetchRankings({ templateId, sort, page, limit: PAGE_SIZE, userId: currentUser?.id })
      setRankings(data || [])
      setTotal(t || 0)
      setIsLoadingRankings(false)
    }
    if (templateId) loadRankings()
  }, [templateId, sort, page, currentUser])

  const handleUseTemplate = () => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginUse'))
      navigate('/login')
      return
    }
    navigate(`/rank?template=${templateId}`)
  }

  const handleShare = () => setModal('share')

  const handleExportAverage = () => setModal('export')

  // 📍 รายงานเทมเพลต — เปิด modal ให้เลือกเหตุผล แล้วยิง POST ไปหา admin
  const handleReport = async () => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginReport'))
      navigate('/login')
      return
    }
    if (!reportReason.trim()) {
      toast.warning(t('template.warnReason'))
      return
    }
    setReporting(true)
    const res = await reportTemplate({ templateId, reporterId: currentUser.id, reason: reportReason.trim() })
    setReporting(false)
    if (res.success) {
      toast.success(t('template.reportSuccess'))
      setReportOpen(false)
      setReportReason('')
    } else if (res.status === 409) {
      toast.warning(t('template.reportDuplicate'))
    } else {
      toast.error(t('template.reportFailed', { msg: res.error || t('common.error') }))
    }
  }

  // state machine: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action (เหมือน RankingCard)
  const handleTemplateVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginVote'))
      navigate('/login')
      return
    }

    const prev = templateReaction
    const nextVote = prev.userVote === type ? null : type

    // optimistic UI (กดทันทีแล้วค่อย overwrite ด้วยเลขจริงจาก server)
    let likes = prev.likes
    let dislikes = prev.dislikes
    if (prev.userVote === 'like') likes = Math.max(0, likes - 1)
    if (prev.userVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
    if (nextVote === 'like') likes += 1
    if (nextVote === 'dislike') dislikes += 1

    setTemplateReaction({ userVote: nextVote, likes, dislikes })

    const result = await voteTemplate({ templateId, userId: currentUser.id, voteType: nextVote })

    if (result.success !== false) {
      setTemplateReaction({
        userVote: result.userVote ?? null,
        likes: result.likes ?? likes,
        dislikes: result.dislikes ?? dislikes
      })
    } else {
      setTemplateReaction(prev)
      console.error('template vote failed:', result.error)
    }
  }

  if (isLoadingTemplate) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-bold text-muted animate-pulse">{t('template.loading')}</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-2">
        <p className="text-lg font-bold text-ink">{t('template.notFound')}</p>
        <Link to="/" className="text-brand-accent hover:underline">{t('common.backHome')}</Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ตรวจจากข้อมูล all-time (ทุกช่วง) ว่าเทมเพลตนี้มี Community Average หรือไม่
  // ไม่ใช่ข้อมูลช่วงที่เลือก — เพราะถ้าเลือกช่วงที่ยังไม่มี ranking การ์ดจะได้ไม่หายไป
  const hasCommunityAverage = (communityAllTime?.tiers || []).some((t) => t.items.length > 0)
  const communityAvgRows = tiersDef.map((t) => {
    const found = template.community_average?.tiers.find((x) => x.label === t.label)
    return { tier: t, items: (found?.items || []).map((i) => i.name) }
  })

  return (
    <main className="min-h-screen text-ink">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8 rounded-xl glass p-6 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">{template.title}</h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar size="sm" name={template.profile?.username} src={template.profile?.avatar_url} />
              <span className="font-medium text-ink">@{template.profile?.username || t('common.unknownUser')}</span>
              <span className="text-muted">|</span>
              <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium text-ink">
                <Users size={14} /> {formatCount(template.stats?.uses)} {t('template.uses')}
              </span>
              <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium text-ink">
                <Eye size={14} /> {formatCount(template.stats?.views)} {t('template.views')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-2 rounded-full glass px-4 py-2 font-bold text-status-error shadow-md transition-all hover:-translate-y-0.5 hover:bg-status-error/10 active:scale-[0.97]"
                aria-label={t('template.report')}
                title={t('template.report')}
              >
                <Flag size={16} />
                <span>{t('template.report')}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full glass px-4 py-2 font-bold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-surface-glass active:scale-[0.97]"
              >
                <Share2 size={16} /> {t('common.share')}
              </button>
              <button
                type="button"
                onClick={handleUseTemplate}
                className="flex items-center gap-2 rounded-full glass px-6 py-2 font-bold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-surface-glass hover: active:scale-[0.97]"
              >
                {t('template.use')}
              </button>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-muted">{template.description}</p>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-ink">{t('template.communityRankings')}</h2>
            <SortDropdown
              value={sort}
              options={SORT_OPTIONS}
              onChange={(nextSort) => { setSort(nextSort); setPage(1) }}
            />
          </div>

          {hasCommunityAverage && (
            <div className="mb-6 rounded-lg glass shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line-soft/50">
                <span className="flex items-center gap-1 rounded bg-brand px-2 py-1 text-xs text-canvas">
                  <Star size={14} />
                  {t('template.communityAverage')}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {periodDays
                      ? t('template.lastPeriodDays', { days: periodDays }) + ' · '
                      : ''}
                    {t('template.updated', { time: timeAgo(template.community_average.updated_at) })}
                  </span>
                  <select
                    value={periodDays}
                    onChange={(e) => setPeriodDays(Number(e.target.value))}
                    className="rounded-lg border border-line-soft bg-surface-glass px-2 py-1.5 text-xs font-bold text-ink-soft outline-none transition-colors hover:bg-surface focus:ring-1 focus:ring-brand"
                  >
                    <option value={0}>{t('template.periodAllTime')}</option>
                    <option value={7}>{t('template.periodDays', { days: 7 })}</option>
                    <option value={30}>{t('template.periodDays', { days: 30 })}</option>
                    <option value={90}>{t('template.periodDays', { days: 90 })}</option>
                  </select>
                </div>
              </div>
              <div
                ref={avgTableRef}
                onClick={() => navigate(`/template/${templateId}/community`)}
                className="cursor-pointer transition-colors hover:bg-surface-glass/50"
                role="button"
                aria-label={t('template.openCommunityAverage')}
              >
                {communityAvgRows.map(({ tier, items }) => (
                  <TierListRow key={tier.id ?? tier.label} tier={tier} items={items} />
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-sm text-muted">
                <div className="flex items-center gap-5">
                  <span
                    onClick={() => handleTemplateVote('like')}
                    className={`flex cursor-pointer items-center gap-1.5 transition-colors ${templateReaction.userVote === 'like' ? 'text-vote-up' : 'hover:text-ink'}`}
                  >
                    <ThumbsUp size={16} /> {formatCount(templateReaction.likes)}
                  </span>
                  <span
                    onClick={() => handleTemplateVote('dislike')}
                    className={`flex cursor-pointer items-center gap-1.5 transition-colors ${templateReaction.userVote === 'dislike' ? 'text-vote-down' : 'hover:text-ink'}`}
                  >
                    <ThumbsDown size={16} /> {formatCount(templateReaction.dislikes)}
                  </span>
                  <span
                    onClick={() => navigate(`/template/${templateId}/community`)}
                    className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-ink"
                  >
                    <MessageSquare size={16} /> {formatCount(commentCount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportAverage}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-muted transition-all shadow-sm hover:-translate-y-0.5 hover:bg-surface hover:text-ink hover:shadow-md active:scale-[0.95]"
                  >
                    <Download size={14} /> {t('common.export')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink transition-all shadow-sm hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
                  >
                    <Share2 size={14} /> {t('common.share')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoadingRankings ? (
            <p className="text-muted text-center py-10 animate-pulse">{t('template.loadingRankings')}</p>
          ) : rankings.length === 0 ? (
            <EmptyState title={t('template.noRankingsYet')} />
          ) : (
            <>
              {rankings.map((r) => (
                <RankingCard key={r.id} ranking={r} tiersDef={tiersDef} />
              ))}

              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </section>
      </div>

      <ShareExportModal
        open={modal !== null}
        mode={modal}
        onClose={() => setModal(null)}
        link={shareUrl(`/template/${templateId}`)}
        preview={
          <CommunityAvgExportPreview
            title={t('template.communityAverage')}
            updatedText={t('template.updated', { time: timeAgo(template.community_average?.updated_at ?? '') })}
            tiers={(template.community_average?.tiers || []).map((avgTier) => {
              const tierDef = tiersDef.find((x) => x.label === avgTier.label)
              return {
                label: avgTier.label,
                color: tierDef?.color,
                items: (avgTier.items || []).map((it) => ({ name: it.name, avg: it.avg, votes: it.votes ?? 0 })),
              }
            })}
          />
        }
        filename={`template-${templateId}-average${periodDays ? `-${periodDays}d` : ''}.png`}
      />

      {/* 📍 Modal รายงานเทมเพลต */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => { if (!reporting) setReportOpen(false) }}>
          <div
            className="glass w-full max-w-md rounded-2xl p-6 shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-1">{t('template.reportTemplate')}</h3>
            <p className="text-sm text-muted mb-4">{t('template.reportTemplateHelp')}</p>

            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
              {t('template.reason')}
            </label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('template.reportReasonPh')}
              rows={3}
              className="w-full bg-surface border border-line-soft text-ink rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted resize-none"
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reporting}
                className="text-ink-soft hover:bg-surface-glass rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleReport}
                disabled={reporting || !reportReason.trim()}
                className="bg-brand hover:bg-brand-accent text-canvas rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50"
              >
                {reporting ? t('common.sending') : t('common.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}












