import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Star, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import CommentSection from '../components/post/CommentSection'
import ShareExportModal from '../components/ui/ShareExportModal'
import CommunityAvgExportPreview from '../components/feed/CommunityAvgExportPreview'
import CommunityAvgStatsChart from '../components/ui/CommunityAvgStatsChart'
import TierLabel from '../components/tier/TierLabel'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import {
  fetchTemplate,
  fetchTemplateReaction,
  voteTemplate,
  fetchTemplateComments,
  createTemplateComment,
  fetchRankings
} from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { shareUrl } from '../lib/share'
import { useTranslation } from 'react-i18next'

// หน้าแสดง Community Average ของเทมเพลต — เลียนแบบหน้า post ของ ranking ปกติ (PostDetail)
// มีตาราง tier list + like/dislike/comment + คอมเมนต์เต็มหน้า (ผูกกับ template_id — ดู schema.sql)
export default function CommunityAveragePage() {
  const { templateId } = useParams()
  const { currentUser } = useUser()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const [modal, setModal] = useState(null) // 'share' | 'export' | null
  const [chartModal, setChartModal] = useState(false)
  const [myRanking, setMyRanking] = useState(null) // ranking ล่าสุดของผู้ใช้บนเทมเพลตนี้ (สำหรับเทียบ vs ชุมชน)
  const commentInputRef = useRef(null) // ช่องพิมพ์คอมเมนต์ — ไว้โฟกัสเมื่อกดปุ่มคอมเมนต์

  const [template, setTemplate] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [comments, setComments] = useState([])

  // like/dislike ของ Community Average — seed จาก templateReaction GET
  const [reaction, setReaction] = useState({ userVote: null, likes: 0, dislikes: 0 })
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const [tplRes, reactRes] = await Promise.all([
        fetchTemplate(templateId, { period: null }),
        currentUser ? fetchTemplateReaction({ templateId, userId: currentUser.id }) : Promise.resolve(null)
      ])
      if (cancelled) return
      if (tplRes.data) {
        setTemplate(tplRes.data)
        setCommentCount(tplRes.data.stats?.comments || 0)
      }
      if (reactRes) setReaction({ userVote: reactRes.userVote ?? null, likes: reactRes.likes ?? 0, dislikes: reactRes.dislikes ?? 0 })
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [templateId, currentUser])

  // ดึงคอมเมนต์ของ Community Average นี้
  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    const unknownUser = t('common.unknownUser')
    fetchTemplateComments(templateId).then((res) => {
      if (cancelled) return
      setComments((res.data || []).map((c) => ({
        id: c.id,
        author: { name: c.username || unknownUser, avatarUrl: c.avatar_url },
        createdAt: c.created_at,
        body: c.content
      })))
    })
    return () => { cancelled = true }
  }, [templateId, i18n.language])

  // ดึง ranking ล่าสุดของผู้ใช้บนเทมเพลตนี้ — ใช้เทียบ "ของฉัน vs ชุมชน"
  // (GET /api/rankings?template_id=..&author_id=.. รองรับอยู่แล้ว ไม่ต้องแก้ backend)
  useEffect(() => {
    if (!templateId || !currentUser) { setMyRanking(null); return }
    let cancelled = false
    fetchRankings({ templateId, authorId: currentUser.id, limit: 1 }).then((res) => {
      if (cancelled) return
      setMyRanking(res?.data?.[0] || null)
    })
    return () => { cancelled = true }
  }, [templateId, currentUser])

  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginVote'))
      return
    }
    const prev = reaction
    const nextVote = prev.userVote === type ? null : type

    let likes = prev.likes
    let dislikes = prev.dislikes
    if (prev.userVote === 'like') likes = Math.max(0, likes - 1)
    if (prev.userVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
    if (nextVote === 'like') likes += 1
    if (nextVote === 'dislike') dislikes += 1

    setReaction({ userVote: nextVote, likes, dislikes })

    const result = await voteTemplate({ templateId, userId: currentUser.id, voteType: nextVote })
    if (result.success !== false) {
      setReaction({ userVote: result.userVote ?? null, likes: result.likes ?? likes, dislikes: result.dislikes ?? dislikes })
    } else {
      setReaction(prev)
      toast.error(t('post.voteFailed', { msg: result.error || t('common.error') }))
    }
  }

  const handleAddComment = async (body) => {
    if (!currentUser) {
      toast.warning(t('post.warnLoginComment'))
      return
    }
    if (!body || !body.trim()) return

    const res = await createTemplateComment({ template_id: templateId, user_id: currentUser.id, content: body.trim() })
    if (res.data) {
      const newComment = {
        id: res.data.id,
        author: { name: res.data.username || t('common.unknownUser'), avatarUrl: res.data.avatar_url || currentUser.avatar_url },
        createdAt: res.data.created_at ?? new Date().toISOString(),
        body: body.trim()
      }
      setComments((c) => [newComment, ...c])
      setCommentCount((n) => n + 1)
    } else {
      toast.error(t('post.commentFailed', { msg: res.error || t('common.error') }))
    }
  }

  // กดปุ่มคอมเมนต์ → เลื่อนไปที่ช่องพิมพ์ + โฟกัสให้พิมพ์ได้ทันที
  const handleCommentClick = () => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    commentInputRef.current?.focus()
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-muted animate-pulse">{t('post.loading')}</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-ink">{t('template.communityNotFound')}</p>
        <Link to={`/template/${templateId}`} className="mt-2 inline-block text-sm text-blue-500 hover:underline">
          {t('template.backToTemplate')}
        </Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const avgTiers = (template.community_average?.tiers || []).map((tier) => {
    const tierDef = tiersDef.find((x) => x.label === tier.label)
    return {
      tier: tier.label,
      color: tierDef?.color,
      index: tiersDef.findIndex((x) => x.label === tier.label),
      items: (tier.items || []).map((it) => ({ id: it.name, name: it.name, avg: it.avg, votes: it.votes ?? 0 }))
    }
  })
  const itemCount = avgTiers.reduce((n, { items }) => n + items.length, 0)
  const updatedAt = template.community_average?.updated_at

  // F: ข้อมูลชาร์ตสถิติ — flat รายการทั้งหมด เรียงลำดับในชาร์ต (avg มากไปน้อย)
  const chartItems = avgTiers.flatMap((row) =>
    (row.items || []).map((it) => ({ name: it.name, avg: it.avg, votes: it.votes ?? 0 }))
  )
  const totalVotes = chartItems.reduce((n, it) => n + (it.votes || 0), 0)

  // G: เปรียบเทียบการจัดของคุณ vs ค่าเฉลี่ยชุมชน
  const tierIndexByLabel = {}
  tiersDef.forEach((t, i) => { tierIndexByLabel[String(t.label)] = i })
  const communityByName = {}
  avgTiers.forEach((row) => (row.items || []).forEach((it) => { communityByName[it.name] = it }))

  const myComparison = (myRanking?.ranking_items || [])
    .filter((ri) => ri.tier && ri.item?.name && ri.item.name in communityByName)
    .map((ri) => {
      const comm = communityByName[ri.item.name]
      const myIndex = tierIndexByLabel[String(ri.tier)]
      if (myIndex === undefined) return null
      const commIndex = Math.max(0, Math.min(tiersDef.length - 1, tiersDef.length - Math.round(comm.avg)))
      return {
        name: ri.item.name,
        myIndex,
        myTier: ri.tier,
        myColor: tiersDef[myIndex]?.color,
        commIndex,
        commTier: tiersDef[commIndex]?.label,
        commColor: tiersDef[commIndex]?.color,
        gap: myIndex - commIndex, // ลบ = คุณจัดสูงกว่าชุมชน, บวก = จัดต่ำกว่า
        votes: comm.votes ?? 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  const matchedCount = myComparison.filter((c) => c.gap === 0).length

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link to={`/template/${templateId}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft glass p-2 text-ink-soft transition-colors hover:bg-surface-glass">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <article className="mt-4 rounded-2xl border border-line-soft glass p-4 shadow-sm">
            <p className="inline-flex items-center gap-1 rounded bg-brand px-2 py-1 text-[10px] font-bold tracking-wider text-canvas uppercase">
              <Star size={12} /> {t('template.communityAverage')}
            </p>

            <h1 className="mt-3 text-2xl font-bold text-ink">{template.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {t('template.itemsText', { n: itemCount, time: updatedAt ? timeAgo(updatedAt) : '—' })}
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-line-soft p-2 glass">
              {avgTiers.map(({ tier, color, index, items }) => (
                <TierRow key={tier} tier={tier} color={color} index={index} items={items} />
              ))}
            </div>

            <div className="mt-4 flex items-center border-t border-line-soft pt-3">
              <div className="flex items-center gap-5">
                <ActionButton
                  icon={ThumbsUpIcon}
                  count={formatCount(reaction.likes)}
                  label={t('post.like')}
                  pressed={reaction.userVote === 'like'}
                  activeClass="text-vote-up font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={formatCount(reaction.dislikes)}
                  label={t('post.dislike')}
                  pressed={reaction.userVote === 'dislike'}
                  activeClass="text-vote-down font-bold"
                  onClick={() => handleVote('dislike')}
                />
<ActionButton icon={CommentIcon} count={formatCount(commentCount)} label={t('post.comments')} onClick={handleCommentClick} />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <ActionButton icon={Download} label={t('common.export')} onClick={() => setModal('export')} activeClass="hover:text-highlight" />
                <ActionButton
                  icon={ShareIcon}
                  label={t('common.share')}
                  onClick={() => setModal('share')}
                />
              </div>
            </div>
          </article>

          <ShareExportModal
            open={modal !== null}
            mode={modal}
            onClose={() => setModal(null)}
            link={shareUrl(`/template/${templateId}/community`)}
            preview={
              <CommunityAvgExportPreview
                title={`${template.title} · ${t('template.communityAverage')}`}
                updatedText={t('template.updated', { time: updatedAt ? timeAgo(updatedAt) : '—' })}
                tiers={avgTiers.map((row) => ({
                  label: row.tier,
                  color: row.color,
                  items: (row.items || []).map((it) => ({ name: it.name, avg: it.avg, votes: it.votes ?? 0 })),
                }))}
              />
            }
            filename={`template-${templateId}-community.png`}
          />

          <ShareExportModal
            open={chartModal}
            mode="export"
            onClose={() => setChartModal(false)}
            preview={
              <CommunityAvgStatsChart
                title={`${template.title} · ${t('stats.title')}`}
                subtitle={t('stats.subtitle', { totalItems: itemCount, totalVotes })}
                items={chartItems}
                maxScore={tiersDef.length}
                topN={10}
              />
            }
            filename={`template-${templateId}-stats.png`}
          />

          <section className="mt-6 rounded-2xl border border-line-soft glass p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-ink">{t('stats.title')}</h2>
              <button
                type="button"
                onClick={() => setChartModal(true)}
                className="flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-glass px-3 py-1.5 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-surface hover:shadow-md active:scale-[0.95]"
              >
                <BarChart3 size={14} /> {t('common.export')}
              </button>
            </div>
            <div className="max-h-[26rem] max-w-full overflow-auto">
              <CommunityAvgStatsChart
                title={`${template.title} · ${t('stats.title')}`}
                subtitle={t('stats.subtitle', { totalItems: itemCount, totalVotes })}
                items={chartItems}
                maxScore={tiersDef.length}
                topN={10}
              />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-line-soft glass p-4 shadow-sm">
            <h2 className="text-sm font-bold text-ink">{t('stats.vsCommunity')}</h2>
            {!currentUser ? (
              <p className="mt-2 text-sm text-muted">{t('stats.loginToCompare')}</p>
            ) : myComparison.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                {t('stats.noRankingYet')}{' '}
                <Link to={`/rank?template=${templateId}`} className="font-bold text-brand hover:underline">
                  {t('stats.rankNow')}
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted">{t('stats.matched', { match: matchedCount, total: myComparison.length })}</p>
                <div className="mt-3 space-y-2">
                  {myComparison.slice(0, 5).map((c) => (
                    <div key={c.name} className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-glass px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.name}</span>
                      <TierLabel label={c.myTier} color={c.myColor} className="h-6 rounded px-1.5 text-[11px] font-bold" fallbackClassName="rounded bg-gray-200 text-gray-700" />
                      {c.gap === 0 ? (
                        <ArrowUpRight className="h-4 w-4 rotate-45 text-emerald-500" />
                      ) : c.gap < 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-blue-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <TierLabel label={c.commTier} color={c.commColor} className="h-6 rounded px-1.5 text-[11px] font-bold" fallbackClassName="rounded bg-gray-200 text-gray-700" />
                      <span className={`w-16 shrink-0 text-right text-[11px] font-bold ${c.gap === 0 ? 'text-emerald-600' : c.gap < 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {c.gap === 0 ? t('stats.same') : c.gap < 0 ? t('stats.higher', { n: -c.gap }) : t('stats.lower', { n: c.gap })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <CommentSection comments={comments} onSubmit={handleAddComment} inputRef={commentInputRef} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-line-soft glass p-4 shadow-sm">
            <h2 className="text-sm font-bold text-ink">{t('template.about')}</h2>
            <p className="mt-1 text-sm font-semibold text-ink">{template.title}</p>
            {template.description && <p className="mt-1 text-sm text-muted">{template.description}</p>}
            <p className="mt-2 text-xs text-muted">{t('template.usesLabel', { n: formatCount(template.stats?.uses), v: formatCount(template.stats?.views) })}</p>
            <Link to={`/template/${templateId}`} className="mt-3 inline-block rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95">
              {t('template.viewTemplate')}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
