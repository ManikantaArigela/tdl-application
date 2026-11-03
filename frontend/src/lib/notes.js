/**
 * Tag-aware note search and filtering.
 *
 * Tags are compared case-insensitively and trimmed, so "Product", "product",
 * and " product " all behave like the same tag. Search still matches titles and
 * content, and now also matches any tag. When several tag chips are selected a
 * note matches if it has ANY of them (OR), which is the least surprising
 * behavior for a quick filter bar.
 */

export function normalizeTag(tag) {
  return String(tag ?? '').trim().toLowerCase();
}

export function noteTags(note) {
  return (Array.isArray(note?.tags) ? note.tags : []).map(normalizeTag).filter(Boolean);
}

export function noteMatchesQuery(note, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;

  if ((note?.title ?? '').toLowerCase().includes(q)) return true;
  if ((note?.content ?? '').toLowerCase().includes(q)) return true;

  // Let people type "#product" or "product" and still find the tag.
  const tagQuery = q.startsWith('#') ? q.replace(/^#+/, '') : q;
  if (!tagQuery) return false;
  return noteTags(note).some((tag) => tag.includes(tagQuery));
}

export function noteMatchesTags(note, selectedTags = []) {
  if (!selectedTags.length) return true;
  const tags = new Set(noteTags(note));
  return selectedTags.some((tag) => tags.has(normalizeTag(tag)));
}

export function noteMatchesFilters(note, { query = '', tags = [] } = {}) {
  return noteMatchesQuery(note, query) && noteMatchesTags(note, tags);
}

/** Unique tags with counts, most-used first, for the filter chips. */
export function collectTags(notes = []) {
  const byTag = new Map();

  notes.forEach((note) => {
    const seen = new Set();
    (Array.isArray(note?.tags) ? note.tags : []).forEach((raw) => {
      const tag = normalizeTag(raw);
      if (!tag || seen.has(tag)) return;
      seen.add(tag);

      const existing = byTag.get(tag);
      if (existing) {
        existing.count += 1;
      } else {
        // Keep the first spelling the user wrote for display.
        byTag.set(tag, { tag, label: String(raw).trim(), count: 1 });
      }
    });
  });

  return [...byTag.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}
