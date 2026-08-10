import Avatar from '../ui/Avatar'
import { SearchIcon } from '../ui/Icons'

const NAV_LINKS = ['Home', 'Create', 'Discover']

export default function Navbar({ activeLink = 'Home', onLinkClick, user }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-nav">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-8 px-6">
        <span className="text-2xl font-extrabold tracking-tight text-brand">Tear of God</span>

        <nav className="flex items-center gap-6">
          {NAV_LINKS.map((label) => {
            const isActive = label === activeLink
            return (
              <button
                key={label}
                type="button"
                onClick={() => onLinkClick?.(label)}
                aria-current={isActive ? 'page' : undefined}
                className={`border-b-2 pb-0.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-brand-accent text-ink-soft'
                    : 'border-transparent text-muted hover:text-ink-soft'
                }`}
              >
                {label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Presentational until search is in scope. */}
          <div className="relative hidden sm:block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search Tear of God..."
              aria-label="Search Tear of God"
              className="h-9 w-56 rounded-full bg-search py-2 pr-4 pl-9 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-brand-accent lg:w-64"
            />
          </div>

          <button type="button" aria-label="Account" className="rounded-full">
            <Avatar size="sm" name={user?.name} src={user?.avatarUrl} />
          </button>
        </div>
      </div>
    </header>
  )
}
