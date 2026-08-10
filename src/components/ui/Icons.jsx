// Hand-rolled inline SVGs so the scaffold stays dependency-free. Every icon
// inherits `currentColor`, so color comes from the parent's text class.

function Svg({ className, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

export function SearchIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </Svg>
  )
}

export function UserIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M12 14c-4.2 0-7.5 2.4-7.5 5.4 0 .9.7 1.6 1.6 1.6h11.8c.9 0 1.6-.7 1.6-1.6 0-3-3.3-5.4-7.5-5.4Z" />
    </svg>
  )
}

export function TemplateIcon({ className }) {
  return (
    <Svg className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
}

export function ThumbsUpIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3m0 10V11m0 10h9.3a2 2 0 0 0 1.96-1.6l1.4-7A2 2 0 0 0 18.7 10H14l.66-3.3A2.5 2.5 0 0 0 12.2 3.2L7 11" />
    </Svg>
  )
}

export function ThumbsDownIcon({ className }) {
  return (
    <Svg className={className}>
      <g transform="rotate(180 12 12)">
        <path d="M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3m0 10V11m0 10h9.3a2 2 0 0 0 1.96-1.6l1.4-7A2 2 0 0 0 18.7 10H14l.66-3.3A2.5 2.5 0 0 0 12.2 3.2L7 11" />
      </g>
    </Svg>
  )
}

export function CommentIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </Svg>
  )
}

export function ShareIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </Svg>
  )
}
