import { Link } from 'react-router-dom'

export default function ActionButton({ icon: Icon, count, label, onClick, pressed, activeClass, to }) {
  const className = `flex items-center gap-1.5 transition-colors ${
    pressed ? `${activeClass} font-semibold` : 'text-action hover:text-ink-soft'
  }`

  const content = (
    <>
      <Icon className="h-[18px] w-[18px]" />
      {count != null && <span className="text-sm">{count}</span>}
    </>
  )

  if (to) {
    return (
      <Link to={to} aria-label={label} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  )
}
