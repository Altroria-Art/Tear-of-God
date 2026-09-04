import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Flag, X } from 'lucide-react'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import AboutTemplateCard from '../components/post/AboutTemplateCard'
import CommentSection from '../components/post/CommentSection'
import Avatar from '../components/ui/Avatar'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import ShareExportModal from '../components/ui/ShareExportModal'
import ExportCard from '../components/ui/ExportCard'

// 📍 นำเข้า createComment มาใช้งาน
import { fetchRanking, createComment, voteRanking, fetchTemplate, reportPost } from '../lib/api'
import { buildTierRows } from '../lib/tiers'
import { formatDbDate } from '../lib/format'

export default function PostDetail() {
  const { postId } = useParams()
  const { currentUser } = useUser()
  const toast = useToast()
  const [modal, setModal] = useState(null) // 'share' | 'export' | null
  const tableRef = useRef(null)

  const [post, setPost] = useState(null)
  const [template, setTemplate] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userVote, setUserVote] = useState(null) // 'like' | 'dislike' | null — seed จาก data.user_vote เท่านั้น
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    async function loadPost() {
      setIsLoading(true)
      const { data, error } = await fetchRanking(postId, currentUser?.id)

      if (data) {
        // 📍 [ใหม่]: ใช้ buildTierRows() ตัวเดียวกับ Home Feed — เรียงตาม/ให้สีตาม data.tiers
        // (template tier definition ที่ functions/api/rankings.js ส่งมาให้แล้ว) แทนการเดาลำดับ
        // จาก ranking_items เฉยๆ และไม่ยัดไอเทมที่ยังไม่ได้จัด (tier=NULL) เข้า key สตริง "null"
        // แบบโค้ดเดิม (ดู docs/tier-list-feed-debug-plan.md)
        const tiers = buildTierRows(data.ranking_items, data.tiers).map(row => ({
          tier: row.tier,
          color: row.color,
          index: row.index,
          items: row.items.map(ri => ({
            id: ri.item_id,
            name: ri.item?.name || ri.item_name || ri.item_id,
            image_url: ri.item?.image_url || ri.item_image
          }))
        }))

        setPost({
          id: data.id,
          templateId: data.template_id ?? null,
          authorId: data.profile?.id ?? null,
          author: {
            name: data.profile?.username || 'Unknown User',
            avatarUrl: data.profile?.avatar_url
          },
          postedAt: formatDbDate(data.created_at) ?? '',
          category: data.category,
          title: data.title,
          description: data.description,
          hashtags: data.hashtags || '',
          tiers: tiers.length > 0 ? tiers : [{ tier: 'S', color: undefined, index: 0, items: [] }],
          stats: {
            likes: data.stats?.likes || 0,
            dislikes: data.stats?.dislikes || 0,
            comments: data.stats?.comments || (data.comments ? data.comments.length : 0)
          }
        })
        setUserVote(data.user_vote ?? null)

        if (data.comments) {
          const formattedComments = data.comments.map(c => ({
            id: c.id,
            author: {
              name: c.username || 'Unknown',
              avatarUrl: c.avatar_url
            },
            postedAt: formatDbDate(c.created_at) ?? '',
            body: c.content
          }))
          setComments(formattedComments)
        }
      } else {
        console.error("Failed to load post:", error)
      }
      setIsLoading(false)
    }

    if (postId) loadPost()
  }, [postId, currentUser])

  // แยก effect ต่างหากจาก loadPost — loadPost มี currentUser เป็น dep แล้ว
  // ถ้ารวมกันจะยิง fetchTemplate ซ้ำทุกครั้งที่สถานะล็อกอินเปลี่ยน
  useEffect(() => {
    let cancelled = false
    const tid = post?.templateId
    if (!tid) {
      setTemplate(null)
      return
    }
    fetchTemplate(tid, { light: true }).then(({ data }) => {
      if (!cancelled && data) setTemplate(data)
    })
    return () => { cancelled = true }
  }, [post?.templateId])

  // state machine: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action —
  // กด like ซ้ำตอน like อยู่แล้ว = ยกเลิกโหวต (null) ดู docs/feature-like-dislike-voting.md §4
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนโหวตครับ!');
      return;
    }

    const nextVote = userVote === type ? null : type
    const prevVote = userVote
    const prevStats = post.stats

    // optimistic: อัปเดต UI ก่อนให้ตอบสนองทันที แล้วค่อยทับด้วยของจริงจาก response
    let optimisticLikes = prevStats.likes
    let optimisticDislikes = prevStats.dislikes
    if (prevVote === 'like') optimisticLikes = Math.max(0, optimisticLikes - 1)
    if (prevVote === 'dislike') optimisticDislikes = Math.max(0, optimisticDislikes - 1)
    if (nextVote === 'like') optimisticLikes += 1
    if (nextVote === 'dislike') optimisticDislikes += 1

    setUserVote(nextVote)
    setPost(prev => ({ ...prev, stats: { ...prev.stats, likes: optimisticLikes, dislikes: optimisticDislikes } }))

    const result = await voteRanking({ rankingId: postId, userId: currentUser.id, voteType: nextVote })

    if (result.success !== false) {
      setUserVote(result.userVote ?? null)
      setPost(prev => ({ ...prev, stats: { ...prev.stats, likes: result.likes ?? prev.stats.likes, dislikes: result.dislikes ?? prev.stats.dislikes } }))
    } else {
      // rollback
      setUserVote(prevVote)
      setPost(prev => ({ ...prev, stats: prevStats }))
      toast.error('บันทึกการโหวตไม่สำเร็จ: ' + (result.error || 'เกิดข้อผิดพลาด'))
    }
  }

  // 📍 [แก้ไขแล้ว]: ใช้ createComment จาก api.js แทนการ fetch ดิบๆ
  const handleAddComment = async (body) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนคอมเมนต์ครับ!');
      return;
    }
    if (!body || !body.trim()) return;

    const { data, error } = await createComment({
      ranking_id: postId,
      user_id: currentUser.id,
      content: body.trim()
    });

    if (!error) {
      const newComment = {
        id: data?.id || `comm_${Date.now()}`,
        author: {
          name: currentUser.username || 'User',
          avatarUrl: currentUser.avatar_url
        },
        postedAt: 'Just now',
        body: body.trim()
      }
      setComments(prev => [newComment, ...prev]);
      setPost(prev => ({
        ...prev,
        stats: { ...prev.stats, comments: prev.stats.comments + 1 }
      }))
    } else {
      toast.error('คอมเมนต์ไม่สำเร็จ: ' + error);
    }
  }

  const handleExport = async () => {
    setModal('export');
  }

  // 📍 รายงานโพสต์ (ranking) — ส่งไปหาแอดมินว่าอันนี้ไม่เหมาะสม
  const handleReportPost = async () => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนรายงานครับ!');
      return;
    }
    if (!reportReason.trim()) {
      toast.warning('กรุณาระบุเหตุผลการรายงาน');
      return;
    }
    setReporting(true);
    const res = await reportPost({ postId, reporterId: currentUser.id, reason: reportReason.trim() });
    setReporting(false);
    if (res.success) {
      toast.success('ส่งรายงานให้แอดมินแล้ว ขอบคุณครับ');
      setReportOpen(false);
      setReportReason('');
    } else if (res.status === 409) {
      toast.warning('คุณได้รายงานโพสต์นี้แล้ว รอแอดมินตรวจสอบ');
    } else {
      toast.error(res.error || 'รายงานไม่สำเร็จ');
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-muted animate-pulse">กำลังโหลดข้อมูล...</p>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-ink">ไม่พบโพสต์ที่คุณตามหา</p>
        <Link to="/" className="mt-2 inline-block text-sm text-status-info hover:underline">
          กลับสู่หน้าหลัก
        </Link>
      </main>
    )
  }

  const { author, authorId, postedAt, category, title, description, tiers, stats } = post
  const itemCount = tiers.reduce((n, { items }) => n + items.length, 0)
  // ใช้เฉพาะ template ที่ตรงกับโพสต์ปัจจุบัน — กัน metadata ของ template เก่าค้างจอตอนสลับโพสต์
  const tpl = template?.id === post.templateId ? template : null

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-line-soft glass p-2 text-ink-soft transition-colors hover:bg-surface-glass">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <article className="mt-4 rounded-2xl border border-line-soft glass p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              {/* 📍 คลิกชื่อ/รูปผู้สร้าง = ไปดูโปรไฟล์ของเขา */}
              <Link
                to={authorId ? `/profile/${authorId}` : '#'}
                className={`flex items-center gap-3 w-fit ${!authorId ? 'pointer-events-none' : ''}`}
              >
                <Avatar name={author.name} src={author.avatarUrl} />
                <div>
                  <p className="text-sm font-bold text-ink hover:text-highlight transition-colors">{author.name}</p>
                  <p className="text-xs text-muted">{postedAt}</p>
                </div>
              </Link>

              {/* 📍 บนขวา: รายงานโพสต์ */}
              <button
                type="button"
                onClick={() => { setReportReason(''); setReportOpen(true) }}
                className="flex shrink-0 items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-bold text-status-error shadow-sm transition-all hover:-translate-y-0.5 hover:bg-status-error/10 active:scale-[0.97]"
                aria-label="รายงานโพสต์"
                title="รายงานโพสต์"
              >
                <Flag size={14} />
                <span>รายงาน</span>
              </button>
            </div>

            <p className="mt-4 inline-block rounded-md bg-surface-glass border border-line-soft px-2 py-1 text-[10px] font-bold tracking-wider text-ink-soft uppercase">
              {category}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
            {description && <p className="mt-2 text-sm text-ink-soft">{description}</p>}
            
            {post.hashtags && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.hashtags.split(',').map((t) => t.trim()).filter(Boolean).map((tag, idx) => {
                  const cleanTag = tag.replace('#', '');
                  return (
                    <Link 
                      key={idx} 
                      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
                      className="px-3 py-1 rounded-md bg-surface-glass text-ink-soft text-[11px] font-bold uppercase tracking-wider hover:bg-surface transition-colors"
                    >
                      #{cleanTag}
                    </Link>
                  );
                })}
              </div>
            )}

            <div ref={tableRef} className="mt-4 space-y-2 rounded-xl border border-line-soft p-2 glass">
              {tiers.map(({ tier, color, index, items }) => (
                <TierRow key={tier} tier={tier} color={color} index={index} items={items} />
              ))}
            </div>

            <div className="mt-4 flex items-center border-t border-line-soft pt-3">
              <div className="flex items-center gap-5">
                <ActionButton 
                  icon={ThumbsUpIcon} 
                  count={stats.likes} 
                  label="Like" 
                  pressed={userVote === 'like'}
                  activeClass="text-blue-600 font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={stats.dislikes}
                  label="Dislike"
                  pressed={userVote === 'dislike'}
                  activeClass="text-red-600 font-bold"
                  onClick={() => handleVote('dislike')}
                />
                <ActionButton icon={CommentIcon} count={stats.comments} label="Comments" />
                <ActionButton icon={Download} label="Export" onClick={handleExport} activeClass="hover:text-highlight" />
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
            link={window.location.href}
            preview={
              <ExportCard
                title={title}
                authorName={author?.name}
                authorAvatar={author?.avatarUrl}
                postedAt={postedAt}
                category={category}
                tiers={tiers.map((t) => ({
                  tier: t.tier,
                  color: t.color,
                  items: (t.items || []).map((i) => (typeof i === 'object' ? i.name : i)),
                }))}
              />
            }
            filename={`post-${postId}.png`}
          />

          <CommentSection comments={comments} onSubmit={handleAddComment} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AboutTemplateCard
            templateId={post.templateId}
            name={tpl?.title ?? title}
            description={tpl?.description ?? description}
            itemCount={tpl?.template_items?.length ?? itemCount}
          />
        </aside>
      </div>

      {/* 📍 Modal รายงานโพสต์ */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => { if (!reporting) setReportOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line-soft bg-surface-glass p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">รายงานโพสต์</h3>
                <p className="mt-0.5 text-sm text-muted">แจ้งแอดมินว่าโพสต์นี้ไม่เหมาะสม — ตรวจสอบกับหน้าแอดมิน</p>
              </div>
              <button
                type="button"
                onClick={() => { if (!reporting) setReportOpen(false) }}
                className="rounded-full p-1 text-muted transition-colors hover:bg-surface-glass hover:text-ink"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              placeholder="อธิบายเหตุผลที่รายงานโพสต์นี้..."
              className="mt-4 w-full resize-none rounded-xl border border-line-soft bg-canvas p-3 text-sm text-ink focus:border-highlight focus:outline-none"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reporting}
                className="rounded-full px-4 py-2 text-sm font-bold text-muted transition-colors hover:bg-surface-glass"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleReportPost}
                disabled={reporting}
                className="flex items-center gap-2 rounded-full bg-status-error px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-red-700 disabled:opacity-60"
              >
                <Flag size={16} />
                {reporting ? 'กำลังส่ง...' : 'ส่งรายงาน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}






