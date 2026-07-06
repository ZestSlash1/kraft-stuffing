// Shared formatter for container cargo items.
// Used everywhere cargo needs to display as text: manifest table, PDF, XLSX,
// carting order previews — one place so the join logic isn't duplicated.

export function formatCargoItems(items = []) {
  if (!items || items.length === 0) return "—";
  return items
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item) => {
      const qty = item.qty != null ? item.qty : "?";
      return `${qty} ${item.unit} ${item.description}`.trim();
    })
    .join(", ");
}

// Keys for cargo description autocomplete — persisted per org in localStorage.
const CARGO_DESC_KEY = "kraft-cargo-descriptions-v1";
const MAX_SUGGESTIONS = 30;

export function recordCargoDescription(description) {
  if (!description?.trim()) return;
  try {
    const list = JSON.parse(localStorage.getItem(CARGO_DESC_KEY)) || [];
    const filtered = list.filter((d) => d !== description.trim());
    filtered.unshift(description.trim());
    localStorage.setItem(CARGO_DESC_KEY, JSON.stringify(filtered.slice(0, MAX_SUGGESTIONS)));
  } catch {
    // storage unavailable
  }
}

export function readCargoDescriptionSuggestions() {
  try {
    return JSON.parse(localStorage.getItem(CARGO_DESC_KEY)) || [];
  } catch {
    return [];
  }
}
