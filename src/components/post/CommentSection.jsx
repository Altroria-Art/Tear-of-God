import { useState, useMemo } from 'react'
import { Reply, Flag, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { timeAgo } from '../../lib/format'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../context/UserContext'

function Comment({ id, author, createdAt, body, onReply, onReport, isReply = false }) {
  const { t } = useTranslation()
  const { currentUser } = useUser()
  
  return (
    <div className={`flex gap-3 py-3 ${isReply ? 'ml-8 sm:ml-12 border-l-2 border-line-soft pl-3' : ''}`}>
      <Avatar name={author?.name} src={author?.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-ink">{author?.name}</p>
            <p className="text-xs text-muted">{timeAgo(createdAt)}</p>
          </div>
          {currentUser && currentUser.id !== author?.id && onReport && (
            <button onClick={() => onReport(id)} className="text-muted hover:text-status-error transition-colors p-1 rounded-md" aria-label={t('common.report')} title={t('common.report')}>
              <Flag size={14} />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft leading-relaxed break-words">{body}</p>
        <div className="mt-1">
          <button 
            onClick={() => onReply(id, author?.name)} 
            className="text-xs font-semibold text-muted hover:text-brand flex items-center gap-1 transition-colors"
          >
            <Reply size={12} /> {t('post.reply', 'Reply')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommentSection({ comments = [], onSubmit, onReportComment, inputRef }) {
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState(null) // { id, name }
  const { t } = useTranslation()

  // Group comments
  const { parents, childrenByParentId } = useMemo(() => {
    const parents = []
    const childrenByParentId = {}
    
    comments.forEach(c => {
      if (c.parentId) {
        if (!childrenByParentId[c.parentId]) childrenByParentId[c.parentId] = []
        childrenByParentId[c.parentId].push(c)
      } else {
        parents.push(c)
      }
    })
    
    // Sort children chronologically (oldest first for replies usually makes more sense)
    // The backend returns latest first, so reverse to show oldest reply at top
    Object.values(childrenByParentId).forEach(arr => arr.reverse())
    
    return { parents, childrenByParentId }
  }, [comments])

  function handleSubmit(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    onSubmit(body, replyingTo?.id)
    setDraft('')
    setReplyingTo(null)
  }

  function handleReply(parentId, parentName) {
    setReplyingTo({ id: parentId, name: parentName })
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    inputRef.current?.focus()
  }

  function cancelReply() {
    setReplyingTo(null)
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{t('post.comments')}</h2>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        {replyingTo && (
          <div className="flex items-center justify-between bg-surface-glass px-3 py-1.5 rounded-lg border border-line-soft text-sm">
            <span className="text-muted flex items-center gap-1">
              <Reply size={14} className="inline" /> 
              {t('post.replyingTo', 'Replying to')} <strong className="text-ink">{replyingTo.name}</strong>
            </span>
            <button type="button" onClick={cancelReply} className="text-muted hover:text-ink p-0.5">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('post.commentPh')}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-line-soft bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="self-end rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
          >
            {t('post.postComment')}
          </button>
        </div>
      </form>

      <div className="mt-2 divide-y divide-line-soft">
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">{t('post.noComments')}</p>
        )}
        {parents.map((parent) => (
          <div key={parent.id} className="divide-y divide-line-soft/30">
            <Comment {...parent} onReply={handleReply} onReport={onReportComment} />
            {(childrenByParentId[parent.id] || []).map(child => (
              <Comment key={child.id} {...child} onReply={() => handleReply(parent.id, child.author?.name)} onReport={onReportComment} isReply={true} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
