// Keep the seed's relative order while exhausting unseen candidates first.
// When any unseen posts remain, return ONLY those — a refresh must not pad a
// page with already-seen posts (that shows old cards again and makes a short
// pool look "fresh"). Fall back to the full list only when nothing is unseen,
// so a small interest pool never renders as an empty feed.
export function prioritizeUnseen(ids, seenIds) {
  if (!seenIds?.size) return ids;
  const unseen = ids.filter((id) => !seenIds.has(id));
  return unseen.length > 0 ? unseen : ids;
}
