import BackButton from '../components/ui/BackButton';
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Download, Users } from 'lucide-react'
import { buildCommunityRows, compareCommunityRanking } from '../lib/communityComparison'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import CommentSection from '../components/post/CommentSection'
import ShareExportModal from '../components/ui/ShareExportModal'
import Modal from '../components/ui/Modal'
import ExportCard from '../components/ui/ExportCard'
import CommunityAvgStatsChart from '../components/ui/CommunityAvgStatsChart'
import TierLabel from '../components/tier/TierLabel'
import HashtagList from '../components/template/HashtagList'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'
import {
  fetchTemplate,
  voteTemplate,
  fetchTemplateComments,
  createTemplateComment,
  deleteComment,
  fetchMyRanking,
  reportComment
} from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { shareUrl } from '../lib/share'
import { createPendingGuard } from '../lib/pendingGuard'
import useLiveRefresh from '../lib/useLiveRefresh'
import { useTranslation } from 'react-i18next'

// หน้าแสดง Community Average ของเทมเพลต — เลียนแบบหน้า post ของ ranking ปกติ (PostDetail)
// มีตาราง tier list + like/dislike/comment + คอมเมนต์เต็มหน้า (ผูกกับ template_id — ดู schema.sql)
export default function CommunityAveragePage() {
  const { templateId } = useParams()
  const { currentUser } = useUser()
  return <CommunityAverageContent key={`${templateId}:${currentUser?.id || 'guest'}`} />
}

