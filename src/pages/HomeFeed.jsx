import { useState } from 'react'
import CategoryTabs from '../components/feed/CategoryTabs'
import FeedCard from '../components/feed/FeedCard'
import { useFeed } from '../context/feedContext'
import { CATEGORIES, FOR_YOU, MOCK_POSTS } from '../data/mockFeed'
import { selectPosts } from '../lib/feed'

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState(FOR_YOU)
  const { votes, voteOn, statsFor, forYouOrder } = useFeed()

  const visiblePosts = selectPosts(MOCK_POSTS, activeCategory, { statsFor, forYouOrder })

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
            stats={statsFor(post)}
            onVote={(vote) => voteOn(post.id, vote)}
          />
        ))}
      </div>
    </main>
  )
}
