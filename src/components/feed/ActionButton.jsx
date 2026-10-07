import { Link } from 'react-router-dom'

export default function ActionButton({ icon: Icon, count, label, onClick, pressed, activeClass, className: customClassName, to, showLabel = false }) {
  const hoverClass = (activeClass && activeClass.includes('hover:')) ? activeClass : 'hover:text-ink-soft'
  const className = customClassName || `flex items-center gap-1.5 transition-colors ${
    pressed ? `${activeClass} font-semibold` : `text-action ${hoverClass}`
  }`

  const content = (
    <>
      <Icon className="h-[18px] w-[18px]" />
      {count != null && <span className="reaction-count text-sm">{count}</span>}
      {showLabel && <span className="text-xs font-semibold">{label}</span>}
    </>
  )

  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={`reaction-control ${className}`}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`reaction-control ${className}`}
    >
      {content}
    </button>
  )
}