function CommunityAverageContent() {
  const { templateId } = useParams()
  const location = useLocation()
  const { currentUser } = useUser()
  const currentUserId = currentUser?.id
  const toast = useToast()
  const { t } = useTranslation()
  const [modal, setModal] = useState(null) // 'share' | 'export' | null
  const [chartModal, setChartModal] = useState(false)
  const [periodDays, setPeriodDays] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [myRankingStatus, setMyRankingStatus] = useState(currentUserId ? 'loading' : 'ready')
  const [myRanking, setMyRanking] = useState(null) // ranking ล่าสุดของผู้ใช้บนเทมเพลตนี้ (สำหรับเทียบ vs ชุมชน)
  const commentInputRef = useRef(null) // ช่องพิมพ์คอมเมนต์ — ไว้โฟกัสเมื่อกดปุ่มคอมเมนต์
  const commentsRef = useRef(null)

  const [template, setTemplate] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [comments, setComments] = useState([])

  // like/dislike seeded by the combined live comments/reactions GET.
  const [reaction, setReaction] = useState({ userVote: null, likes: 0, dislikes: 0 })
  // M4-C1: หน้านี้มี 1 template — guard กันกดซ้ำระหว่าง pending, resolve/reject แล้วกดใหม่ได้
  const voteGuardRef = useRef(null)
  if (!voteGuardRef.current) voteGuardRef.current = createPendingGuard()
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setLoadError('')
      const tplRes = await fetchTemplate(templateId, { period: periodDays ? { days: periodDays } : null })
      if (cancelled) return
      if (tplRes.data) {
        setTemplate(tplRes.data)
      }
      setLoadError(tplRes.error || '')
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [templateId, currentUserId, periodDays])

  useEffect(() => {
    if (isLoading || myRankingStatus === 'loading' || !template?.id || location.hash !== '#comments') return undefined
    const frame = requestAnimationFrame(() => {
      commentsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      const target = commentInputRef.current || commentsRef.current
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [isLoading, myRankingStatus, template?.id, location.hash])

  useLiveRefresh({
    resourceKey: templateId + ':' + (currentUserId || 'guest'),
    load: (signal, { fresh }) => fetchTemplateComments(templateId, { signal, includeReactions: true, sharedSnapshot: !fresh }),
    matches: change => ['/api/template-comments', '/api/admin/comments', '/api/template-votes'].includes(change.path)
      && (!change.templateId || change.templateId === templateId),
    apply: result => {
      setComments((result.data || []).map(c => ({
        id: c.id,
        author: { id: c.user_id, name: c.username || t('common.unknownUser'), avatarUrl: c.avatar_url },
        createdAt: c.created_at, body: c.content, parentId: c.parent_id,
      })));
      setCommentCount(result.comments_count ?? result.data.length);
      if (result.reactionResult.success !== false) {
        const snapshot = result.reactionResult;
        setReaction({ userVote: snapshot.userVote ?? null, likes: snapshot.likes, dislikes: snapshot.dislikes });
      }
    },
  });

  // ดึง ranking ล่าสุดของผู้ใช้บนเทมเพลตนี้ — ใช้เทียบ "ของฉัน vs ชุมชน"
  // (mine=1: server ใช้ session user เอง ไม่เชื่อ author_id จาก client; คืนแค่
  // ranking + ranking_items ไม่รัน enrich เต็มชุดแบบ list ปกติ)
  useEffect(() => {
    if (!templateId || !currentUserId) { setMyRanking(null); setMyRankingStatus('ready'); return }
    let cancelled = false
    setMyRankingStatus('loading')
    fetchMyRanking({ templateId }).then((res) => {
      if (cancelled) return
      setMyRanking(res?.data?.[0] || null)
      setMyRankingStatus(res?.error || res?.success === false ? 'error' : 'ready')
    })
    return () => { cancelled = true }
  }, [templateId, currentUserId])

  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginVote'))
      return
    }
    // M4-C1: acquire ก่อน optimistic mutation ใดๆ — คลิกที่ถูก block ไม่มี request/toggle/rollback
    if (!voteGuardRef.current.acquire(templateId)) return
    const prev = reaction
    const nextVote = prev.userVote === type ? null : type

    let likes = prev.likes
    let dislikes = prev.dislikes
    if (prev.userVote === 'like') likes = Math.max(0, likes - 1)
    if (prev.userVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
    if (nextVote === 'like') likes += 1
    if (nextVote === 'dislike') dislikes += 1

    setReaction({ userVote: nextVote, likes, dislikes })

    try {
      const result = await voteTemplate({ templateId, userId: currentUser.id, voteType: nextVote })
      if (result.success !== false) {
        setReaction({ userVote: result.userVote ?? null, likes: result.likes ?? likes, dislikes: result.dislikes ?? dislikes })
      } else {
        setReaction(prev)
        toast.error(t('post.voteFailed', { msg: result.error || t('common.error') }))
      }
    } finally {
      voteGuardRef.current.release(templateId)
    }
  }

  // 📍 Report Comment
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // { id: string }
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const handleReportComment = (commentId) => {
    if (!currentUser) return toast.warning(t('post.warnLoginReport'));
    setReportTarget({ id: commentId });
    setReportOpen(true);
  }

  const submitReport = async () => {
    if (!reportReason.trim()) return toast.warning(t('post.warnReason'));
    setReporting(true);
    const res = await reportComment(reportTarget.id, true, reportReason.trim());
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

  const handleDeleteComment = async (id) => {
    const result = await deleteComment(id, true);
    if (!result.success) {
      toast.error(t('errors.commentDeleteFailed'));
      return false;
    }
    setComments(previous => previous.filter(comment => comment.id !== id)
      .map(comment => comment.parentId === id ? { ...comment, parentId: null } : comment));
    setCommentCount(result.comments_count);
    return true;
  };

  const handleAddComment = async (body, parentId) => {
    if (!currentUser) {
      toast.warning(t('post.warnLoginComment'))
      return false
    }
    if (!body || !body.trim()) return

    const res = await createTemplateComment({ template_id: templateId, user_id: currentUser.id, content: body.trim(), parentId })
    if (res.data) {
      const newComment = {
        id: res.data.id,
        author: { id: currentUser.id, name: res.data.username || t('common.unknownUser'), avatarUrl: res.data.avatar_url || currentUser.avatar_url },
        createdAt: res.data.created_at ?? new Date().toISOString(),
        body: body.trim(),
        parentId: parentId || null
      }
      setComments(c => c.some(comment => comment.id === newComment.id) ? c : [newComment, ...c])
      setCommentCount(n => res.comments_count ?? n + 1)
      return true
    } else {
      toast.error(t('post.commentFailed', { msg: res.error || t('common.error') }))
      return false
    }
  }

  // กดปุ่มคอมเมนต์ → เลื่อนไปที่ช่องพิมพ์ + โฟกัสให้พิมพ์ได้ทันที
  const handleCommentClick = () => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    commentInputRef.current?.focus()
  }

  if (isLoading && !template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-muted animate-pulse">{t('post.loading')}</p>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-black text-ink">{t('template.communityNotFound')}</h1>
        <Link to={`/template/${templateId}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-highlight underline underline-offset-4">
          {t('template.backToTemplate')}
        </Link>
      </main>
    )
  }

  const tiersDef = template.tiers || []
  const avgTiers = buildCommunityRows(template)
  const itemCount = avgTiers.reduce((n, row) => n + row.items.length, 0)
  const updatedAt = template.community_average?.updated_at
  const chartItems = avgTiers.flatMap(row => row.items.map(item => ({ id: item.id, name: item.name, avg: item.avg, votes: item.votes })))
  const totalPlacements = chartItems.reduce((n, item) => n + item.votes, 0)
  const myComparison = compareCommunityRanking(avgTiers, myRanking)
  const differences = myComparison.filter(item => item.gap !== 0)

  return (
    <main className="community-social mx-auto max-w-6xl px-4 sm:px-6 py-5">
      <header className="mb-5">
        <BackButton fallback={`/template/${encodeURIComponent(templateId)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" />{t('common.back')}
        </BackButton>
        <p className="text-xs font-bold text-highlight">{t('play.communityTitle')}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-ink break-words">{template.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('social.aggregateContext')}</p>
        {template.description && <details className="mt-1"><summary className="inline-flex min-h-11 items-center cursor-pointer text-sm text-muted">{t('template.about')}</summary><p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{template.description}</p></details>}
        <HashtagList hashtags={template.hashtags} className="mt-2" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{t('social.allTimeRankings', { count: Number(template.stats?.uses) || 0 })}</p>
          <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-soft">
            {t('social.period')}
            <select value={periodDays} onChange={event => setPeriodDays(Number(event.target.value))} className="min-h-11 max-w-full rounded-lg border border-line-soft bg-surface px-3 text-sm text-ink">
              <option value={0}>{t('template.periodAllTime')}</option>
              {[7,30,90].map(days => <option key={days} value={days}>{t('template.periodDays', { days })}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="min-w-0 space-y-8">
      <article className="community-result rounded-2xl border border-line-soft bg-surface p-4 sm:p-5" aria-busy={isLoading}>
        <h2 className="text-lg font-bold text-ink">{t('social.communityBoard')}</h2>
        {!isLoading && !loadError && <p className="mt-1 text-xs text-muted">{t('social.periodItems', { count: itemCount })} · {t('template.updated', { time: updatedAt ? timeAgo(updatedAt) : '—' })}</p>}
        {isLoading ? <p role="status" className="py-4 text-sm text-muted">{t('common.loading')}</p>
          : loadError ? <p role="alert" className="py-4 text-sm text-muted">{loadError}</p>
          : itemCount === 0 ? <p className="py-4 text-sm text-muted">{t('social.noPeriodData')}</p>
          : <div className="community-board mt-4 min-w-0 space-y-2">{avgTiers.map(({ tier, color, index, items }) => <TierRow key={tier} tier={tier} color={color} index={index} items={items} />)}</div>}
        <div className="community-result-reactions mt-4 border-t border-line-soft pt-3">
          <p className="mb-2 text-xs text-muted">{t('social.resultReactions')}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <ActionButton icon={ThumbsUpIcon} count={formatCount(reaction.likes)} label={t('post.like')} pressed={reaction.userVote === 'like'} activeClass="text-vote-up font-bold" onClick={() => handleVote('like')} />
              <ActionButton icon={ThumbsDownIcon} count={formatCount(reaction.dislikes)} label={t('post.dislike')} pressed={reaction.userVote === 'dislike'} activeClass="text-vote-down font-bold" onClick={() => handleVote('dislike')} />
              <ActionButton icon={CommentIcon} count={formatCount(commentCount)} label={t('post.comments')} onClick={handleCommentClick} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {currentUser?.role === 'admin' && <Link to={`/template/${encodeURIComponent(templateId)}/participants`} className="opinion-secondary gap-2"><Users size={14} />{t('template.viewParticipants')}</Link>}
              <ActionButton icon={Download} showLabel label={t('common.export')} onClick={() => setModal('export')} />
              <ActionButton icon={ShareIcon} label={t('common.share')} onClick={() => setModal('share')} />
            </div>
          </div>
        </div>
      </article>

      <section aria-labelledby="community-stats-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="community-stats-heading" className="text-xl font-bold text-ink">{t('stats.title')}</h2>
          <button type="button" onClick={() => setChartModal(true)} className="opinion-secondary gap-2"><Download size={14} />{t('common.export')}</button>
        </div>
        {isLoading ? <p role="status">{t('common.loading')}</p> : loadError ? <p role="alert">{loadError}</p> : itemCount === 0 ? <p>{t('social.noPeriodData')}</p> : <div className="max-h-[560px] overflow-y-auto rounded-2xl border border-line-soft"><CommunityAvgStatsChart title={template.title + ' · ' + t('stats.title')} subtitle={t('stats.subtitle', { totalItems: itemCount, totalVotes: totalPlacements })} items={chartItems} maxScore={tiersDef.length} topN={chartItems.length} /></div>}
      </section>
      <section aria-labelledby="your-community-heading" className="community-comparison community-data-section pt-6">
        <h2 id="your-community-heading" className="text-lg font-bold text-ink">{t('stats.vsCommunity')}</h2>
        {myRankingStatus === 'loading' || isLoading ? <p role="status" className="mt-2 text-sm text-muted">{t('common.loading')}</p>
          : loadError || myRankingStatus === 'error' ? <p role="alert" className="mt-2 text-sm text-muted">{t('social.comparisonUnavailable')}</p>
          : !myRanking ? <>
            <p className="mt-2 text-sm text-ink-soft">{t('social.compareHint')}</p>
            <Link to={`/rank?template=${encodeURIComponent(templateId)}`} className="play-button mt-3">{t('social.rankToCompare')}</Link>
          </> : <>
            <p className="mt-2 text-xs text-muted">{t('stats.matched', { match: myComparison.filter(item => item.gap === 0).length, total: myComparison.length })}</p>
            {myComparison.length ? <ul className="mt-3 divide-y divide-line-soft">
              {differences.slice(0,5).map(item => <li key={item.id} className="community-compare-row flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="min-w-0 max-w-full text-sm font-semibold text-ink [overflow-wrap:anywhere]">{item.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <TierLabel label={item.myTier} color={item.myColor} className="min-h-7 rounded px-2 text-xs font-bold" />
                  <span aria-hidden="true" className={item.gap < 0 ? 'text-vote-down' : 'text-vote-up'}>{item.gap < 0 ? '↗' : '↘'}</span><TierLabel label={item.commTier} color={item.commColor} className="min-h-7 rounded px-2 text-xs font-bold" /><span className={item.gap < 0 ? 'font-bold text-vote-down' : 'font-bold text-vote-up'}>{t(item.gap < 0 ? 'stats.higher' : 'stats.lower', { n: Math.abs(item.gap) })}</span>
                </div>
              </li>)}
            </ul> : <p className="mt-3 text-sm text-muted">{t('social.noComparableItems')}</p>}
            {differences.length > 5 && <p className="mt-2 text-xs text-muted">{t('social.topDifferences', { count: 5, total: differences.length })}</p>}
            <Link to={`/post/${encodeURIComponent(myRanking.id)}`} className="opinion-secondary mt-3">{t('social.viewYours')}</Link>
          </>}
      </section>
      <div id="comments" ref={commentsRef} tabIndex={-1} className="scroll-mt-24">
        <CommentSection comments={comments} onSubmit={handleAddComment} onReportComment={handleReportComment} onDeleteComment={handleDeleteComment} inputRef={commentInputRef} prompt={t('social.discussionPrompt')} />
      </div>

      </div>
      <aside className="community-about-strip p-4 lg:sticky lg:top-24">
        <h2 className="font-bold text-ink">{template.title}</h2>
        {template.description && <p className="mt-2 text-sm text-muted whitespace-pre-wrap">{template.description}</p>}
        <p className="mt-3 text-xs text-muted">{t('social.allTimeRankings', { count: Number(template.stats?.uses) || 0 })}</p>
        <Link to={`/template/${encodeURIComponent(templateId)}`} className="play-button mt-4">{t('template.viewTemplate')}</Link>
      </aside>
      </div>

          <ShareExportModal
            open={modal !== null}
            mode={modal}
            onClose={() => setModal(null)}
            link={shareUrl(`/template/${templateId}/community`)}
            preview={
              <ExportCard
                title={template.title}
                authorName={template.profile?.username || template.creator?.username || t('common.unknownUser')}
                authorAvatar={template.profile?.avatar_url || template.creator?.avatar_url}
                postedAt={updatedAt ? t('template.updated', { time: timeAgo(updatedAt) }) : (template.created_at ? timeAgo(template.created_at) : '')}
                hashtags={template.hashtags}
                typeBadge={t('template.communityAverage')}
                tiers={avgTiers.map((row) => ({
                  tier: row.tier,
                  color: row.color,
                  index: row.index,
                  items: (row.items || []).map((it) => ({
                    name: it.name,
                    image_url: it.image_url || null,
                  })),
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
                subtitle={t('stats.subtitle', { totalItems: itemCount, totalVotes: totalPlacements })}
                items={chartItems}
                maxScore={tiersDef.length}
                topN={10}
              />
            }
            filename={`template-${templateId}-stats.png`}
          />


      <Modal open={reportOpen} onClose={() => { if (!reporting) { setReportOpen(false); setReportTarget(null); } }} title={t('post.reportTitle')} footer={<>
        <button type="button" disabled={reporting} onClick={() => { setReportOpen(false); setReportTarget(null); }} className="dialog-secondary">{t('common.cancel')}</button>
        <button type="button" disabled={!reportReason.trim() || reporting} onClick={submitReport} className="dialog-danger">{reporting ? t('common.loading') : t('common.submit')}</button>
      </>}>
        <p className="text-sm text-ink-soft">{t('post.reportDesc')}</p>
        <label htmlFor="community-report-reason" className="club-label mt-4">{t('template.reason')}</label>
        <textarea id="community-report-reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder={t('post.reportReasonPh')} rows={3} className="club-field resize-none" />
      </Modal>
    </main>
  )
}
