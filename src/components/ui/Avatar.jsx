import { UserIcon } from './Icons'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
}

function initialsFrom(name) {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/**
 * Three variants, in fallback order: photo, initials, generic person glyph.
 */
export default function Avatar({ name, src, initials, size = 'md' }) {
  const sizeClass = SIZES[size] ?? SIZES.md
  const label = initials ?? initialsFrom(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    )
  }

  if (label) {
    return (
      <span
        aria-label={name}
        role="img"
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-avatar font-semibold text-avatar-ink`}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-search text-ink-soft`}
    >
      <UserIcon className="h-1/2 w-1/2" />
    </span>
  )
}
