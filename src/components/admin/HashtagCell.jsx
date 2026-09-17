// A3: compact hashtag display for admin tables (non-link pills + '—' when empty).
// Stored as CSV ('#a,#b'); never render the raw CSV string.
export default function HashtagCell({ hashtags }) {
  const tags = String(hashtags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length === 0) return <span>—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="rounded-full bg-surface-glass border border-line-soft px-2 py-0.5 text-[11px] font-semibold text-brand whitespace-nowrap"
        >
          {tag.startsWith('#') ? tag : `#${tag}`}
        </span>
      ))}
    </span>
  );
}
