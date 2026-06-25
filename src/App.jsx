import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { exportVoyageXlsx } from "./lib/exportXlsx";
import { generatePackingList } from "./lib/exportPdf";
import { useVoyageRealtime } from "./lib/realtime";
import {
  KRAFT_ORG_ID,
  ensureProfile,
  fetchVoyages,
  fetchContainers,
  fetchLines,
  fetchShippers,
  fetchConsignees,
  fetchProfiles,
  fetchOrgSettings,
  createVoyage,
  updateVoyage as dbUpdateVoyage,
  archiveVoyage as dbArchiveVoyage,
  createContainer,
  createLine,
  deleteLine as dbDeleteLine,
  updateContainer as dbUpdateContainer,
  upsertShipper,
  upsertConsignee,
  deleteShipper as dbDeleteShipper,
  deleteConsignee as dbDeleteConsignee,
  flushQueue,
  pendingCount,
  fromDbVoyage,
  fromDbContainer,
  fromDbLine,
  fromDbShipper,
  fromDbConsignee,
  fromDbProfile,
  toDbVoyage,
  toDbVoyagePatch,
  toDbContainer,
  toDbLine,
  toDbContainerPatch,
  toDbShipper,
  toDbConsignee,
} from "./lib/db";
import { readStore, writeStore } from "./data/store";
import { mkSeed } from "./seed";
import { appReducer, initialState } from "./data/appReducer";
import { AuthContext } from "./context/AuthContext";
import { RouterContext } from "./context/RouterContext";
import { ToastProvider } from "./components/Toast";
import LoginView from "./views/LoginView";
import AppShell from "./components/AppShell";
import { TOKENS } from "./data/statusHelpers";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const todayISODate = () => new Date().toISOString().slice(0, 10);

// Pull the whole voyage tree out of Supabase and shape it for the UI.
async function loadVoyageTree(orgId) {
  const { data: vRows, error } = await fetchVoyages(orgId);
  if (error) throw error;
  const voyages = [];
  for (const vRow of vRows || []) {
    const voyage = fromDbVoyage(vRow);
    const { data: cRows, error: cErr } = await fetchContainers(voyage.id);
    if (cErr) throw cErr;
    voyage.containers = [];
    for (const cRow of cRows || []) {
      const container = fromDbContainer(cRow);
      const { data: lRows, error: lErr } = await fetchLines(container.id);
      if (lErr) throw lErr;
      container.lines = (lRows || []).map(fromDbLine);
      voyage.containers.push(container);
    }
    voyages.push(voyage);
  }
  return voyages;
}

// Fresh project seed (idempotent in practice — only when remote has zero voyages).
async function bootstrapSeed(userId) {
  const seed = mkSeed();
  const v = seed.voyages[0];
  const voyageId = uid();
  await createVoyage(
    toDbVoyage({
      id: voyageId,
      orgId: KRAFT_ORG_ID,
      createdBy: userId,
      vessel: v.vessel,
      voyageNo: v.voyageNo,
      date: v.date,
      status: "LOADING",
    })
  );
  for (const [i, c] of v.containers.entries()) {
    const containerId = uid();
    await createContainer(
      toDbContainer({
        id: containerId,
        voyageId,
        number: c.number,
        size: c.size,
        capacityBags: c.capacityBags,
        sealNo: c.sealNo,
        sealed: c.sealed,
        sortOrder: i,
      })
    );
    for (const [j, l] of c.lines.entries()) {
      await createLine(
        toDbLine({
          id: uid(),
          containerId,
          cargo: l.cargo,
          qty: l.qty,
          unit: "Bags",
          unitWeightKg: l.unitWeightKg,
          shipper: l.shipper,
          consignee: l.consignee,
          truckNo: l.truckNo,
          loggedBy: userId,
          sortOrder: j,
        })
      );
    }
  }
}

