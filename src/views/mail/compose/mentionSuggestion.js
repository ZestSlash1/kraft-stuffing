// @mention dropdown for the body editor. Visual/organizational only for v1 — no
// notification side effect (see PHASE_MAIL_COMPOSE_REDESIGN.md §5). Renders a plain
// DOM popup (no extra dependency like tippy.js) positioned at the suggestion's
// client rect, matching Tiptap's non-React suggestion recipe.
import { C, F, R } from "../../../ui/theme";

function buildList(items, onSelect) {
  const list = document.createElement("div");
  Object.assign(list.style, {
    position: "fixed", zIndex: 10000, background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: `${R.chip}px`, boxShadow: "0 12px 28px -12px rgba(0,0,0,0.6)", padding: "4px",
    maxHeight: "220px", overflowY: "auto", minWidth: "180px",
  });
  let selected = 0;

  const render = () => {
    list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.textContent = "No matches";
      Object.assign(empty.style, { padding: "8px", font: `400 12px ${F.mono}`, color: C.inkFaint });
      list.appendChild(empty);
      return;
    }
    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.textContent = item.full_name || "Unnamed";
      Object.assign(row.style, {
        padding: "7px 10px", borderRadius: `${R.chip - 2}px`, cursor: "pointer",
        font: `500 12px ${F.mono}`, color: C.ink,
        background: i === selected ? "rgba(255,255,255,0.08)" : "transparent",
      });
      row.addEventListener("mousedown", (e) => { e.preventDefault(); onSelect({ id: item.id, label: item.full_name || "Unnamed" }); });
      list.appendChild(row);
    });
  };

  return {
    element: list,
    render,
    setSelected: (i) => { selected = i; render(); },
    getSelected: () => selected,
  };
}

export function createMentionSuggestion(getTeam) {
  return {
    char: "@",
    items: ({ query }) => {
      const team = getTeam() || [];
      const q = query.toLowerCase();
      return team.filter((m) => (m.full_name || "").toLowerCase().includes(q)).slice(0, 8);
    },
    render: () => {
      let popup;
      let currentItems = [];
      let currentCommand;

      const position = (clientRect) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.element.style.left = `${rect.left}px`;
        popup.element.style.top = `${rect.bottom + 6}px`;
      };

      return {
        onStart: (props) => {
          currentItems = props.items;
          currentCommand = props.command;
          popup = buildList(currentItems, (item) => currentCommand(item));
          popup.render();
          document.body.appendChild(popup.element);
          position(props.clientRect);
        },
        onUpdate: (props) => {
          currentItems = props.items;
          currentCommand = props.command;
          if (!popup) return;
          popup.element.innerHTML = "";
          popup = buildList(currentItems, (item) => currentCommand(item));
          document.body.appendChild(popup.element);
          popup.render();
          position(props.clientRect);
        },
        onKeyDown: (props) => {
          if (!popup) return false;
          if (props.event.key === "Escape") { popup.element.remove(); return true; }
          if (props.event.key === "ArrowDown") {
            popup.setSelected((popup.getSelected() + 1) % Math.max(currentItems.length, 1));
            return true;
          }
          if (props.event.key === "ArrowUp") {
            popup.setSelected((popup.getSelected() - 1 + Math.max(currentItems.length, 1)) % Math.max(currentItems.length, 1));
            return true;
          }
          if (props.event.key === "Enter") {
            const item = currentItems[popup.getSelected()];
            if (item) currentCommand({ id: item.id, label: item.full_name || "Unnamed" });
            return true;
          }
          return false;
        },
        onExit: () => { popup?.element.remove(); popup = null; },
      };
    },
  };
}
