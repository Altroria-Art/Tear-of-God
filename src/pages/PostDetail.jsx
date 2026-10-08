import BackButton from '../components/ui/BackButton';
import TopicRankActions from '../components/template/TopicRankActions';
import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { Download, Flag, Trash2, Swords } from 'lucide-react'
import { loginPath } from '../lib/navigation'
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
import UserFollowButton from '../components/user/UserFollowButton'
import Modal from '../components/ui/Modal'

// 📍 นำเข้า createComment มาใช้งาน
import { fetchRanking, fetchComments, createComment, deleteComment, voteRanking, fetchTemplate, reportPost, reportComment, deleteRanking, deleteAdminRanking } from '../lib/api'
import useLiveRefresh from '../lib/useLiveRefresh'
import { buildTierRows } from '../lib/tiers'
import { createPendingGuard } from '../lib/pendingGuard'
import { formatDbDate } from '../lib/format'
import { shareUrl } from '../lib/share'
import { useTranslation } from 'react-i18next'

export default function PostDetail() {
  const { postId } = useParams()
  const { currentUser } = useUser()
  return <PostDetailContent key={`${postId}:${currentUser?.id || 'guest'}`} />
}

function PostDetailContent() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useUser()
  const toast = useToast()
  const { t } = useTranslation()
  const location = useLocation()
  const [modal, setModal] = useState(() => ['share', 'export'].includes(location.state?.feedAction) ? location.state.feedAction : null) // 'share' | 'export' | null
  const tableRef = useRef(null)
  const commentInputRef = useRef(null) // ช่องพิมพ์คอมเมนต์ — ไว้โฟกัสเมื่อกดปุ่มคอมเมนต์

  const [post, setPost] = useState(null)
  const [template, setTemplate] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userVote, setUserVote] = useState(null) // 'like' | 'dislike' | null — seed จาก data.user_vote เท่านั้น
  // M4-C1: หน้านี้มี 1 ranking — guard กันกดซ้ำระหว่าง pending, resolve/reject แล้วกดใหม่ได้
  const voteGuardRef = useRef(null)
  if (!voteGuardRef.current) voteGuardRef.current = createPendingGuard()
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadPost() {
      setIsLoading(true)
      const { data, error } = await fetchRanking(postId, currentUser?.id)
      if (cancelled) return

      if (data) {
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
          isOriginal: data.is_original ?? (!data.template_id),
          templateTitle: data.template_title ?? null,
          authorId: data.profile?.id ?? data.user_id ?? null,
          profile: data.profile,
          author: {
            name: data.profile?.username || t('common.unknownUser'),
            avatarUrl: data.profile?.avatar_url
          },
          postedAt: formatDbDate(data.created_at) ?? '',
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
              id: c.user_id,
              name: c.username || t('common.unknownUser'),
              avatarUrl: c.avatar_url
            },
            createdAt: c.created_at,
            body: c.content,
            parentId: c.parent_id
          }))
          setComments(formattedComments)
        }
      } else {
        console.error("Failed to load post:", error)
      }
      setIsLoading(false)
    }

    if (postId) loadPost()
    return () => { cancelled = true }
  }, [postId, currentUser?.id, t])

  useLiveRefresh({
    resourceKey: `${postId}:${currentUser?.id || 'guest'}`,
    enabled: !!post,
    load: signal => fetchComments(postId, { signal }),
    matches: change => ['/api/comments', '/api/admin/comments', '/api/votes', '/api/rankings'].includes(change.path)
      && (!change.rankingId || change.rankingId === postId),
    apply: result => {
      setComments((result.data || []).map(c => ({
        id: c.id,
        author: { id: c.user_id, name: c.username || t('common.unknownUser'), avatarUrl: c.avatar_url },
        createdAt: c.created_at, body: c.content, parentId: c.parent_id,
      })));
      if (result.stats) {
        setUserVote(result.stats.user_vote ?? null);
        setPost(previous => previous ? { ...previous, stats: {
          ...previous.stats, likes: result.stats.likes ?? 0,
          dislikes: result.stats.dislikes ?? 0, comments: result.stats.comments ?? 0,
        } } : previous);
      }
    },
  });

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
  // M4-C1: acquire ก่อน optimistic mutation ใดๆ — คลิกที่ถูก block ไม่มี request/toggle/rollback
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('post.warnLoginVote'));
      return false;
    }
    if (!voteGuardRef.current.acquire(postId)) return

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

    try {
      const result = await voteRanking({ rankingId: postId, userId: currentUser.id, voteType: nextVote })

      if (result.success !== false) {
        setUserVote(result.userVote ?? null)
        setPost(prev => ({ ...prev, stats: { ...prev.stats, likes: result.likes ?? prev.stats.likes, dislikes: result.dislikes ?? prev.stats.dislikes } }))
      } else {
        // rollback
        setUserVote(prevVote)
        setPost(prev => ({ ...prev, stats: prevStats }))
        toast.error(t('post.voteFailed', { msg: result.error || t('common.error') }))
      }
    } finally {
      voteGuardRef.current.release(postId)
    }
  }

  // 📍 [แก้ไขแล้ว]: ใช้ createComment จาก api.js แทนการ fetch ดิบๆ
  const handleDeleteComment = async (id) => {
    const result = await deleteComment(id, false);
    if (!result.success) {
      toast.error(t('errors.commentDeleteFailed'));
      return false;
    }
    setComments(previous => previous.filter(comment => comment.id !== id)
      .map(comment => comment.parentId === id ? { ...comment, parentId: null } : comment));
    setPost(previous => previous ? { ...previous, stats: { ...previous.stats, comments: result.comments_count } } : previous);
    return true;
  };

  const handleAddComment = async (body, parentId) => {
    if (!currentUser) {
      toast.warning(t('post.warnLoginComment'));
      return false;
    }
    if (!body || !body.trim()) return;

    const { data, error, comments_count: count } = await createComment({
      ranking_id: postId,
      user_id: currentUser.id,
      content: body.trim(),
      parentId
    });

    if (data && !error) {
      const newComment = {
        id: data?.id || `comm_${Date.now()}`,
        author: {
          id: currentUser.id,
          name: currentUser.username || 'User',
          avatarUrl: currentUser.avatar_url
        },
        createdAt: data?.created_at ?? new Date().toISOString(),
        body: body.trim(),
        parentId: parentId || null
      }
      setComments(prev => prev.some(comment => comment.id === newComment.id) ? prev : [newComment, ...prev]);
      setPost(prev => ({
        ...prev,
        stats: { ...prev.stats, comments: count ?? prev.stats.comments + 1 }
      }))
      return true;
    } else {
      toast.error(t('post.commentFailed', { msg: error }));
      return false;
    }
  }

  const handleDuelPost = () => {
    if (!post?.templateId) return
    if (!currentUser) {
      toast.warning(t('duel.warnLoginDuel'))
      navigate(loginPath(`/rank?template=${encodeURIComponent(post.templateId)}&mode=duel`))
      return
    }
    const creatorId = template?.creator_id || template?.profile?.id
    if (creatorId && currentUser.id === creatorId) {
      toast.warning(t('duel.warnSelfDuel'))
      return
    }
    navigate(`/rank?template=${encodeURIComponent(post.templateId)}&mode=duel`)
  }

  const handleExport = async () => {
    setModal('export');
  }

  // กดปุ่มคอมเมนต์ → เลื่อนไปที่ช่องพิมพ์ + โฟกัสให้พิมพ์ได้ทันที
  const handleCommentClick = () => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    commentInputRef.current?.focus()
  }

  // 📍 รายงานโพสต์ (ranking) หรือคอมเมนต์
  const [reportTarget, setReportTarget] = useState(null) // null | { type: 'post' } | { type: 'comment', id: string }

  const handleReportPost = () => {
    if (!currentUser) return toast.warning(t('post.warnLoginReport'));
    setReportTarget({ type: 'post' })
    setReportOpen(true)
  }

  const handleReportComment = (commentId) => {
    if (!currentUser) return toast.warning(t('post.warnLoginReport'));
    setReportTarget({ type: 'comment', id: commentId })
    setReportOpen(true)
  }

  const submitReport = async () => {
    if (!reportReason.trim()) return toast.warning(t('post.warnReason'));
    setReporting(true);
    let res;
    if (reportTarget?.type === 'post') {
      res = await reportPost({ postId, reporterId: currentUser.id, reason: reportReason.trim() });
    } else if (reportTarget?.type === 'comment') {
      res = await reportComment(reportTarget.id, false, reportReason.trim());
    }
    setReporting(false);
    if (res?.success) {
      toast.success(t('post.reportSuccess'));
      setReportOpen(false);
      setReportReason('');
      setReportTarget(null);
    } else if (res?.status === 409) {
      toast.warning(t('post.reportDuplicate'));
    } else {
      toast.error(t('post.reportFailed', { msg: res?.error || t('common.error') }));
    }
  }

  // 📍 ลบโพสต์ — เจ้าของลบของตัวเอง (self-delete เดิม) ส่วน admin ลบโพสต์ใดก็ได้
  // ผ่าน deleteAdminRanking (backend enforce admin เอง)
  // ใช้ post?.authorId (authorId ที่ destructure ด้านล่างยังไม่เกิดตรงนี้ — กัน TDZ)
  const isOwner = currentUser?.id != null && currentUser.id === post?.authorId;
  const isAdmin = currentUser?.role === 'admin';
  const canReportPost = !isOwner && !isAdmin;
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const handleDeletePost = async () => {
    setIsDeleting(true);
    const res = isOwner
      ? await deleteRanking(postId)
      : await deleteAdminRanking({ userId: currentUser?.id, targetId: postId });
    setIsDeleting(false);
    if (res.success) {
      toast.success(t('post.deleteSuccess', 'Post deleted successfully'));
      navigate('/');
    } else {
      toast.error(t('post.deleteFailed', { msg: res.error || t('common.error') }));
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-muted animate-pulse">{t('post.loading')}</p>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-ink">{t('post.notFound')}</p>
        <Link to="/" className="mt-2 inline-block text-sm text-status-info hover:underline">
          {t('common.backHome')}
        </Link>
      </main>
    )
  }

  const { author, authorId, postedAt, hashtags, title, description, tiers, stats } = post
  const itemCount = tiers.reduce((n, { items }) => n + items.length, 0)
  // ใช้เฉพาะ template ที่ตรงกับโพสต์ปัจจุบัน — กัน metadata ของ template เก่าค้างจอตอนสลับโพสต์
  const tpl = template?.id === post.templateId ? template : null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <BackButton fallback="/" className="inline-flex h-11 w-11 items-center justify-center border border-line-soft text-ink-soft transition-colors hover:bg-surface">
            <ArrowLeftIcon className="h-5 w-5" />
          </BackButton>

          <article className="post-ranking-v2 mt-3 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              {/* 📍 คลิกชื่อ/รูปผู้สร้าง = ไปดูโปรไฟล์ของเขา */}
              <div className="post-author-cue flex min-w-0 items-center gap-3">
                {authorId ? (
                  <Link
                    to={`/profile/${encodeURIComponent(authorId)}`}
                    className="flex min-w-0 items-center gap-3 group cursor-pointer"
                  >
                    <Avatar name={author.name} src={author.avatarUrl} />
                    <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                      <p className="truncate text-sm font-bold text-ink group-hover:text-highlight group-hover:underline transition-colors">{author.name}</p>
                      <p className="text-xs text-muted">{postedAt}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={author.name} src={author.avatarUrl} />
                    <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                      <p className="truncate text-sm font-bold text-ink">{author.name}</p>
                      <p className="text-xs text-muted">{postedAt}</p>
                    </div>
                  </div>
                )}
                {authorId && (
                  <UserFollowButton
                    targetUserId={authorId}
                    initialIsFollowing={post.profile?.is_following}
                    className="shrink-0"
                  />
                )}
              </div>

              {/* 📍 แถวจัดการโพสต์ (รายงาน / ลบ) — mobile ลงบรรทัดใหม่, desktop กลับชิดขวา */}
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                {(isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isDeleting}
                    className="flex shrink-0 items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-bold text-status-error shadow-sm transition-all hover:-translate-y-0.5 hover:bg-status-error/10 active:scale-[0.97] disabled:opacity-50 min-h-11"
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                    <span>{isDeleting ? t('common.deleting') : t('common.delete')}</span>
                  </button>
                )}
                
                {canReportPost && (
                  <button
                    type="button"
                    onClick={handleReportPost}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-status-error hover:bg-status-error/10 min-h-11"
                    aria-label={t('post.report')}
                    title={t('post.report')}
                  >
                    <Flag size={14} />
                    <span>{t('post.report')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2.5 flex-wrap">
              <h1 className="post-editorial-title min-w-0 font-black text-ink break-words">{title}</h1>
              {post.isOriginal ? (
                <span
                  title={t('profile.badgeOriginal')}
                  className="px-2.5 py-0.5 rounded-full border border-line-soft bg-surface text-ink-soft text-xs font-bold shadow-2xs"
                >
                  {t('profile.badgeOriginal')}
                </span>
              ) : (
                post.templateId ? (
                  <Link
                    to={`/template/${encodeURIComponent(post.templateId)}`}
                    title={t('template.viewTemplate')}
                    className="max-w-full min-w-0 px-2.5 py-0.5 rounded-full border border-highlight/40 bg-highlight/15 text-highlight text-xs font-bold shadow-2xs hover:bg-highlight/25 transition-colors inline-flex items-center gap-1"
                  >
                    <span>{t('template.topicBadge')}</span>
                    {(post.templateTitle || tpl?.title) && (
                      <span className="min-w-0 text-[11px] font-medium opacity-85 max-w-[160px] truncate">
                        : {post.templateTitle || tpl?.title}
                      </span>
                    )}
                  </Link>
                ) : (
                  <span
                    className="px-2.5 py-0.5 rounded-full border border-highlight/40 bg-highlight/15 text-highlight text-xs font-bold shadow-2xs"
                  >
                    {t('template.topicBadge')}
                  </span>
                )
              )}
            </div>
            <p className="mt-2 text-xs text-muted">{t('template.ownerRanking', { name: author?.name || t('common.unknownUser') })}</p>
            
            {post.hashtags && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.hashtags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => {
                  const cleanTag = tag.replace('#', '');
                  return (
                    <Link 
                      key={cleanTag} 
                      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
                      className="px-3 py-1 rounded-md bg-surface border border-line-soft text-ink text-[11px] font-bold uppercase tracking-wider hover:border-line hover:shadow-sm transition-all flex items-center"
                    >
                      <span className="text-highlight mr-[2px]">#</span>
                      {cleanTag}
                    </Link>
                  );
                })}
              </div>
            )}

            <div ref={tableRef} className="post-board mt-5 min-w-0 max-w-full space-y-1.5">
              {tiers.map(({ tier, color, index, items }) => (
                <TierRow key={tier} tier={tier} color={color} index={index} items={items} />
              ))}
            </div>

            <TopicRankActions templateId={post.templateId} className="mt-4" />

            {description && <p className="post-description mt-3 text-sm text-ink-soft break-words whitespace-pre-wrap">{description}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-y-3 border-t border-line-soft pt-3">
              <div className="flex items-center gap-4 sm:gap-5">
                <ActionButton 
                  icon={ThumbsUpIcon} 
                  count={stats.likes} 
                  label={t('post.like')} 
                  pressed={userVote === 'like'}
                  activeClass="text-vote-up font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={stats.dislikes}
                  label={t('post.dislike')}
                  pressed={userVote === 'dislike'}
                  activeClass="text-vote-down font-bold"
                  onClick={() => handleVote('dislike')}
                />
                <ActionButton icon={CommentIcon} count={stats.comments} label={t('post.comments')} onClick={handleCommentClick} />
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {post.templateId && (
                  <ActionButton
                    icon={Swords}
                    showLabel
                    label={t('duel.duelButton')}
                    onClick={handleDuelPost}
                    activeClass="hover:text-highlight"
                  />
                )}
                <ActionButton icon={Download} showLabel label={t('common.export')} onClick={handleExport} activeClass="hover:text-highlight" />
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
            link={shareUrl(`/post/${postId}`)}
            preview={
              <ExportCard
                title={title}
                authorName={author?.name}
                authorAvatar={author?.avatarUrl}
                postedAt={postedAt}
                hashtags={hashtags}
                tiers={tiers.map((t) => ({
                  tier: t.tier,
                  color: t.color,
                  items: (t.items || []).map((i) => (typeof i === 'object' ? { name: i.name, image_url: i.image_url } : { name: i, image_url: null })),
                }))}
              />
            }
            filename={`post-${postId}.png`}
          />

          </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <CommentSection 
            comments={comments} 
            onSubmit={handleAddComment} 
            onReportComment={handleReportComment}
            onDeleteComment={handleDeleteComment}
            inputRef={commentInputRef} 
          />
        </div>

        {/* Conversation follows the ranking; Template stays beside it on desktop. */}
        <aside className="lg:sticky lg:top-6 lg:self-start lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <AboutTemplateCard
            templateId={post.templateId}
            name={tpl?.title ?? title}
            description={tpl?.description ?? description}
            itemCount={tpl?.template_items?.length ?? itemCount}
          />
        </aside>
      </div>

      <Modal open={deleteOpen} onClose={() => { if (!isDeleting) setDeleteOpen(false) }} title={t('common.delete')} footer={<>
        <button type="button" disabled={isDeleting} onClick={() => setDeleteOpen(false)} className="dialog-secondary">{t('common.cancel')}</button>
        <button type="button" disabled={isDeleting} onClick={handleDeletePost} className="dialog-danger">{isDeleting ? t('common.deleting') : t('common.delete')}</button>
      </>}>
        <p className="text-sm text-ink-soft">{t('post.confirmDelete')}</p>
      </Modal>
      <Modal open={reportOpen} onClose={() => { if (!reporting) { setReportOpen(false); setReportTarget(null); } }} title={t(reportTarget?.type === 'post' ? 'post.reportPost' : 'post.reportTitle')} footer={<>
        <button type="button" disabled={reporting} onClick={() => { setReportOpen(false); setReportTarget(null); }} className="dialog-secondary">{t('common.cancel')}</button>
        <button type="button" disabled={reporting || !reportReason.trim()} onClick={submitReport} className="dialog-danger"><Flag size={16} aria-hidden="true" />{reporting ? t('common.sending') : t('common.submit')}</button>
      </>}>
        <p className="text-sm text-ink-soft">{t(reportTarget?.type === 'post' ? 'post.reportPostHelp' : 'post.reportDesc')}</p>
        <label htmlFor="post-report-reason" className="club-label mt-4">{t('template.reason')}</label>
        <textarea id="post-report-reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={4} placeholder={t('post.reportReasonPh')} className="club-field resize-none" />
      </Modal>
    </main>
  )
}






