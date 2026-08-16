import { useCallback, useMemo, useState } from 'react'
import { MOCK_COMMENTS, MOCK_POSTS } from '../data/mockFeed'
import { shuffle, statsWithVote } from '../lib/feed'
import { FeedContext } from './feedContext'

const VIEWER = { name: 'You', avatarUrl: null }

export default function FeedProvider({ children }) {
  const [votes, setVotes] = useState({})
  const [comments, setComments] = useState(MOCK_COMMENTS)
  // Comments seeded in mock data don't move stats.comments' large mock count —
  // only comments added this session do, so the count stays meaningful.
  const [commentDeltas, setCommentDeltas] = useState({})

  // Random but stable for the session — reshuffling on every render would
  // rearrange the feed under the reader.
  const forYouOrder = useMemo(() => shuffle(MOCK_POSTS).map((post) => post.id), [])

  const voteOn = useCallback((postId, vote) => {
    setVotes((prev) => ({ ...prev, [postId]: prev[postId] === vote ? null : vote }))
  }, [])

  const addComment = useCallback((postId, body) => {
    const comment = {
      id: `${postId}-c${Date.now()}`,
      author: VIEWER,
      postedAt: 'Just now',
      body,
    }
    setComments((prev) => ({ ...prev, [postId]: [comment, ...(prev[postId] ?? [])] }))
    setCommentDeltas((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
  }, [])

  // Effective counts for a post: base stats + this viewer's vote + comments they added.
  const statsFor = useCallback(
    (post) => {
      const base = statsWithVote(post.stats, votes[post.id])
      return { ...base, comments: base.comments + (commentDeltas[post.id] ?? 0) }
    },
    [votes, commentDeltas],
  )

  const value = useMemo(
    () => ({
      votes,
      comments,
      forYouOrder,
      voteOn,
      addComment,
      statsFor,
    }),
    [votes, comments, forYouOrder, voteOn, addComment, statsFor],
  )

  return <FeedContext value={value}>{children}</FeedContext>
}
