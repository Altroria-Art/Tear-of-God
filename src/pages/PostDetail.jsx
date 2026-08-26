import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../components/feed/ActionButton'
import TierRow from '../components/feed/TierRow'
import AboutTemplateCard from '../components/post/AboutTemplateCard'
import CommentSection from '../components/post/CommentSection'
import Avatar from '../components/ui/Avatar'
import { ArrowLeftIcon, CommentIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from '../components/ui/Icons'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/ui/Toast'

// 📍 นำเข้า createComment มาใช้งาน
import { fetchRanking, createComment, voteRanking, fetchTemplate } from '../lib/api'

export default function PostDetail() {
  const { postId } = useParams()
  const { currentUser } = useUser()
  const toast = useToast()

  const [post, setPost] = useState(null)
  const [template, setTemplate] = useState(null)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userVote, setUserVote] = useState(null) // 'like' | 'dislike' | null — seed จาก data.user_vote เท่านั้น

  useEffect(() => {
    async function loadPost() {
      setIsLoading(true)
      const { data, error } = await fetchRanking(postId, currentUser?.id)

      if (data) {
        const tiersMap = {}
        data.ranking_items?.forEach(ri => {
          if (!tiersMap[ri.tier]) tiersMap[ri.tier] = []
          
          const realName = ri.item?.name || ri.item_name || ri.item_id;
          const realImage = ri.item?.image_url || ri.item_image;

          tiersMap[ri.tier].push({
            id: ri.item_id,
            name: realName,
            image_url: realImage
          })
        })

        const tiers = Object.keys(tiersMap).map(tier => ({
          tier: tier, 
          items: tiersMap[tier]
        }))

        setPost({
          id: data.id,
          templateId: data.template_id ?? null,
          authorId: data.profile?.id ?? null,
          author: {
            name: data.profile?.username || 'Unknown User',
            avatarUrl: data.profile?.avatar_url
          },
          postedAt: new Date(data.created_at).toLocaleDateString(),
          category: data.category,
          title: data.title,
          description: data.description,
          tiers: tiers.length > 0 ? tiers : [{ tier: 'S', items: [] }],
          stats: {
            likes: data.stats?.likes || 0,
            dislikes: data.stats?.dislikes || 0,
            comments: data.stats?.comments || (data.comments ? data.comments.length : 0)
          }
        })
        setUserVote(data.user_vote ?? null)

        if (data.comments) {
          const formattedComments = data.comments.map(c => ({
            id: c.id,
            author: {
              name: c.username || 'Unknown',
              avatarUrl: c.avatar_url
            },
            postedAt: new Date(c.created_at).toLocaleDateString(),
            body: c.content
          }))
          setComments(formattedComments)
        }
      } else {
        console.error("Failed to load post:", error)
      }
      setIsLoading(false)
    }

    if (postId) loadPost()
  }, [postId, currentUser])

  // แยก effect ต่างหากจาก loadPost — loadPost มี currentUser เป็น dep แล้ว
  // ถ้ารวมกันจะยิง fetchTemplate ซ้ำทุกครั้งที่สถานะล็อกอินเปลี่ยน
  useEffect(() => {
    let cancelled = false
    const tid = post?.templateId
    if (!tid) {
      setTemplate(null)
      return
    }
    fetchTemplate(tid, { light: true }).then(({ data }) => {
      if (!cancelled && data) setTemplate(data)
    })
    return () => { cancelled = true }
  }, [post?.templateId])

  // state machine: ส่ง "สถานะปลายทาง" ไปหา API เสมอ ไม่ใช่ action —
  // กด like ซ้ำตอน like อยู่แล้ว = ยกเลิกโหวต (null) ดู docs/feature-like-dislike-voting.md §4
  const handleVote = async (type) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนโหวตครับ!');
      return;
    }

    const nextVote = userVote === type ? null : type
    const prevVote = userVote
    const prevStats = post.stats

    // optimistic: อัปเดต UI ก่อนให้ตอบสนองทันที แล้วค่อยทับด้วยของจริงจาก response
    let optimisticLikes = prevStats.likes
    let optimisticDislikes = prevStats.dislikes
    if (prevVote === 'like') optimisticLikes = Math.max(0, optimisticLikes - 1)
    if (prevVote === 'dislike') optimisticDislikes = Math.max(0, optimisticDislikes - 1)
    if (nextVote === 'like') optimisticLikes += 1
    if (nextVote === 'dislike') optimisticDislikes += 1

    setUserVote(nextVote)
    setPost(prev => ({ ...prev, stats: { ...prev.stats, likes: optimisticLikes, dislikes: optimisticDislikes } }))

    const result = await voteRanking({ rankingId: postId, userId: currentUser.id, voteType: nextVote })

    if (result.success !== false) {
      setUserVote(result.userVote ?? null)
      setPost(prev => ({ ...prev, stats: { ...prev.stats, likes: result.likes ?? prev.stats.likes, dislikes: result.dislikes ?? prev.stats.dislikes } }))
    } else {
      // rollback
      setUserVote(prevVote)
      setPost(prev => ({ ...prev, stats: prevStats }))
      toast.error('บันทึกการโหวตไม่สำเร็จ: ' + (result.error || 'เกิดข้อผิดพลาด'))
    }
  }

  // 📍 [แก้ไขแล้ว]: ใช้ createComment จาก api.js แทนการ fetch ดิบๆ
  const handleAddComment = async (body) => {
    if (!currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบก่อนคอมเมนต์ครับ!');
      return;
    }
    if (!body || !body.trim()) return;

    const { data, error } = await createComment({
      ranking_id: postId,
      user_id: currentUser.id,
      content: body.trim()
    });

    if (!error) {
      const newComment = {
        id: data?.id || `comm_${Date.now()}`,
        author: {
          name: currentUser.username || 'User',
          avatarUrl: currentUser.avatar_url
        },
        postedAt: 'Just now',
        body: body.trim()
      }
      setComments([newComment, ...comments]);
      setPost(prev => ({
        ...prev,
        stats: { ...prev.stats, comments: prev.stats.comments + 1 }
      }))
    } else {
      toast.error('คอมเมนต์ไม่สำเร็จ: ' + error);
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
        <Link to="/" className="mt-2 inline-block text-sm text-blue-500 hover:underline">
          กลับสู่หน้าหลัก
        </Link>
      </main>
    )
  }

  const { author, authorId, postedAt, category, title, description, tiers, stats } = post
  const itemCount = tiers.reduce((n, { items }) => n + items.length, 0)
  // ใช้เฉพาะ template ที่ตรงกับโพสต์ปัจจุบัน — กัน metadata ของ template เก่าค้างจอตอนสลับโพสต์
  const tpl = template?.id === post.templateId ? template : null

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>

          <article className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* 📍 คลิกชื่อ/รูปผู้สร้าง = ไปดูโปรไฟล์ของเขา */}
            <Link
              to={authorId ? `/profile/${authorId}` : '#'}
              className={`flex items-center gap-3 w-fit ${!authorId ? 'pointer-events-none' : ''}`}
            >
              <Avatar name={author.name} src={author.avatarUrl} />
              <div>
                <p className="text-sm font-bold text-gray-900 hover:text-[#fbbf24] transition-colors">{author.name}</p>
                <p className="text-xs text-gray-500">{postedAt}</p>
              </div>
            </Link>

            <p className="mt-4 inline-block rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-600 uppercase">
              {category}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
            {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
            
            {post.hashtags && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.hashtags.split(',').filter(Boolean).map((tag, idx) => {
                  const cleanTag = tag.trim().replace('#', '');
                  return (
                    <Link 
                      key={idx} 
                      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
                      className="px-3 py-1 rounded-md bg-[#f4f4f5] text-gray-600 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
                    >
                      #{cleanTag}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-4 space-y-2 rounded-xl border border-gray-100 p-2 bg-white">
              {tiers.map(({ tier, items }) => (
                <TierRow key={tier} tier={tier} items={items} />
              ))}
            </div>

            <div className="mt-4 flex items-center border-t border-gray-100 pt-3">
              <div className="flex items-center gap-5">
                <ActionButton 
                  icon={ThumbsUpIcon} 
                  count={stats.likes} 
                  label="Like" 
                  pressed={userVote === 'like'}
                  activeClass="text-blue-600 font-bold"
                  onClick={() => handleVote('like')}
                />
                <ActionButton
                  icon={ThumbsDownIcon}
                  count={stats.dislikes}
                  label="Dislike"
                  pressed={userVote === 'dislike'}
                  activeClass="text-red-600 font-bold"
                  onClick={() => handleVote('dislike')}
                />
                <ActionButton icon={CommentIcon} count={stats.comments} label="Comments" />
              </div>
              <div className="ml-auto">
                <ActionButton 
                  icon={ShareIcon} 
                  label="Share" 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('คัดลอกลิงก์โพสต์เรียบร้อยแล้ว!');
                  }}
                />
              </div>
            </div>
          </article>

          <CommentSection comments={comments} onSubmit={handleAddComment} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AboutTemplateCard
            templateId={post.templateId}
            name={tpl?.title ?? title}
            description={tpl?.description ?? description}
            itemCount={tpl?.template_items?.length ?? itemCount}
          />
        </aside>
      </div>
    </main>
  )
}
