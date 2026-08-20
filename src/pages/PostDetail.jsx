import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import AboutTemplateCard from '../components/post/AboutTemplateCard'
import CommentSection from '../components/post/CommentSection'
import Avatar from '../components/ui/Avatar'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { fetchRanking, createComment } from '../lib/api'

export default function PostDetail() {
  const { postId } = useParams()
  const { currentUser } = useUser()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userAction, setUserAction] = useState(null)
  const [likesCount, setLikesCount] = useState(0)
  const [dislikesCount, setDislikesCount] = useState(0)

  useEffect(() => {
    if (!postId) return

    let cancelled = false

    async function loadPost() {
      setIsLoading(true)
      try {
        const userId = currentUser?.id || null
        console.log('[PostDetail] fetching with userId:', userId)
        const { data, error } = await fetchRanking(postId, userId)
        if (cancelled) return

        if (data) {
          const postData = Array.isArray(data) ? data.find(p => p.id === postId) : data;
          if (!postData) { setIsLoading(false); return; }

          const tiersMap = {}
          postData.ranking_items?.forEach(ri => {
            if (!tiersMap[ri.tier]) tiersMap[ri.tier] = []
            const realName = ri.item?.name || ri.item_name || ri.item_id;
            const realImage = ri.item?.image_url || ri.item_image;
            tiersMap[ri.tier].push({ id: ri.item_id, name: realName, image_url: realImage })
          })

          const tiers = Object.keys(tiersMap).map(tier => ({ tier, items: tiersMap[tier] }))

          setPost({
            id: postData.id,
            author: { name: postData.profile?.username || 'Unknown User', avatarUrl: postData.profile?.avatar_url },
            postedAt: new Date(postData.created_at).toLocaleDateString(),
            category: postData.category,
            title: postData.title,
            description: postData.description,
            tiers: tiers.length > 0 ? tiers : [{ tier: 'S', items: [] }],
            commentsCount: postData.stats?.comments || (postData.comments ? postData.comments.length : 0)
          })

          setLikesCount(postData.stats?.totalLikes || 0)
          setDislikesCount(postData.stats?.totalDislikes || 0)
          setUserAction(postData.stats?.currentUserVote || null)

          if (postData.comments) {
            setComments(postData.comments.map(c => ({
              id: c.id,
              author: { name: c.username || 'Unknown', avatarUrl: c.avatar_url },
              postedAt: new Date(c.created_at).toLocaleDateString(),
              body: c.content
            })))
          }
        } else {
          console.error("Failed to fetch post:", error)
        }
      } catch (err) {
        console.error("Failed to fetch post:", err)
      }
      setIsLoading(false)
    }
    loadPost()
    return () => { cancelled = true }
  }, [postId, currentUser?.id])

  const handleVote = (type) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนทำการโหวต');
      return;
    }

    let targetAction

    let newLikes = likesCount
    let newDislikes = dislikesCount
    let nextAction = userAction

    if (type === 'like') {
      if (userAction === 'liked') {
        newLikes = Math.max(0, newLikes - 1)
        nextAction = null
        targetAction = 'cancel'
      } else if (userAction === 'disliked') {
        newDislikes = Math.max(0, newDislikes - 1)
        newLikes += 1
        nextAction = 'liked'
        targetAction = 'like'
      } else {
        newLikes += 1
        nextAction = 'liked'
        targetAction = 'like'
      }
    } else {
      if (userAction === 'disliked') {
        newDislikes = Math.max(0, newDislikes - 1)
        nextAction = null
        targetAction = 'cancel'
      } else if (userAction === 'liked') {
        newLikes = Math.max(0, newLikes - 1)
        newDislikes += 1
        nextAction = 'disliked'
        targetAction = 'dislike'
      } else {
        newDislikes += 1
        nextAction = 'disliked'
        targetAction = 'dislike'
      }
    }

    setUserAction(nextAction)
    setLikesCount(newLikes)
    setDislikesCount(newDislikes)

    fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rankingId: postId, userId: currentUser.id, action: targetAction })
    }).catch(err => console.error('Vote API failed:', err))
  }

  const handleAddComment = async (body) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนคอมเมนต์ครับ!');
      return;
    }
    if (!body || !body.trim()) return;

    const { data, error } = await createComment({
      ranking_id: postId,
      user_id: currentUser.id,
      content: body.trim()
    });

    if (!error) {
      setComments([{
        id: data?.id || `comm_${Date.now()}`,
        author: { name: currentUser.username || 'User', avatarUrl: currentUser.avatar_url },
        postedAt: 'Just now',
        body: body.trim()
      }, ...comments]);
      setPost(prev => ({ ...prev, commentsCount: (prev.commentsCount || 0) + 1 }))
    } else {
      alert('คอมเมนต์ไม่สำเร็จ: ' + error);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</p>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-bold text-gray-800">ไม่พบโพสต์ที่คุณตามหา</p>
        <Link to="/" className="mt-2 inline-block text-sm text-blue-500 hover:underline">กลับสู่หน้าหลัก</Link>
      </main>
    )
  }

  const { author, postedAt, category, title, description, tiers, commentsCount } = post
  const itemCount = tiers.reduce((n, { items }) => n + items.length, 0)

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <article className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar name={author.name} src={author.avatarUrl} />
              <div>
                <p className="text-sm font-bold text-gray-900">{author.name}</p>
                <p className="text-xs text-gray-500">{postedAt}</p>
              </div>
            </div>

            <p className="mt-4 inline-block rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-600 uppercase">
              {category}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
            {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}

            <div className="mt-4 space-y-2 rounded-xl border border-gray-100 p-2 bg-[#faf8f5]">
              {tiers.map(({ tier, items }) => (
                <TierRow key={tier} tier={tier} items={items} />
              ))}
            </div>

            <div className="mt-4 flex items-center border-t border-gray-100 pt-3">
              <div className="flex items-center gap-5">
                <ActionButton
                  icon={ThumbsUpIcon}
                  count={likesCount}
                  label="Like"
                  pressed={userAction === 'liked'}
                  activeClass="text-blue-600 font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={dislikesCount}
                  label="Dislike"
                  pressed={userAction === 'disliked'}
                  activeClass="text-red-600 font-bold"
                  onClick={() => handleVote('dislike')}
                />
                <ActionButton icon={CommentIcon} count={commentsCount} label="Comments" />
              </div>
              <div className="ml-auto">
                <ActionButton
                  icon={ShareIcon}
                  label="Share"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('คัดลอกลิงก์โพสต์เรียบร้อยแล้ว!');
                  }}
                />
              </div>
            </div>
          </article>

          <CommentSection comments={comments} onSubmit={handleAddComment} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AboutTemplateCard name={title} description={description} itemCount={itemCount} />
        </aside>
      </div>
    </main>
  )
}
