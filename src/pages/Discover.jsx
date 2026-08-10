import Avatar from '../components/ui/Avatar'

const CATEGORIES = [
  { name: 'Anime', icon: '🎌' },
  { name: 'Movie', icon: '🎬' },
  { name: 'Food', icon: '🍜' },
  { name: 'Sport', icon: '🏆' },
]

// Placeholder until rankings are backed by the database.
const POPULAR_TEMPLATES = [
  {
    id: 'template-1',
    title: 'GOAT NBA Players',
    author: { name: 'Alex Mercer', initials: 'AM' },
    views: '15.2k',
    tiers: {
      S: ['Michael Jordan', 'LeBron James'],
      A: ['Kobe Bryant', 'Magic Johnson'],
    },
  },
  {
    id: 'template-2',
    title: 'Best Sci-Fi Movies',
    author: { name: 'Sarah Chen', initials: 'SC' },
    views: '9.8k',
    tiers: {
      S: ['Inception', 'Arrival'],
      A: ['Blade Runner 2049'],
    },
  },
  {
    id: 'template-3',
    title: 'Ultimate Ramen Rankings',
    author: { name: 'Taro Yamada', initials: 'TY' },
    views: '7.4k',
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
  const { title, author, views, tiers } = template

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative space-y-1.5 bg-search p-3">
        <span className="absolute top-2 right-2 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          👤 {views}
        </span>
        {Object.entries(tiers).map(([tier, items]) => (
          <div
            key={tier}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${TIER_BG[tier]}`}
          >
            <span className="shrink-0 text-sm font-bold text-white">{tier}</span>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-ink-soft"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <Avatar size="sm" name={author.name} initials={author.initials} />
          <span className="text-sm text-muted">{author.name}</span>
        </div>
        <div className="mt-auto pt-4">
          <button
            type="button"
            className="w-full rounded-lg bg-pill-active py-2 font-semibold text-ink transition-colors hover:bg-brand-accent"
          >
            Use Template
          </button>
        </div>
      </div>
    </article>
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
          {CATEGORIES.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl bg-search text-ink transition-colors hover:bg-tag"
            >
              <span className="text-4xl" aria-hidden="true">
                {icon}
              </span>
              <span className="font-semibold">{name}</span>
            </button>
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
