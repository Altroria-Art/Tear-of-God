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

export function ArrowLeftIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

export function EyeIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
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

export function ExportIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5-5 5 5" />
      <path d="M12 15V5" />
    </Svg>
  )
}

export function StarIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.57l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5Z" />
    </svg>
  )
}

export function CheckCircleIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Svg>
  )
}

export function AlertTriangleIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
    </Svg>
  )
}

export function InfoCircleIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.8" r="0.5" fill="currentColor" />
    </Svg>
  )
}

export function CloseIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  )
}
