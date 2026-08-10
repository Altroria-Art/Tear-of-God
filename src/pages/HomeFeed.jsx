import { useState } from 'react'
import CategoryTabs from '../components/feed/CategoryTabs'
import FeedCard from '../components/feed/FeedCard'
import { CATEGORIES, MOCK_POSTS } from '../data/mockFeed'

export default function HomeFeed() {
  // Display-only for now — filtering waits on real data.
  const [activeCategory, setActiveCategory] = useState('For You')

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <CategoryTabs
        categories={CATEGORIES}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      <div className="mt-6 space-y-5">
        {MOCK_POSTS.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}
      </div>
    </main>
  )
}
