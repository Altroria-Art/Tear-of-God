export default function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((category) => {
        const isActive = category === active
        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(category)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-pill-active font-semibold text-ink-soft'
                : 'border border-line bg-surface text-ink-soft hover:bg-search'
            }`}
          >
            {category}
          </button>
        )
      })}
    </div>
  )
}

