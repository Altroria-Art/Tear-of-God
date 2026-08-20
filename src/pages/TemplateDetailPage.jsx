import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  CommentIcon,
  ShareIcon,
  ExportIcon,
  StarIcon,
  TemplateIcon,
} from '../components/ui/Icons'
import { DEFAULT_TEMPLATE, MOCK_TEMPLATES } from '../data/mockTemplates'

const TIER_COLORS = {
  S: 'bg-[#FF7E7E]',
  A: 'bg-[#FFB05B]',
  B: 'bg-[#FFF67B]',
  C: 'bg-[#7BFF88]',
  D: 'bg-[#7BCAFF]',
}

function TierRow({ tier, items }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-2.5 last:border-b-0">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-base font-bold text-white ${TIER_COLORS[tier]}`}
      >
        {tier}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function AverageTopBar({ timeAgo }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{timeAgo}</span>
      <span className="flex items-center gap-1 rounded bg-[#9A7B38] px-2 py-1 text-xs text-white">
        <StarIcon className="h-3.5 w-3.5" />
        Community Average
      </span>
    </div>
  )
}

function UserTopBar({ authorHandle, timeAgo }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Avatar size="sm" name={authorHandle} />
      <span className="text-sm font-semibold text-gray-800">{authorHandle}</span>
      <span className="text-sm text-gray-400">·</span>
      <span className="text-sm text-gray-500">{timeAgo}</span>
    </div>
  )
}

function TierListActionBar({ id, initialLikes = 1200, initialDislikes = 148, initialComments = 342 }) {
  const key = `tog_interaction_${id}`
  const saved = (() => { try { return localStorage.getItem(key) } catch { return null } })()
  const [userAction, setUserAction] = useState(saved)
  const [likesCount, setLikesCount] = useState(initialLikes + (saved === 'liked' ? 1 : 0))
  const [dislikesCount, setDislikesCount] = useState(initialDislikes + (saved === 'disliked' ? 1 : 0))

  const persist = (next) => { try { localStorage.setItem(key, next) } catch {} }

  const handleLike = () => {
    if (userAction === 'liked') {
      setLikesCount((n) => Math.max(0, n - 1))
      setUserAction(null)
      persist(null)
    } else if (userAction === 'disliked') {
      setDislikesCount((n) => Math.max(0, n - 1))
      setLikesCount((n) => n + 1)
      setUserAction('liked')
      persist('liked')
    } else {
      setLikesCount((n) => n + 1)
      setUserAction('liked')
      persist('liked')
    }
  }

  const handleDislike = () => {
    if (userAction === 'disliked') {
      setDislikesCount((n) => Math.max(0, n - 1))
      setUserAction(null)
      persist(null)
    } else if (userAction === 'liked') {
      setLikesCount((n) => Math.max(0, n - 1))
      setDislikesCount((n) => n + 1)
      setUserAction('disliked')
      persist('disliked')
    } else {
      setDislikesCount((n) => n + 1)
      setUserAction('disliked')
      persist('disliked')
    }
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
      <div className="flex items-center gap-5">
        <span onClick={handleLike} className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userAction === 'liked' ? 'text-blue-500' : 'hover:text-gray-700'}`}>
          <ThumbsUpIcon className="h-4 w-4" />
          {likesCount.toLocaleString()}
        </span>
        <span onClick={handleDislike} className={`flex cursor-pointer items-center gap-1.5 transition-colors ${userAction === 'disliked' ? 'text-red-500' : 'hover:text-gray-700'}`}>
          <ThumbsDownIcon className="h-4 w-4" />
          {dislikesCount}
        </span>
        <span className="flex cursor-pointer items-center gap-1.5 hover:text-gray-700 transition-colors">
          <CommentIcon className="h-4 w-4" />
          {initialComments}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex cursor-pointer items-center gap-1.5 hover:text-gray-700 transition-colors">
          <ExportIcon className="h-4 w-4" />
          Export
        </span>
        <span className="flex cursor-pointer items-center gap-1.5 hover:text-gray-700 transition-colors">
          <ShareIcon className="h-4 w-4" />
          Share
        </span>
      </div>
    </div>
  )
}

function TierListCard({ list }) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white">
      {list.isAverage ? (
        <AverageTopBar timeAgo={list.timeAgo} />
      ) : (
        <UserTopBar authorHandle={list.authorHandle} timeAgo={list.timeAgo} />
      )}
      {Object.entries(list.tiers).map(([tier, items]) => (
        <TierRow key={tier} tier={tier} items={items} />
      ))}
      <TierListActionBar id={list.id} />
    </div>
  )
}

export default function TemplateDetailPage() {
  const { templateId } = useParams()
  const location = useLocation()
  const templateData = MOCK_TEMPLATES[templateId] || DEFAULT_TEMPLATE

  useEffect(() => {
    if (location.hash === '#comments') {
      document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash])

  return (
    <main className="min-h-screen bg-[#FDF9F1]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            {templateData.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar size="sm" name={templateData.authorHandle} />
              <span className="font-medium text-gray-800">{templateData.authorHandle}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {templateData.uses} Uses
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {templateData.views} Views
              </span>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-[#7A612A] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#634f22]"
            >
              <TemplateIcon className="h-4 w-4" />
              Use Template
            </button>
          </div>

          <p className="mt-4 max-w-3xl text-gray-600">{templateData.description}</p>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Community Rankings</h2>
            <span className="flex items-center gap-1 text-sm text-gray-500">
              Sort by:
              <span className="font-semibold text-gray-700">Most Liked</span>
            </span>
          </div>

          {templateData.rankings.map((list) => (
            <TierListCard key={list.id} list={list} />
          ))}
        </section>

        <section id="comments-section" className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Comments</h2>
          <p className="text-gray-500">Comments coming soon...</p>
        </section>
      </div>
    </main>
  )
}
