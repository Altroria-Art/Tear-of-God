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
    <article className="rounded-3xl glass p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={author.name} src={author.avatarUrl} />
          <div>
            <p className="text-sm font-bold text-brand tracking-wide">{author.name}</p>
            <p className="text-xs text-muted font-medium">{postedAt}</p>
          </div>
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-glass border border-line-soft/50 px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-sm transition-all hover:text-highlight hover:border-line hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <TemplateIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Use Template:</span> {templateName}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-zinc-800/80 border border-zinc-700/50 px-2 py-1 text-[10px] font-bold tracking-wider text-brand-accent uppercase shadow-sm">
          {category}
        </span>
      </div>

      <h2 className="mt-3 text-xl md:text-2xl font-bold text-brand leading-tight">
        <Link to={`/post/${post.id}`} className="transition-colors hover:text-tier-a">
          {title}
        </Link>
      </h2>

      <div className="mt-5 space-y-2 rounded-2xl border border-line-soft/30 p-2 bg-black/10">
        {tiers.map(({ tier, items }) => (
          <TierRow key={tier} tier={tier} items={items} />
        ))}
      </div>

      <div className="mt-5 flex items-center border-t border-line-soft/50 pt-4">
        <div className="flex items-center gap-6">
          <ActionButton
            icon={ThumbsUpIcon}
            count={formatCount(stats.likes)}
            label="Like"
            pressed={vote === 'like'}
            activeClass="text-vote-up drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            onClick={() => onVote('like')}
          />
          <ActionButton
            icon={ThumbsDownIcon}
            count={formatCount(stats.dislikes)}
            label="Dislike"
            pressed={vote === 'dislike'}
            activeClass="text-vote-down drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            onClick={() => onVote('dislike')}
          />
          <ActionButton
            icon={CommentIcon}
            count={formatCount(stats.comments)}
            label="Comments"
            to={`/post/${post.id}`}
            activeClass="hover:text-highlight"
          />
        </div>
        <div className="ml-auto">
          <ActionButton icon={ShareIcon} label="Share" activeClass="hover:text-highlight" />
        </div>
      </div>
    </article>
  )
}



