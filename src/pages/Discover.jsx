import { Link } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'

const CATEGORIES = [
  { id: 'general', name: 'General', icon: '✨' },
  { id: 'movie', name: 'Movie', icon: '🎬' },
  { id: 'food', name: 'Food', icon: '🍜' },
  { id: 'sport', name: 'Sport', icon: '🏆' },
]

// Placeholder until rankings are backed by the database.
const POPULAR_TEMPLATES = [
  {
    id: 'goat-nba',
    title: 'GOAT NBA Players',
    authorHandle: '@hoop_alex',
    views: '15.2k',
    tiers: {
      S: ['Michael Jordan', 'LeBron James'],
      A: ['Kobe Bryant', 'Magic Johnson'],
    },
  },
  {
    id: 'best-sci-fi',
    title: 'Best Sci-Fi Movies',
    authorHandle: '@scifi_sarah',
    views: '14.8k',
    tiers: {
      S: ['Inception', 'Arrival'],
      A: ['Blade Runner 2049', 'Interstellar'],
    },
  },
  {
    id: 'ultimate-ramen',
    title: 'Ultimate Ramen Rankings',
    authorHandle: '@Chef_Mike',
    views: '16.8k',
    tiers: {
      S: ['Tonkotsu', 'Shoyu'],
      A: ['Miso', 'Shio'],
    },
  },
]

const TIER_BG = {
  S: 'bg-tier-s',
  A: 'bg-tier-a',
}

function TemplateCard({ template }) {
  const { title, authorHandle, views, tiers } = template

  return (
    <Link
      to={`/template/${template.id}`}
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="relative mb-4 rounded-lg border border-gray-200 bg-[#FCFBF8] p-4">
        <span className="absolute top-3 right-3 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 shadow-sm">
          👤 {views}
        </span>
        <div className="space-y-3">
          {Object.entries(tiers).map(([tier, items]) => (
            <div key={tier} className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-lg font-bold text-white ${TIER_BG[tier]}`}
              >
                {tier}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {items.map((item) => (
                  <span
                    key={item}
                    className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      <div className="mt-3 flex items-center gap-2">
        <Avatar size="sm" name={authorHandle} />
        <span className="text-sm text-gray-600">{authorHandle}</span>
      </div>
      <button
        type="button"
        onClick={(e) => e.preventDefault()}
        className="mt-5 w-full rounded-lg bg-pill-active py-2.5 font-semibold text-ink transition-colors hover:bg-brand-accent"
      >
        Use Template
      </button>
    </Link>
  )
}

export default function Discover() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold text-ink">Discover</h1>
        <p className="mt-2 text-muted">
          Explore top tier lists and templates from the community.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-ink">Categories</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map(({ id, name, icon }) => (
            <Link
              key={id}
              to={`/category/${id}`}
              className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl bg-search text-ink transition-colors hover:bg-tag"
            >
              <span className="text-4xl" aria-hidden="true">
                {icon}
              </span>
              <span className="font-semibold">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Popular Templates</h2>
          <a href="#" className="text-sm font-semibold text-brand hover:underline">
            View All
          </a>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_TEMPLATES.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      </section>
    </main>
  )
}
