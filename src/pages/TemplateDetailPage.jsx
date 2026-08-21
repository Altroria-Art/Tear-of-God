import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronDown, ThumbsUp, ThumbsDown, MessageSquare, Share2, Download, Star, Users, Eye } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { useUser } from '../context/UserContext'
import { fetchTemplate, fetchRankings, recordTemplateView, voteRanking } from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'

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
    <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-2.5 last:border-b-0">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-white font-bold text-center leading-tight px-1 ${tier.color} ${isLong ? 'text-[10px]' : 'text-base'}`}
      >
        {tier.label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700"
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
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{timeLabel}</span>
      <span className="flex items-center gap-1 rounded bg-[#9A7B38] px-2 py-1 text-xs text-white">
        <Star size={14} />
        Community Average
      </span>
    </div>
  )
}

function UserTopBar({ username, avatarUrl, timeLabel }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Avatar size="sm" name={username} src={avatarUrl} />
      <span className="text-sm font-semibold text-gray-800">{username}</span>
      <span className="text-sm text-gray-400">·</span>
      <span className="text-sm text-gray-500">{timeLabel}</span>
    </div>
  )
}

function RankingCard({ ranking, tiersDef }) {
  const { currentUser } = useUser()
  const navigate = useNavigate()
  const [userAction, setUserAction] = useState(null)
  const [likes, setLikes] = useState(ranking.stats?.likes || 0)
  const [dislikes, setDislikes] = useState(ranking.stats?.dislikes || 0)

  const tierRows = groupItemsByTierOrder(ranking.ranking_items, tiersDef)

  const handleVote = async (type) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนโหวตครับ!')
      navigate('/login')
      return
    }

    let nextAction = userAction
    let nextLikes = likes
    let nextDislikes = dislikes

    if (type === 'like') {
      if (userAction === 'liked') { nextLikes = Math.max(0, nextLikes - 1); nextAction = null }
      else if (userAction === 'disliked') { nextDislikes = Math.max(0, nextDislikes - 1); nextLikes += 1; nextAction = 'liked' }
      else { nextLikes += 1; nextAction = 'liked' }
    } else {
      if (userAction === 'disliked') { nextDislikes = Math.max(0, nextDislikes - 1); nextAction = null }
      else if (userAction === 'liked') { nextLikes = Math.max(0, nextLikes - 1); nextDislikes += 1; nextAction = 'disliked' }
      else { nextDislikes += 1; nextAction = 'disliked' }
    }

    setUserAction(nextAction)
    setLikes(nextLikes)
    setDislikes(nextDislikes)

    const { error } = await voteRanking({
      rankingId: ranking.id,
      userId: currentUser.id,
      voteType: nextAction === 'liked' ? 'like' : nextAction === 'disliked' ? 'dislike' : null
    })
    if (error) console.error('vote failed:', error)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${ranking.id}`)
    alert('คัดลอกลิงก์เรียบร้อยแล้ว!')
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      <UserTopBar
        username={ranking.profile?.username || 'User'}
        avatarUrl={ranking.profile?.avatar_url}
        timeLabel={timeAgo(ranking.created_at)}
      />
      {tierRows.map(({ tier, items }) => (
        <TierListRow key={tier.label} tier={tier} items={items} />
      ))}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
        <div className="flex items-center gap-5">
          <span
            onClick={() => handleVote('like')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userAction === 'liked' ? 'text-blue-500' : 'hover:text-gray-700'}`}
          >
            <ThumbsUp size={16} /> {formatCount(likes)}
          </span>
          <span
            onClick={() => handleVote('dislike')}
            className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userAction === 'disliked' ? 'text-red-500' : 'hover:text-gray-700'}`}
          >
            <ThumbsDown size={16} /> {formatCount(dislikes)}
          </span>
          <Link to={`/post/${ranking.id}`} className="flex items-center gap-1.5 hover:text-gray-700 transition-colors">
            <MessageSquare size={16} /> {formatCount(ranking.stats?.comments || 0)}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-gray-400">
            <Download size={16} /> Export
          </span>
          <span onClick={handleShare} className="flex cursor-pointer items-center gap-1.5 hover:text-gray-700 transition-colors">
            <Share2 size={16} /> Share
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TemplateDetailPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useUser()

  const [template, setTemplate] = useState(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true)

  const [rankings, setRankings] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('liked')
  const [isLoadingRankings, setIsLoadingRankings] = useState(true)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  useEffect(() => {
    async function loadTemplate() {
      setIsLoadingTemplate(true)
      const { data } = await fetchTemplate(templateId)
      if (data) setTemplate(data)
      setIsLoadingTemplate(false)
    }
    if (templateId) loadTemplate()
  }, [templateId])

  // นับ view ให้ template เฉพาะตอน login แล้ว — ฝั่ง API จะกันนับซ้ำให้เองถ้าเปิดซ้ำ
  useEffect(() => {
    if (!templateId || !currentUser) return
    recordTemplateView(templateId, currentUser.id)
  }, [templateId, currentUser])

  useEffect(() => {
    async function loadRankings() {
      setIsLoadingRankings(true)
      const { data, total: t } = await fetchRankings({ templateId, sort, page, limit: PAGE_SIZE })
      setRankings(data || [])
      setTotal(t || 0)
      setIsLoadingRankings(false)
    }
    if (templateId) loadRankings()
  }, [templateId, sort, page])

  const handleUseTemplate = () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้ครับ!')
      navigate('/login')
      return
    }
    navigate(`/rank?template=${templateId}`)
  }

  if (isLoadingTemplate) {
    return (
      <main className="min-h-screen bg-[#FDF9F1] flex items-center justify-center">
        <p className="text-lg font-bold text-gray-500 animate-pulse">กำลังโหลดเทมเพลต...</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen bg-[#FDF9F1] flex flex-col items-center justify-center gap-2">
        <p className="text-lg font-bold text-gray-800">ไม่พบเทมเพลตที่คุณตามหา</p>
        <Link to="/" className="text-blue-500 hover:underline">กลับสู่หน้าหลัก</Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Most Liked'

  const hasCommunityAverage = (template.community_average?.tiers || []).some((t) => t.items.length > 0)
  const communityAvgRows = tiersDef.map((t) => {
    const found = template.community_average?.tiers.find((x) => x.label === t.label)
    return { tier: t, items: (found?.items || []).map((i) => i.name) }
  })

  return (
    <main className="min-h-screen bg-[#FDF9F1]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">{template.title}</h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar size="sm" name={template.profile?.username} src={template.profile?.avatar_url} />
              <span className="font-medium text-gray-800">@{template.profile?.username || 'User'}</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <Users size={14} /> {formatCount(template.stats?.uses)} Uses
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <Eye size={14} /> {formatCount(template.stats?.views)} Views
              </span>
            </div>

            <button
              type="button"
              onClick={handleUseTemplate}
              className="flex items-center gap-2 rounded-full bg-[#7A612A] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#634f22]"
            >
              + Use Template
            </button>
          </div>

          <p className="mt-4 max-w-3xl text-gray-600">{template.description}</p>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Community Rankings</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortMenuOpen((o) => !o)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                SORT BY: <span className="font-semibold text-gray-700">{currentSortLabel}</span>
                <ChevronDown size={14} />
              </button>
              {sortMenuOpen && (
                <div className="absolute right-0 top-8 w-40 rounded-lg border border-gray-100 bg-white py-2 shadow-xl z-50">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSort(opt.value); setPage(1); setSortMenuOpen(false) }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-[#f4efe8]"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasCommunityAverage && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
              <AverageTopBar timeLabel={`Updated ${timeAgo(template.community_average.updated_at)}`} />
              {communityAvgRows.map(({ tier, items }) => (
                <TierListRow key={tier.label} tier={tier} items={items} />
              ))}
            </div>
          )}

          {isLoadingRankings ? (
            <p className="text-gray-500 text-center py-10 animate-pulse">กำลังโหลด...</p>
          ) : rankings.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              ยังไม่มีใครสร้าง Tier List จากเทมเพลตนี้ เป็นคนแรกเลยสิ!
            </div>
          ) : (
            <>
              {rankings.map((r) => (
                <RankingCard key={r.id} ranking={r} tiersDef={tiersDef} />
              ))}

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`rounded-md px-3 py-1.5 text-sm ${p === page ? 'bg-[#7A612A] text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
