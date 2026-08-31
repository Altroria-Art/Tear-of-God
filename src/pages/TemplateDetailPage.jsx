import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Download, Star, Users, Eye } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Pagination from '../components/ui/Pagination'
import SortDropdown from '../components/ui/SortDropdown'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import ShareExportModal from '../components/ui/ShareExportModal'
import ExportCard from '../components/ui/ExportCard'
import { fetchTemplate, fetchRankings, recordTemplateView, voteRanking } from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { shareUrl } from '../lib/share'
import { TIER_STYLES } from '../lib/tiers'

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
    map[ri.tier].push(ri.item?.name || ri.item_id)
  })
  return tiersDef.map((t) => ({ tier: t, items: map[t.label] }))
}

function TierListRow({ tier, items }) {
  const isLong = tier.label.length > 2
  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm font-bold text-center leading-tight px-1 ${TIER_STYLES[tier.label]} ${isLong ? 'text-[10px]' : 'text-base'}`}
      >
        {tier.label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="bg-item-card text-item-card-text backdrop-blur-md border border-line-soft font-medium shadow-md rounded-lg px-3 py-1 text-sm"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function AverageTopBar({ timeLabel }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft/50">
      <span className="text-sm text-muted">{timeLabel}</span>
      <span className="flex items-center gap-1 rounded bg-brand px-2 py-1 text-xs text-canvas">
        <Star size={14} />
        Community Average
      </span>
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
  // seed จาก ranking.user_vote เท่านั้น — ห้าม useState(null) เฉยๆ (ดู docs/feature-like-dislike-voting.md §8)
  const [userVote, setUserVote] = useState(ranking.user_vote ?? null)
  const [likes, setLikes] = useState(ranking.stats?.likes || 0)
  const [dislikes, setDislikes] = useState(ranking.stats?.dislikes || 0)

  const tierRows = groupItemsByTierOrder(ranking.ranking_items, tiersDef)

  // state machine: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนโหวตครับ!')
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
      <div>
        {tierRows.map(({ tier, items }) => (
          <TierListRow key={tier.label} tier={tier} items={items} />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-sm text-muted">
        <div className="flex items-center gap-5">
          <span
            onClick={() => handleVote('like')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userVote === 'like' ? 'text-blue-500' : 'hover:text-ink'}`}
          >
            <ThumbsUp size={16} /> {formatCount(likes)}
          </span>
          <span
            onClick={() => handleVote('dislike')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userVote === 'dislike' ? 'text-red-500' : 'hover:text-ink'}`}
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
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink transition-all shadow-sm hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
          >
            <Share2 size={14} /> Share
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
  const avgTableRef = useRef(null)
  const [modal, setModal] = useState(null) // 'share' | 'export' | null

  const [template, setTemplate] = useState(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true)

  const [rankings, setRankings] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('liked')
  const [isLoadingRankings, setIsLoadingRankings] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadTemplate() {
      setIsLoadingTemplate(true)
      // ยิง GET (อ่าน template) กับ POST (นับ view) พร้อมกันเพื่อไม่ให้ช้าลง แต่รอครบทั้งคู่
      // ก่อนค่อย setState ครั้งเดียว — ค่า views ต้องเอาจาก POST เสมอ เพราะถ้าแยก effect กัน
      // GET จะอ่าน view_count ไปก่อนที่ UPDATE ของ POST จะ commit ได้เลขเก่ามาโชว์ (ค้างจนกว่าจะรีเฟรช)
      const [tplRes, viewRes] = await Promise.all([
        fetchTemplate(templateId),
        currentUser ? recordTemplateView(templateId, currentUser.id) : Promise.resolve(null)
      ])
      if (cancelled) return
      if (tplRes.data) {
        setTemplate(
          viewRes?.views != null
            ? { ...tplRes.data, stats: { ...tplRes.data.stats, views: viewRes.views } }
            : tplRes.data
        )
      }
      setIsLoadingTemplate(false)
    }
    if (templateId) loadTemplate()
    return () => { cancelled = true }
  }, [templateId, currentUser])

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
      alert('กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้ครับ!')
      navigate('/login')
      return
    }
    navigate(`/rank?template=${templateId}`)
  }

  const handleShare = () => setModal('share')

  const handleExportAverage = () => setModal('export')

  if (isLoadingTemplate) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-bold text-muted animate-pulse">กำลังโหลดเทมเพลต...</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-2">
        <p className="text-lg font-bold text-ink">ไม่พบเทมเพลตที่คุณตามหา</p>
        <Link to="/" className="text-brand-accent hover:underline">กลับสู่หน้าหลัก</Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const hasCommunityAverage = (template.community_average?.tiers || []).some((t) => t.items.length > 0)
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
              <span className="font-medium text-ink">@{template.profile?.username || 'User'}</span>
              <span className="text-muted">|</span>
              <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium text-ink">
                <Users size={14} /> {formatCount(template.stats?.uses)} Uses
              </span>
              <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium text-ink">
                <Eye size={14} /> {formatCount(template.stats?.views)} Views
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full glass px-4 py-2 font-bold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-surface-glass active:scale-[0.97]"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                type="button"
                onClick={handleUseTemplate}
                className="flex items-center gap-2 rounded-full glass px-6 py-2 font-bold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-surface-glass hover: active:scale-[0.97]"
              >
                + Use Template
              </button>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-muted">{template.description}</p>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-ink">Community Rankings</h2>
            <SortDropdown
              value={sort}
              options={SORT_OPTIONS}
              onChange={(nextSort) => { setSort(nextSort); setPage(1) }}
            />
          </div>

          {hasCommunityAverage && (
            <div className="mb-6 rounded-lg glass shadow-sm overflow-hidden">
              <div className="flex items-center justify-between">
                <AverageTopBar timeLabel={`Updated ${timeAgo(template.community_average.updated_at)}`} />
                <button
                  type="button"
                  onClick={handleExportAverage}
                  className="flex items-center gap-1.5 pr-4 text-xs text-muted hover:text-ink transition-colors"
                >
                  <Download size={14} /> Export
                </button>
              </div>
              <div ref={avgTableRef}>
                {communityAvgRows.map(({ tier, items }) => (
                  <TierListRow key={tier.label} tier={tier} items={items} />
                ))}
              </div>
            </div>
          )}

          {isLoadingRankings ? (
            <p className="text-gray-500 text-center py-10 animate-pulse">กำลังโหลด...</p>
          ) : rankings.length === 0 ? (
            <div className="rounded-xl glass p-8 text-center text-muted">
              ยังไม่มีใครสร้าง Tier List จากเทมเพลตนี้ เป็นคนแรกเลยสิ!
            </div>
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" style={{ background: '#ffffff' }}>
            <p className="mb-3 text-sm font-bold text-gray-900">Community Average</p>
            <div className="space-y-2">
              {communityAvgRows.map(({ tier, items }) => (
                <TierListRow key={tier.label} tier={tier} items={items} />
              ))}
            </div>
          </div>
        }
        filename={`template-${templateId}-average.png`}
      />
    </main>
  )
}












