import { Link } from 'react-router-dom'
import { formatCount } from '../../lib/format'
import Avatar from '../ui/Avatar'
import {
  CommentIcon,
  ShareIcon,
  TemplateIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from '../ui/Icons'
import ActionButton from './ActionButton'
import TierRow from './TierRow'

export default function FeedCard({ post, vote, stats, onVote }) {
  const { author, postedAt, category, title, templateName, tiers } = post

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={author.name} src={author.avatarUrl} />
          <div>
            <p className="text-sm font-bold text-ink">{author.name}</p>
            <p className="text-xs text-muted">{postedAt}</p>
          </div>
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-search"
        >
          <TemplateIcon className="h-3.5 w-3.5" />
          Use Template: {templateName}
        </button>
      </div>

      <p className="mt-4 inline-block rounded-md bg-tag px-2 py-1 text-[10px] font-bold tracking-wider text-brand uppercase">
        {category}
      </p>

      <h2 className="mt-2 text-xl font-bold text-ink">
        <Link to={`/post/${post.id}`} className="transition-colors hover:text-brand">
          {title}
        </Link>
      </h2>

      <div className="mt-4 space-y-2 rounded-xl border border-line-soft p-2">
        {tiers.map(({ tier, items }) => (
          <TierRow key={tier} tier={tier} items={items} />
        ))}
      </div>

      <div className="mt-4 flex items-center border-t border-line pt-3">
        <div className="flex items-center gap-5">
          <ActionButton
            icon={ThumbsUpIcon}
            count={formatCount(stats.likes)}
            label="Like"
            pressed={vote === 'like'}
            activeClass="text-vote-up"
            onClick={() => onVote('like')}
          />
          <ActionButton
            icon={ThumbsDownIcon}
            count={formatCount(stats.dislikes)}
            label="Dislike"
            pressed={vote === 'dislike'}
            activeClass="text-vote-down"
            onClick={() => onVote('dislike')}
          />
          <ActionButton
            icon={CommentIcon}
            count={formatCount(stats.comments)}
            label="Comments"
            to={`/post/${post.id}`}
          />
        </div>
        <div className="ml-auto">
          <ActionButton icon={ShareIcon} label="Share" />
        </div>
      </div>
    </article>
  )
}
