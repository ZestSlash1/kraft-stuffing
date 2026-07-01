// Last-visited entities for the ⌘K palette empty state. Recorded on
// entity-page visits; newest first, deduped by type+id, capped at 5.

const KEY = "kraft-recent-entities-v1";
const MAX = 5;

export function recordEntityVisit({ type, id, label }) {
  if (!id) return;
  try {
    const list = (JSON.parse(localStorage.getItem(KEY)) || []).filter(
      (e) => !(e.type === type && e.id === id)
    );
    list.unshift({ type, id, label, ts: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // storage unavailable — recents are best-effort
  }
}

export function readRecentEntities() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
