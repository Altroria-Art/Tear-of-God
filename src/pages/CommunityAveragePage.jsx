import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Star } from 'lucide-react'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import CommentSection from '../components/post/CommentSection'
import ShareExportModal from '../components/ui/ShareExportModal'
import ExportCard from '../components/ui/ExportCard'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import {
  fetchTemplate,
  fetchTemplateReaction,
  voteTemplate,
  fetchTemplateComments,
  createTemplateComment
} from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { shareUrl } from '../lib/share'

// หน้าแสดง Community Average ของเทมเพลต — เลียนแบบหน้า post ของ ranking ปกติ (PostDetail)
// มีตาราง tier list + like/dislike/comment + คอมเมนต์เต็มหน้า (ผูกกับ template_id — ดู schema.sql)
export default function CommunityAveragePage() {
  const { templateId } = useParams()
  const { currentUser } = useUser()
  const toast = useToast()
  const [modal, setModal] = useState(null) // 'share' | 'export' | null

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
    fetchTemplateComments(templateId).then((res) => {
      if (cancelled) return
      setComments((res.data || []).map((c) => ({
        id: c.id,
        author: { name: c.username || 'Unknown', avatarUrl: c.avatar_url },
        postedAt: timeAgo(c.created_at),
        body: c.content
      })))
    })
    return () => { cancelled = true }
  }, [templateId])

  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนโหวตครับ!')
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
      toast.error('บันทึกการโหวตไม่สำเร็จ: ' + (result.error || 'เกิดข้อผิดพลาด'))
    }
  }

  const handleAddComment = async (body) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนคอมเมนต์ครับ!')
      return
    }
    if (!body || !body.trim()) return

    const res = await createTemplateComment({ template_id: templateId, user_id: currentUser.id, content: body.trim() })
    if (res.data) {
      const newComment = {
        id: res.data.id,
        author: { name: res.data.username || currentUser.username || 'User', avatarUrl: res.data.avatar_url || currentUser.avatar_url },
        postedAt: 'Just now',
        body: body.trim()
      }
      setComments((c) => [newComment, ...c])
      setCommentCount((n) => n + 1)
    } else {
      toast.error('คอมเมนต์ไม่สำเร็จ: ' + (res.error || 'เกิดข้อผิดพลาด'))
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-muted animate-pulse">กำลังโหลดข้อมูล...</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-ink">ไม่พบข้อมูล Community Average</p>
        <Link to={`/template/${templateId}`} className="mt-2 inline-block text-sm text-blue-500 hover:underline">
          กลับสู่หน้าเทมเพลต
        </Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const avgTiers = (template.community_average?.tiers || []).map((t) => {
    const tierDef = tiersDef.find((x) => x.label === t.label)
    return {
      tier: t.label,
      color: tierDef?.color,
      index: tiersDef.findIndex((x) => x.label === t.label),
      items: (t.items || []).map((it) => ({ id: it.name, name: it.name, avg: it.avg, votes: it.votes ?? 0 }))
    }
  })
  const itemCount = avgTiers.reduce((n, { items }) => n + items.length, 0)
  const updatedAt = template.community_average?.updated_at

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link to={`/template/${templateId}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft glass p-2 text-ink-soft transition-colors hover:bg-surface-glass">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <article className="mt-4 rounded-2xl border border-line-soft glass p-4 shadow-sm">
            <p className="inline-flex items-center gap-1 rounded bg-brand px-2 py-1 text-[10px] font-bold tracking-wider text-canvas uppercase">
              <Star size={12} /> Community Average
            </p>

            <h1 className="mt-3 text-2xl font-bold text-ink">{template.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {itemCount} items · Updated {updatedAt ? timeAgo(updatedAt) : '—'}
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
                  label="Like"
                  pressed={reaction.userVote === 'like'}
                  activeClass="text-blue-600 font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={formatCount(reaction.dislikes)}
                  label="Dislike"
                  pressed={reaction.userVote === 'dislike'}
                  activeClass="text-red-600 font-bold"
                  onClick={() => handleVote('dislike')}
                />
                <ActionButton icon={CommentIcon} count={formatCount(commentCount)} label="Comments" />
                <ActionButton icon={Download} label="Export" onClick={() => setModal('export')} activeClass="hover:text-highlight" />
              </div>
              <div className="ml-auto">
                <ActionButton
                  icon={ShareIcon}
                  label="Share"
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
              <ExportCard
                title={`${template.title} · Community Average`}
                authorName={template.profile?.username}
                authorAvatar={template.profile?.avatar_url}
                postedAt="Community Average"
                category={template.category}
                tiers={avgTiers.map((t) => ({
                  tier: t.tier,
                  color: t.color,
                  items: (t.items || []).map((i) => (typeof i === 'object' ? i.name : i)),
                }))}
              />
            }
            filename={`template-${templateId}-community.png`}
            stats={avgTiers.flatMap((t) =>
              (t.items || []).map((it) => ({ item: it.name, avg: it.avg ?? 0, tier: t.tier, votes: it.votes ?? 0 }))
            )}
            statsFilename={`template-${templateId}-community-stats`}
          />

          <CommentSection comments={comments} onSubmit={handleAddComment} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-line-soft glass p-4 shadow-sm">
            <h2 className="text-sm font-bold text-ink">About this template</h2>
            <p className="mt-1 text-sm font-semibold text-ink">{template.title}</p>
            {template.description && <p className="mt-1 text-sm text-muted">{template.description}</p>}
            <p className="mt-2 text-xs text-muted">Uses: {formatCount(template.stats?.uses)} · Views: {formatCount(template.stats?.views)}</p>
            <Link to={`/template/${templateId}`} className="mt-3 inline-block rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95">
              ดูเทมเพลต
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
