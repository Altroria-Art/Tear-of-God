// Keep the seed's relative order while exhausting unseen candidates first.
// When any unseen posts remain, return ONLY those — a refresh must not pad a
// page with already-seen posts (that shows old cards again and makes a short
// pool look "fresh").
//
// `fallback` controls what happens when EVERYTHING is already seen:
//   - true  (default): return the full ordered list. Keeps a small interest
//     pool (For You / Following / non-personalized) from ever rendering as an
//     empty feed — the historical behavior.
//   - false (strict):  return [] instead. When the caller explicitly asks to
//     hide already-seen posts (Trending + exclude), a fully-seen pool must not
//     silently recycle old cards again — the feed should show "you're all
//     caught up" until genuinely-new posts appear.
export function prioritizeUnseen(ids, seenIds, { fallback = true } = {}) {
  if (!seenIds?.size) return ids;
  const unseen = ids.filter((id) => !seenIds.has(id));
  if (unseen.length > 0) return unseen;
  return fallback ? ids : [];
}
