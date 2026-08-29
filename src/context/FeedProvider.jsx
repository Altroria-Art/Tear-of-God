import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsWithVote } from '../lib/feed'
import { FeedContext } from './feedContext'
import { useUser } from './UserContext'

export default function FeedProvider({ children }) {
  const navigate = useNavigate()
  const { currentUser } = useUser()

  const [votes, setVotes] = useState({})
  const [comments, setComments] = useState({}) // เปลี่ยนจาก MOCK_COMMENTS เป็นค่าว่าง
  const [commentDeltas, setCommentDeltas] = useState({})

  const forYouOrder = useMemo(() => [], []) // ไม่มี Mock Posts แล้ว ให้เป็น Array ว่าง

  // ฟังก์ชันกดโหวต / กดไลก์ (เช็คการล็อกอิน)
  const voteOn = useCallback((postId, vote) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนกดไลก์หรือโหวตครับ!')
      navigate('/login')
      return
    }

    setVotes((prev) => ({ ...prev, [postId]: prev[postId] === vote ? null : vote }))
  }, [currentUser, navigate])

  // ฟังก์ชันเพิ่มคอมเมนต์ (เช็คการล็อกอิน และใช้ชื่อ User จริง)
  const addComment = useCallback((postId, body) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็นครับ!')
      navigate('/login')
      return
    }

    const comment = {
      id: `${postId}-c${Date.now()}`,
      author: { 
        name: currentUser.username || 'You', 
        avatarUrl: currentUser.avatar_url || null 
      },
      postedAt: 'Just now',
      body,
    }
    
    setComments((prev) => ({ ...prev, [postId]: [comment, ...(prev[postId] ?? [])] }))
    setCommentDeltas((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
  }, [currentUser, navigate])

  const statsFor = useCallback(
    (post) => {
      const base = post?.stats ? statsWithVote(post.stats, votes[post.id]) : { likes: 0, dislikes: 0, comments: 0 }
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


