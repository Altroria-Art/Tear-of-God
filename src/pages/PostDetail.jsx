import { Link, useParams } from 'react-router-dom'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import CommentSection from '../components/post/CommentSection'
import Avatar from '../components/ui/Avatar'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useFeed } from '../context/feedContext'
import { MOCK_POSTS } from '../data/mockFeed'
import { formatCount } from '../lib/feed'

export default function PostDetail() {
  const { postId } = useParams()
  const { votes, comments, voteOn, addComment, statsFor } = useFeed()

  const post = MOCK_POSTS.find((p) => p.id === postId)

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-ink">Post not found</p>
        <Link to="/" className="mt-2 inline-block text-sm text-brand hover:underline">
          Back to feed
        </Link>
      </main>
    )
  }

  const { author, postedAt, category, title, description, tiers } = post
  const vote = votes[post.id]
  const stats = statsFor(post)
  const postComments = comments[post.id] ?? []

  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      <Link
        to="/"
        aria-label="Back to feed"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface p-2 text-ink-soft transition-colors hover:bg-search"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Link>

      <article className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={author.name} src={author.avatarUrl} />
          <div>
            <p className="text-sm font-bold text-ink">{author.name}</p>
            <p className="text-xs text-muted">{postedAt}</p>
          </div>
        </div>

        <p className="mt-4 inline-block rounded-md bg-tag px-2 py-1 text-[10px] font-bold tracking-wider text-brand uppercase">
          {category}
        </p>

        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}

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
              onClick={() => voteOn(post.id, 'like')}
            />
            <ActionButton
              icon={ThumbsDownIcon}
              count={formatCount(stats.dislikes)}
              label="Dislike"
              pressed={vote === 'dislike'}
              activeClass="text-vote-down"
              onClick={() => voteOn(post.id, 'dislike')}
            />
            <ActionButton icon={CommentIcon} count={formatCount(stats.comments)} label="Comments" />
          </div>
          <div className="ml-auto">
            <ActionButton icon={ShareIcon} label="Share" />
          </div>
        </div>
      </article>

      <CommentSection comments={postComments} onSubmit={(body) => addComment(post.id, body)} />
    </main>
  )
}
