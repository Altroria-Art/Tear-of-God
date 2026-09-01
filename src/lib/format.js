// Shared display formatters — was previously copy-pasted into
// TemplateCard.jsx / Discover.jsx (formatCount) and stuck unexported inside
// HomeFeed.jsx (timeAgo, capped at "days ago").

export function formatCount(n) {
  const num = n || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return `${num}`;
}

// D1/SQLite's CURRENT_TIMESTAMP stores UTC as 'YYYY-MM-DD HH:MM:SS' — a space
// separator and NO timezone marker. That is NOT the ECMAScript Date Time String
// Format, so `new Date(s)` falls back to implementation-defined parsing and V8
// reads it as LOCAL time. On a UTC+7 machine that renders every brand-new row as
// "7 hours ago"; on UTC-5 it renders as a negative, nonsensical offset instead.
// See docs/tier-list-feed-timestamp-fix-plan.md for the full investigation.
//
// The regex is $-anchored so it matches ONLY the zone-less form — a value that
// already carries `Z` or an offset (e.g. '+07:00') falls through to the native
// parser untouched and is never double-converted. Replacing the space with 'T'
// alone would NOT fix this — a date-time string with no zone designator is still
// parsed as local time either way. Appending 'Z' is what anchors it to UTC.
const SQLITE_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/;

/**
 * Parse a timestamp coming from the API/D1 into a Date holding the correct instant.
 * @returns {Date|null} null for missing OR unparseable input, so callers need
 *                      exactly one check (`if (!d)`) instead of two.
 */
export function parseDbDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const m = SQLITE_DATETIME.exec(raw);
  const date = new Date(m ? `${m[1]}T${m[2]}Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar-date-only rendering of a D1 timestamp. Returns null when unrenderable. */
export function formatDbDate(value, locale, options) {
  const d = parseDbDate(value);
  return d ? d.toLocaleDateString(locale, options) : null;
}

function ago(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

export function timeAgo(dateString) {
  const date = parseDbDate(dateString);
  if (!date) return 'Just now';

  const dateFormatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  // Clamp negatives: a client clock a few minutes fast (or a stray future-dated
  // row) previously rendered literal "-300 seconds ago" because `seconds < 60`
  // was also true for negative numbers.
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  let relative = '';
  if (seconds < 45) relative = 'just now';
  else if (seconds < 60) relative = ago(seconds, 'second');
  else {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) relative = ago(minutes, 'minute');
    else {
      const hours = Math.round(minutes / 60);
      if (hours < 24) relative = ago(hours, 'hour');
      else {
        const days = Math.round(hours / 24);
        if (days < 7) relative = ago(days, 'day');
        else {
          const weeks = Math.round(days / 7);
          if (weeks < 5) relative = ago(weeks, 'week');
          else {
            const months = Math.round(days / 30);
            if (months < 12) relative = ago(months, 'month');
            else relative = ago(Math.round(days / 365), 'year');
          }
        }
      }
    }
  }

  return `${dateFormatted} • ${relative}`;
}
