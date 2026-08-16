import { FOR_YOU, TRENDING } from '../data/mockFeed'

// Display formatting for engagement counts: 1240 -> '1.2k', 2000000 -> '2m'.
export function formatCount(n) {
  if (n >= 1_000_000) return `${trimZero(n / 1_000_000)}m`
  if (n >= 1_000) return `${trimZero(n / 1_000)}k`
  return `${n}`
}

function trimZero(n) {
  return n.toFixed(1).replace(/\.0$/, '')
}

// The viewer's own vote is optimistic — it adjusts the count they see.
export function statsWithVote(stats, vote) {
  return {
    likes: stats.likes + (vote === 'like' ? 1 : 0),
    dislikes: stats.dislikes + (vote === 'dislike' ? 1 : 0),
    comments: stats.comments,
  }
}

export const engagementOf = (stats) => stats.likes + stats.comments

// Fisher-Yates on a copy — never mutates the source array.
export function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Which posts to render, in what order, for the active tab.
export function selectPosts(posts, activeCategory, { votes, forYouOrder }) {
  if (activeCategory === FOR_YOU) {
    const order = new Map(forYouOrder.map((id, index) => [id, index]))
    return [...posts].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity))
  }

  if (activeCategory === TRENDING) {
    return [...posts].sort(
      (a, b) =>
        engagementOf(statsWithVote(b.stats, votes[b.id])) -
        engagementOf(statsWithVote(a.stats, votes[a.id])),
    )
  }

  return posts.filter((post) => post.category === activeCategory)
}
