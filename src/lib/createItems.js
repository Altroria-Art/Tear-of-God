// Match the publish API's exact, trimmed identity. Prefixes, spelling,
// accents and word order must never be used to decide whether names repeat.
export function findDuplicateNames(names) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of names) {
    const name = value.trim();
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates];
}

export function prepareCreateItems(text, existingItems) {
  const seen = new Set(existingItems.map(item => item.content.trim()));
  const duplicates = new Set();
  const items = [];
  for (const name of text.split(/[,\n]+/).map(value => value.trim()).filter(Boolean)) {
    if (seen.has(name)) {
      duplicates.add(name);
      continue;
    }
    seen.add(name);
    items.push({ id: crypto.randomUUID(), content: name, tierId: null });
  }
  return { items, duplicates: [...duplicates] };
}

// Repair is an explicit editor action: keep the first card and its tier/order.
// Never discard cards from an existing draft just by opening the page.
export function removeDuplicateCreateItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const name = item.content.trim();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}
