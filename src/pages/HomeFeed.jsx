import { useMemo, useState } from 'react'
import CategoryTabs from '../components/feed/CategoryTabs'
import FeedCard from '../components/feed/FeedCard'
import { CATEGORIES, FOR_YOU, MOCK_POSTS } from '../data/mockFeed'
import { selectPosts, shuffle } from '../lib/feed'

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState(FOR_YOU)
  const [votes, setVotes] = useState({})

  // Random but stable for the session — reshuffling on every render would
  // rearrange the feed under the reader.
  const forYouOrder = useMemo(() => shuffle(MOCK_POSTS).map((post) => post.id), [])

  function handleVote(postId, vote) {
    setVotes((prev) => ({ ...prev, [postId]: prev[postId] === vote ? null : vote }))
  }

  const visiblePosts = selectPosts(MOCK_POSTS, activeCategory, { votes, forYouOrder })

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <CategoryTabs
        categories={CATEGORIES}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      <div className="mt-6 space-y-5">
        {visiblePosts.length === 0 && (
          <p className="text-center text-sm text-muted">No posts in this category yet.</p>
        )}
        {visiblePosts.map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            vote={votes[post.id]}
            onVote={(vote) => handleVote(post.id, vote)}
          />
        ))}
      </div>
    </main>
  )
}
