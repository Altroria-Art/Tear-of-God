import { useState } from 'react'
import Avatar from '../ui/Avatar'
import { timeAgo } from '../../lib/format'
import { useTranslation } from 'react-i18next'

function Comment({ author, createdAt, body }) {
  return (
    <div className="flex gap-3 py-3">
      <Avatar name={author.name} src={author.avatarUrl} size="sm" />
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-bold text-ink">{author.name}</p>
          <p className="text-xs text-muted">{timeAgo(createdAt)}</p>
        </div>
        <p className="mt-0.5 text-sm text-item">{body}</p>
      </div>
    </div>
  )
}

export default function CommentSection({ comments, onSubmit, inputRef }) {
  const [draft, setDraft] = useState('')
  const { t } = useTranslation()

  function handleSubmit(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    onSubmit(body)
    setDraft('')
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{t('post.comments')}</h2>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-3">
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
          className="self-end rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('post.postComment')}
        </button>
      </form>

      <div className="mt-2 divide-y divide-line-soft">
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">{t('post.noComments')}</p>
        )}
        {comments.map((comment) => (
          <Comment key={comment.id} {...comment} />
        ))}
      </div>
    </section>
  )
}




