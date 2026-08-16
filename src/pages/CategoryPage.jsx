import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'

const CATEGORY_META = {
  general: {
    title: 'General Templates',
    subtitle: 'Browse the broadest range of community tier lists.',
    icon: '✨',
    bg: 'bg-gray-400',
  },
  movie: {
    title: 'Movie Templates',
    subtitle: 'Rank the best films. Discover cinematic favorites.',
    icon: '🎬',
    bg: 'bg-red-400',
  },
  food: {
    title: 'Food Templates',
    subtitle: 'Rank the best eats. Discover community favorites.',
    icon: '🍜',
    bg: 'bg-yellow-400',
  },
  sport: {
    title: 'Sport Templates',
    subtitle: 'Rank the greatest athletes and teams.',
    icon: '🏆',
    bg: 'bg-blue-400',
  },
}

// Placeholder until templates are backed by the database.
const CATEGORY_TEMPLATES = {
  general: [
    {
      id: 'general-1',
      title: 'Top 10 Games of the Year',
      authorName: 'Alex M.',
      authorHandle: '@alexplays',
      views: '21.4k',
      tiers: { S: ['Elden Ring', 'Baldur’s Gate 3'], A: ['Tears of the Kingdom', 'Hades'] },
    },
    {
      id: 'general-2',
      title: 'Best Books to Read in 2026',
      authorName: 'Jane D.',
      authorHandle: '@janereads',
      views: '8.2k',
      tiers: { S: ['Project Hail Mary', 'The Midnight Library'], A: ['Piranesi', 'Klara and the Sun'] },
    },
  ],
  movie: [
    {
      id: 'movie-1',
      title: 'Best Sci-Fi Movies',
      authorName: 'Sarah C.',
      authorHandle: '@scifi_sarah',
      views: '14.8k',
      tiers: { S: ['Inception', 'Arrival'], A: ['Blade Runner 2049', 'Interstellar'] },
    },
    {
      id: 'movie-2',
      title: 'Greatest Superhero Films',
      authorName: 'Nate B.',
      authorHandle: '@nerdynate',
      views: '19.3k',
      tiers: { S: ['The Dark Knight', 'Avengers: Endgame'], A: ['Spider-Verse', 'Logan'] },
    },
  ],
  food: [
    {
      id: 'food-1',
      title: 'Ultimate Ramen Rankings',
      authorName: 'Chef Mike',
      authorHandle: '@Chef_Mike',
      views: '16.8k',
      tiers: { S: ['Tonkotsu', 'Shoyu'], A: ['Miso', 'Shio'] },
    },
    {
      id: 'food-2',
      title: 'Best Street Food in Bangkok',
      authorName: 'Nok S.',
      authorHandle: '@streetbites_nok',
      views: '12.4k',
      tiers: { S: ['Pad Thai', 'Som Tum'], A: ['Khao Man Gai', 'Moo Ping'] },
    },
  ],
  sport: [
    {
      id: 'sport-1',
      title: 'GOAT NBA Players',
      authorName: 'Alex Mercer',
      authorHandle: '@hoop_alex',
      views: '15.2k',
      tiers: { S: ['Michael Jordan', 'LeBron James'], A: ['Kobe Bryant', 'Magic Johnson'] },
    },
    {
      id: 'sport-2',
      title: 'Greatest Footballers Ever',
      authorName: 'Diego M.',
      authorHandle: '@futbol_diego',
      views: '22.7k',
      tiers: { S: ['Messi', 'Maradona'], A: ['Ronaldo', 'Zidane'] },
    },
  ],
}

const TIER_ROW_COLORS = {
  S: 'bg-red-400',
  A: 'bg-orange-400',
}

function ArrowLeftIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function PlusIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TierPreviewRow({ tier, items }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-bold text-white ${TIER_ROW_COLORS[tier]}`}
      >
        {tier}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }) {
  const { title, authorName, authorHandle, views, tiers } = template

  return (
    <article className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="relative m-3 rounded-lg bg-[#F9F9F9] p-3">
        <span className="absolute top-2 right-2 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 shadow-sm">
          👥 {views}
        </span>
        <div className="space-y-2">
          <TierPreviewRow tier="S" items={tiers.S} />
          <TierPreviewRow tier="A" items={tiers.A} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <Avatar size="sm" name={authorName} />
          <span className="text-sm text-gray-500">{authorHandle}</span>
        </div>
        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2 font-semibold text-gray-900 transition-colors hover:bg-yellow-500"
        >
          <PlusIcon className="h-4 w-4" />
          Use
        </button>
      </div>
    </article>
  )
}

export default function CategoryPage() {
  const { categoryId } = useParams()
  const meta = CATEGORY_META[categoryId] ?? CATEGORY_META.general
  const templates = CATEGORY_TEMPLATES[categoryId] ?? CATEGORY_TEMPLATES.general

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center gap-4">
        <Link
          to="/discover"
          aria-label="Back to Discover"
          className="rounded-full border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-xl text-4xl ${meta.bg}`}
        >
          <span aria-hidden="true">{meta.icon}</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">{meta.title}</h1>
          <p className="mt-1 text-gray-600">{meta.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </main>
  )
}