export default function App() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setCheckingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
      setCheckingAuth(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  // ── Routing ─────────────────────────────────────────────────────────────────
  const [route, setRoute] = useState({ page: "dashboard", params: {} });
  const navigate = useCallback((page, params = {}) => setRoute({ page, params }), []);

  // ── App data ────────────────────────────────────────────────────────────────
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [orgSettings, setOrgSettings] = useState(null);
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState(null);
  const loadedForUser = useRef(null);

  const sync = useCallback((thunk) => {
    Promise.resolve(thunk()).then((res) => {
      if (res?.error) {
        console.warn("[sync] write failed:", res.error.message);
        setSyncError({ thunk });
      } else {
        setSyncError(null);
      }
    });
    setPending(pendingCount());
  }, []);

  // Load everything once we have an authenticated user.
  useEffect(() => {
    if (!user) return;
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      await ensureProfile(user);
      try {
        let voyages = await loadVoyageTree(KRAFT_ORG_ID);
        if (!voyages.length) {
          await bootstrapSeed(user.id);
          voyages = await loadVoyageTree(KRAFT_ORG_ID);
        }
        if (!voyages.length) throw new Error("no remote voyages");
        dispatch({ type: "SET_VOYAGES", voyages });

        const { data: shippers } = await fetchShippers(KRAFT_ORG_ID);
        const { data: consignees } = await fetchConsignees(KRAFT_ORG_ID);
        const { data: profiles } = await fetchProfiles(KRAFT_ORG_ID);
        dispatch({ type: "SET_SHIPPERS", shippers: (shippers || []).map(fromDbShipper) });
        dispatch({ type: "SET_CONSIGNEES", consignees: (consignees || []).map(fromDbConsignee) });
        dispatch({ type: "SET_PROFILES", profiles: (profiles || []).map(fromDbProfile) });
      } catch (err) {
        console.warn("[load] falling back to local store:", err.message);
        const local = readStore() || mkSeed();
        dispatch({ type: "SET_VOYAGES", voyages: local.voyages, activeVoyageId: local.activeVoyageId });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
      setOrgSettings(await fetchOrgSettings());
    })();
  }, [user]);

  // Mirror state to localStorage for offline reloads.
  useEffect(() => {
    if (state.loading) return;
    writeStore({ activeVoyageId: state.activeVoyageId, voyages: state.voyages });
  }, [state.voyages, state.activeVoyageId, state.loading]);

  // Online/offline: flush the write queue on reconnect.
  useEffect(() => {
    const goOnline = async () => {
      const { remaining } = await flushQueue();
      setPending(remaining ?? pendingCount());
    };
    window.addEventListener("online", goOnline);
    return () => window.removeEventListener("online", goOnline);
  }, []);

  const activeVoyage = state.voyages.find((v) => v.id === state.activeVoyageId);

  // ── Realtime: one channel per active voyage ─────────────────────────────────
  const { presence, track: trackPresence } = useVoyageRealtime(
    state.activeVoyageId,
    dispatch,
    activeVoyage?.containers.map((c) => c.id) || []
  );

  // Resolve which voyage a container belongs to (handlers don't rely on active).
  const voyageIdForContainer = (cid) =>
    state.voyages.find((v) => v.containers.some((c) => c.id === cid))?.id;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const patchContainer = (containerId, patch) => {
    const voyageId = voyageIdForContainer(containerId);
    dispatch({ type: "UPDATE_CONTAINER", voyageId, containerId, patch });
    sync(() => dbUpdateContainer(containerId, toDbContainerPatch(patch)));
  };

  const addLine = (containerId, line) => {
    const voyageId = voyageIdForContainer(containerId);
    const newLine = { id: uid(), unit: "Bags", loggedBy: user?.id, ...line, containerId };
    dispatch({ type: "ADD_LINE", voyageId, containerId, line: newLine });
    sync(() => createLine(toDbLine(newLine)));
  };

  const deleteLine = (containerId, lineId) => {
    const voyageId = voyageIdForContainer(containerId);
    dispatch({ type: "DELETE_LINE", voyageId, containerId, lineId });
    sync(() => dbDeleteLine(lineId));
  };

  const sealContainer = (containerId, { sealNo, sealNo2 }) => {
    patchContainer(containerId, {
      sealed: true,
      sealNo,
      sealNo2,
      sealedAt: new Date().toISOString(),
      sealedBy: user?.id,
    });
    supabase.functions
      .invoke("notify-seal", { body: { containerId } })
      .then(({ error }) => error && console.warn("[notify-seal] failed:", error.message));
  };

  const addContainerEntry = (voyageId) => {
    const voyage = state.voyages.find((v) => v.id === voyageId);
    const container = {
      id: uid(),
      voyageId,
      number: "",
      size: "20",
      capacityBags: 340,
      capacityUnit: "Bags",
      sealed: false,
      tareWeightKg: Number(orgSettings?.tare_20) || 2200,
      cmlKg: Number(orgSettings?.cml_20) || 28000,
      sortOrder: voyage?.containers.length || 0,
      lines: [],
    };
    dispatch({ type: "ADD_CONTAINER", voyageId, container });
    sync(() => createContainer(toDbContainer(container)));
    return container;
  };

  const createVoyageEntry = (draft) => {
    const voyage = {
      id: uid(),
      orgId: KRAFT_ORG_ID,
      createdBy: user?.id,
      status: "DRAFT",
      archived: false,
      pol: orgSettings?.default_pol || "Kolkata",
      pod: orgSettings?.default_pod || "Port Blair",
      ...draft,
      containers: [],
    };
    dispatch({ type: "ADD_VOYAGE", voyage });
    dispatch({ type: "SET_ACTIVE_VOYAGE", voyageId: voyage.id });
    sync(() => createVoyage(toDbVoyage(voyage)));
    return voyage;
  };

  const updateVoyageEntry = (voyageId, patch) => {
    dispatch({ type: "UPDATE_VOYAGE", voyageId, patch });
    sync(() => dbUpdateVoyage(voyageId, toDbVoyagePatch(patch)));
  };

  const archiveVoyageEntry = (voyageId) => {
    dispatch({ type: "UPDATE_VOYAGE", voyageId, patch: { archived: true, status: "ARCHIVED" } });
    sync(() => dbArchiveVoyage(voyageId));
  };

  const duplicateVoyage = (voyageId) => {
    const src = state.voyages.find((v) => v.id === voyageId);
    if (!src) return null;
    return createVoyageEntry({
      vessel: src.vessel,
      voyageNo: `${src.voyageNo || "VOY"}-COPY`,
      date: todayISODate(),
      pol: src.pol,
      pod: src.pod,
      chaName: src.chaName,
      shippingLine: src.shippingLine,
    });
  };

  const setActiveVoyage = (id) => dispatch({ type: "SET_ACTIVE_VOYAGE", voyageId: id });

  // ── Master data ─────────────────────────────────────────────────────────────
  const createShipperEntry = async (draft) => {
    const { data, error } = await upsertShipper(toDbShipper({ orgId: KRAFT_ORG_ID, ...draft }));
    if (error || !data) return null;
    const shipper = fromDbShipper(data);
    const exists = state.shippers.some((s) => s.id === shipper.id);
    dispatch({
      type: "SET_SHIPPERS",
      shippers: exists
        ? state.shippers.map((s) => (s.id === shipper.id ? shipper : s))
        : [...state.shippers, shipper],
    });
    return shipper;
  };

  const createConsigneeEntry = async (draft) => {
    const { data, error } = await upsertConsignee(toDbConsignee({ orgId: KRAFT_ORG_ID, ...draft }));
    if (error || !data) return null;
    const consignee = fromDbConsignee(data);
    const exists = state.consignees.some((c) => c.id === consignee.id);
    dispatch({
      type: "SET_CONSIGNEES",
      consignees: exists
        ? state.consignees.map((c) => (c.id === consignee.id ? consignee : c))
        : [...state.consignees, consignee],
    });
    return consignee;
  };

  const removeShipper = (id) => {
    dispatch({ type: "SET_SHIPPERS", shippers: state.shippers.filter((s) => s.id !== id) });
    sync(() => dbDeleteShipper(id));
  };
  const removeConsignee = (id) => {
    dispatch({ type: "SET_CONSIGNEES", consignees: state.consignees.filter((c) => c.id !== id) });
    sync(() => dbDeleteConsignee(id));
  };

  // ── Exports ─────────────────────────────────────────────────────────────────
  const profilesById = state.profiles.reduce((acc, p) => {
    acc[p.id] = p.displayName || p.id;
    return acc;
  }, {});

  const exportXlsx = (v) => exportVoyageXlsx(v || activeVoyage, profilesById);
  const exportPdf = (v) => {
    const target = v || activeVoyage;
    return target && generatePackingList(target, target.containers);
  };

  // Current user's profile (for greeting / settings).
  const profile =
    state.profiles.find((p) => p.id === user?.id) ||
    (user ? { id: user.id, displayName: (user.email || "").split("@")[0], role: "staff" } : null);

  const app = {
    state,
    dispatch,
    user,
    profile,
    profilesById,
    presence,
    trackPresence,
    orgSettings,
    setOrgSettings,
    pending,
    syncError,
    navigate,
    setActiveVoyage,
    patchContainer,
    addLine,
    deleteLine,
    sealContainer,
    addContainerEntry,
    createVoyageEntry,
    updateVoyageEntry,
    archiveVoyageEntry,
    duplicateVoyage,
    createShipperEntry,
    createConsigneeEntry,
    removeShipper,
    removeConsignee,
    exportXlsx,
    exportPdf,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: TOKENS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: TOKENS.mono,
          fontSize: 11,
          color: TOKENS.steel,
          letterSpacing: "0.2em",
        }}
      >
        LOADING…
      </div>
    );
  }

  if (!session) return <LoginView />;

  return (
    <AuthContext.Provider value={{ user, session, profile }}>
      <RouterContext.Provider value={{ route, navigate }}>
        <ToastProvider>
          <AppShell app={app} />
        </ToastProvider>
      </RouterContext.Provider>
    </AuthContext.Provider>
  );
}
