// App state lives as a nested tree (voyage → containers → lines) so the existing
// views keep working unchanged. The reducer is pure & synchronous: it updates the
// UI instantly. The async Supabase sync happens alongside dispatch in App.jsx.

export const initialState = {
  loading: true,
  voyages: [],
  activeVoyageId: null,
  shippers: [],
  consignees: [],
};

// Map over the containers of one voyage.
const mapContainers = (state, voyageId, fn) => ({
  ...state,
  voyages: state.voyages.map((v) =>
    v.id !== voyageId ? v : { ...v, containers: fn(v.containers || []) }
  ),
});

export function appReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "SET_VOYAGES":
      return {
        ...state,
        voyages: action.voyages,
        activeVoyageId:
          action.activeVoyageId ??
          state.activeVoyageId ??
          action.voyages[0]?.id ??
          null,
      };

    case "SET_ACTIVE_VOYAGE":
      return { ...state, activeVoyageId: action.voyageId };

    case "SET_CONTAINERS":
      return mapContainers(state, action.voyageId, () => action.containers);

    case "ADD_CONTAINER":
      return mapContainers(state, action.voyageId, (cs) => [
        ...cs,
        { lines: [], ...action.container },
      ]);

    case "UPDATE_CONTAINER":
      return mapContainers(state, action.voyageId, (cs) =>
        cs.map((c) =>
          c.id === action.containerId ? { ...c, ...action.patch } : c
        )
      );

    case "SET_LINES":
      return mapContainers(state, action.voyageId, (cs) =>
        cs.map((c) =>
          c.id === action.containerId ? { ...c, lines: action.lines } : c
        )
      );

    case "ADD_LINE":
      return mapContainers(state, action.voyageId, (cs) =>
        cs.map((c) =>
          c.id === action.containerId
            ? { ...c, lines: [...(c.lines || []), action.line] }
            : c
        )
      );

    case "DELETE_LINE":
      return mapContainers(state, action.voyageId, (cs) =>
        cs.map((c) =>
          c.id === action.containerId
            ? { ...c, lines: c.lines.filter((l) => l.id !== action.lineId) }
            : c
        )
      );

    case "SET_SHIPPERS":
      return { ...state, shippers: action.shippers };

    case "SET_CONSIGNEES":
      return { ...state, consignees: action.consignees };

    default:
      return state;
  }
}
