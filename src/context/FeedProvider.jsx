import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom' // 1. นำเข้า useNavigate สำหรับเปลี่ยนหน้า
import { MOCK_COMMENTS, MOCK_POSTS } from '../data/mockFeed'
import { shuffle, statsWithVote } from '../lib/feed'
import { FeedContext } from './feedContext'
import { useUser } from './UserContext' // 2. นำเข้า useUser เพื่อเช็คสถานะล็อกอิน

export default function FeedProvider({ children }) {
  const navigate = useNavigate()
  const { currentUser } = useUser() // 3. ดึงข้อมูล User ปัจจุบัน

  const [votes, setVotes] = useState({})
  const [comments, setComments] = useState(MOCK_COMMENTS)
  const [commentDeltas, setCommentDeltas] = useState({})

  const forYouOrder = useMemo(() => shuffle(MOCK_POSTS).map((post) => post.id), [])

  // 4. ฟังก์ชันกดโหวต / กดไลก์ (เช็คการล็อกอิน)
  const voteOn = useCallback((postId, vote) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนกดไลก์หรือโหวตครับ!')
      navigate('/login')
      return
    }

    setVotes((prev) => ({ ...prev, [postId]: prev[postId] === vote ? null : vote }))
  }, [currentUser, navigate])

  // 5. ฟังก์ชันเพิ่มคอมเมนต์ (เช็คการล็อกอิน และใช้ชื่อ User จริง)
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