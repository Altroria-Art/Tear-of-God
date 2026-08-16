import { useParams } from 'react-router-dom'
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

function ActionBar() {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
      <div className="flex items-center gap-5">
        <span className="flex cursor-pointer items-center gap-1.5">
          <ThumbsUpIcon className="h-4 w-4" />
          1.2k
        </span>
        <span className="flex cursor-pointer items-center gap-1.5">
          <ThumbsDownIcon className="h-4 w-4" />
          148
        </span>
        <span className="flex cursor-pointer items-center gap-1.5">
          <CommentIcon className="h-4 w-4" />
          342
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex cursor-pointer items-center gap-1.5">
          <ExportIcon className="h-4 w-4" />
          Export
        </span>
        <span className="flex cursor-pointer items-center gap-1.5">
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
      <ActionBar />
    </div>
  )
}

export default function TemplateDetailPage() {
  const { templateId } = useParams()
  const templateData = MOCK_TEMPLATES[templateId] || DEFAULT_TEMPLATE

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
      </div>
    </main>
  )
}
