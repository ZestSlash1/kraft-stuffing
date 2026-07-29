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
  fetchCargoItems,
  fetchShippers,
  fetchConsignees,
  fetchProfiles,
  fetchOrgSettings,
  fetchBookings,
  fetchVesselMovements,
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
  createBooking,
  updateBooking as dbUpdateBooking,
  deleteBooking as dbDeleteBooking,
  createVesselMovement,
  deleteVesselMovement as dbDeleteVesselMovement,
  flushQueue,
  pendingCount,
  fromDbVoyage,
  fromDbContainer,
  fromDbLine,
  fromDbCargoItem,
  toDbCargoItem,
  createCargoItem as dbCreateCargoItem,
  updateCargoItem as dbUpdateCargoItem,
  deleteCargoItem as dbDeleteCargoItem,
  fromDbShipper,
  fromDbConsignee,
  fromDbProfile,
  fromDbBooking,
  fromDbVesselMovement,
  toDbVoyage,
  toDbVoyagePatch,
  toDbContainer,
  toDbLine,
  toDbContainerPatch,
  toDbShipper,
  toDbConsignee,
  toDbBooking,
  toDbBookingPatch,
  toDbVesselMovement,
} from "./lib/db";
import { readStore, writeStore } from "./data/store";
import { mkSeed } from "./seed";
import { appReducer, initialState } from "./data/appReducer";
import { AuthContext } from "./context/AuthContext";
import { RouterContext } from "./context/RouterContext";
import { LiveContext } from "./context/LiveContext";
import { mailApi } from "./lib/mailApi";
import { ToastProvider } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginView from "./views/LoginView";
import SetPasswordView from "./views/SetPasswordView";
import AppSelectorView from "./views/AppSelectorView";
import AppShell from "./components/AppShell";
import { TOKENS } from "./data/statusHelpers";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const todayISODate = () => new Date().toISOString().slice(0, 10);

// ── Discovery dots (Manifest / Expenses) ────────────────────────────────────
// Per-section "last seen" timestamps persisted so a cleared dot stays cleared
// across reloads. A section is "unseen" when a row newer than its lastSeen
// lands from another user.
const lastSeenKey = (section) => `lastSeen:${section}`;
const getLastSeen = (section) => {
  try {
    return localStorage.getItem(lastSeenKey(section)) || "";
  } catch {
    return "";
  }
};
const setLastSeenNow = (section) => {
  try {
    localStorage.setItem(lastSeenKey(section), new Date().toISOString());
  } catch {
    // storage unavailable — dot just won't persist across reload
  }
};

// Never let a hung network call (e.g. a stale/unreachable Supabase project)
// leave the UI stuck on a loading screen forever.
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

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
      const { data: ciRows } = await fetchCargoItems(container.id);
      container.cargoItems = (ciRows || []).map(fromDbCargoItem);
      voyage.containers.push(container);
    }
    const { data: bRows, error: bErr } = await fetchBookings(voyage.id);
    if (bErr) throw bErr;
    voyage.bookings = (bRows || []).map(fromDbBooking);
    const { data: mRows, error: mErr } = await fetchVesselMovements(voyage.id);
    if (mErr) throw mErr;
    voyage.vesselMovements = (mRows || []).map(fromDbVesselMovement);
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

// DEV-only preview bypass: `?demo=1` skips auth and renders the shell with the
// local seed (Supabase load fails → falls back to seed). Stripped from prod builds.
const DEMO =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("demo") === "1";
const DEMO_SESSION = { user: { id: "demo-user", email: "demo@kraft.local" } };

export default function App() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(DEMO ? DEMO_SESSION : null);
  const [checkingAuth, setCheckingAuth] = useState(!DEMO);
  // Set when the user arrives via a reset/invite link — forces the set-password UI.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (DEMO) return;
    withTimeout(supabase.auth.getSession(), 10000, "getSession")
      .then(({ data }) => {
        setSession(data.session ?? null);
      })
      .catch((err) => {
        console.warn("[auth] getSession failed:", err.message);
        setSession(null);
      })
      .finally(() => setCheckingAuth(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (_event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(sess ?? null);
      setCheckingAuth(false);
      if (!sess) {
        sessionStorage.removeItem("kraft_app_selected");
        setAppSelected(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  // ── Routing ─────────────────────────────────────────────────────────────────
  const [route, setRoute] = useState({ page: "dashboard", params: {} });

  // ── Live notification dots ──────────────────────────────────────────────────
  // Sections go "dirty" on a realtime change and clear when you navigate there.
  const [dirty, setDirty] = useState({});
  const routeRef = useRef(route);
  routeRef.current = route;
  const groupOf = (page) =>
    ({
      "voyage-detail": "voyages",
      "container-log": "voyages",
      "igm-voyage": "igm",
      "igm-bl": "igm",
    })[page] || page;

  // Dirty-form guard: forms flag unsaved edits via setDirty(true); navigation
  // then asks for confirmation. Ref (not state) — no re-render needed.
  const formDirtyRef = useRef(false);
  const setFormDirty = useCallback((v) => {
    formDirtyRef.current = !!v;
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (formDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const navigate = useCallback((page, params = {}) => {
    if (formDirtyRef.current) {
      if (!window.confirm("Unsaved changes — leave?")) return;
      formDirtyRef.current = false;
    }
    setRoute({ page, params });
    const g = groupOf(page);
    setDirty((d) => (d[g] ? { ...d, [g]: false } : d));
    // Entering a discovery section marks everything up to now as seen.
    if (g === "manifest" || g === "expenses") setLastSeenNow(g);
  }, []);

  // A stuffing realtime event marks Dashboard + Voyages dirty (unless you're there).
  const onLiveActivity = useCallback(() => {
    const here = groupOf(routeRef.current.page);
    setDirty((d) => ({
      ...d,
      dashboard: here === "dashboard" ? false : true,
      voyages: here === "voyages" ? false : true,
    }));
  }, []);

  // App selector: shown once per session after login, before entering a section.
  const [appSelected, setAppSelected] = useState(
    () => DEMO || sessionStorage.getItem("kraft_app_selected") === "1"
  );
  const selectApp = useCallback(
    (page) => {
      sessionStorage.setItem("kraft_app_selected", "1");
      setAppSelected(true);
      navigate(page);
    },
    [navigate]
  );

  // Return to the launcher from anywhere in the shell.
  const goPortal = useCallback(() => {
    sessionStorage.removeItem("kraft_app_selected");
    setAppSelected(false);
  }, []);

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
      try {
        await withTimeout(
          (async () => {
            await ensureProfile(user);
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
          })(),
          15000,
          "remote data load"
        );
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
    activeVoyage?.containers.map((c) => c.id) || [],
    onLiveActivity
  );

  // ── Mail unread badge: poll the inbox while signed in (0 if no mailbox) ──────
  const [mailUnread, setMailUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const poll = () =>
      mailApi
        .list("INBOX")
        .then((r) => alive && setMailUnread((r.messages || []).filter((m) => !m.seen).length))
        .catch(() => alive && setMailUnread(0));
    poll();
    const id = setInterval(() => document.visibilityState === "visible" && poll(), 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);

  // ── Mail follow-ups badge: due reminders/snoozes, same polling cadence as unread ──
  const [mailFollowups, setMailFollowups] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const poll = () =>
      mailApi
        .dueReminders()
        .then((r) => alive && setMailFollowups((r.reminders || []).length))
        .catch(() => alive && setMailFollowups(0));
    poll();
    const id = setInterval(() => document.visibilityState === "visible" && poll(), 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);

  // ── Discovery dots: Manifest (bookings + vessel_movements) + Expenses ────────
  // A separate realtime channel purely for nav notification dots. Self-writes
  // are suppressed by comparing the row actor to the signed-in user.
  useEffect(() => {
    if (!user) return;
    // First-ever visit: treat existing data as seen so we don't light up history.
    ["manifest", "expenses"].forEach((s) => {
      if (!getLastSeen(s)) setLastSeenNow(s);
    });

    const mark = (section, row) => {
      if (!row) return; // DELETE payloads carry no new row — ignore
      const actor = row.created_by || row.logged_by || row.user_id || null;
      if (actor && actor === user.id) return; // suppress own writes
      const ts = row.updated_at || row.created_at || null;
      const seen = getLastSeen(section);
      if (ts && seen && ts <= seen) return; // already accounted for
      if (groupOf(routeRef.current.page) === section) {
        setLastSeenNow(section); // we're looking at it — stay clear
        return;
      }
      setDirty((d) => (d[section] ? d : { ...d, [section]: true }));
    };

    const channel = supabase.channel("discovery");
    for (const [table, section] of [
      ["bookings", "manifest"],
      ["vessel_movements", "manifest"],
      ["expenses", "expenses"],
    ]) {
      for (const event of ["INSERT", "UPDATE"]) {
        channel.on(
          "postgres_changes",
          { event, schema: "public", table },
          (payload) => mark(section, payload.new)
        );
      }
    }
    channel.subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  // Opening Mail clears its dot; track unread separately so the badge reflects IMAP.
  const live = { dirty, online: Object.keys(presence).length, mailUnread, mailFollowups };

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

  const addCargoItem = (containerId, draft) => {
    const voyageId = voyageIdForContainer(containerId);
    const container = state.voyages
      .flatMap((v) => v.containers)
      .find((c) => c.id === containerId);
    const nextSort = (container?.cargoItems?.length ?? 0);
    const item = {
      id: uid(),
      containerId,
      sortOrder: nextSort,
      backfilled: false,
      ...draft,
    };
    dispatch({ type: "ADD_CARGO_ITEM", voyageId, containerId, item });
    sync(() => dbCreateCargoItem(toDbCargoItem(item)));
  };

  const updateCargoItem = (containerId, itemId, patch) => {
    const voyageId = voyageIdForContainer(containerId);
    dispatch({ type: "UPDATE_CARGO_ITEM", voyageId, containerId, itemId, patch });
    sync(() => dbUpdateCargoItem(itemId, patch));
  };

  const removeCargoItem = (containerId, itemId) => {
    const voyageId = voyageIdForContainer(containerId);
    dispatch({ type: "DELETE_CARGO_ITEM", voyageId, containerId, itemId });
    sync(() => dbDeleteCargoItem(itemId));
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
      .then(({ error }) => {
        if (error) return console.warn("[notify-seal] failed:", error.message);
        // Flush the freshly-queued email deliveries now (daily cron is only a net).
        mailApi.flushNotifications().catch(() => {});
      });
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

  // ── Bookings (manifest) ─────────────────────────────────────────────────────
  const createBookingEntry = async (voyageId, draft) => {
    const { data, error } = await createBooking(
      toDbBooking({ orgId: KRAFT_ORG_ID, voyageId, createdBy: user?.id, ...draft })
    );
    if (error || !data) return null;
    const booking = fromDbBooking(data);
    dispatch({ type: "ADD_BOOKING", voyageId, booking });
    return booking;
  };

  const updateBookingEntry = (voyageId, bookingId, patch) => {
    dispatch({ type: "UPDATE_BOOKING", voyageId, bookingId, patch });
    sync(() => dbUpdateBooking(bookingId, toDbBookingPatch(patch)));
  };

  const removeBookingEntry = (voyageId, bookingId) => {
    dispatch({ type: "REMOVE_BOOKING", voyageId, bookingId });
    sync(() => dbDeleteBooking(bookingId));
  };

  // ── Vessel movements (manifest) ─────────────────────────────────────────────
  const createMovementEntry = async (voyageId, draft) => {
    const { data, error } = await createVesselMovement(
      toDbVesselMovement({ orgId: KRAFT_ORG_ID, voyageId, loggedBy: user?.id, ...draft })
    );
    if (error || !data) return null;
    const movement = fromDbVesselMovement(data);
    dispatch({ type: "ADD_VESSEL_MOVEMENT", voyageId, movement });
    // Fire voyage departure/arrival notifications off the honest movement signal.
    // Non-blocking: a notify failure never affects the logged movement.
    const notifyType =
      movement.eventType === "sailed"
        ? "voyage_departed"
        : movement.eventType === "discharged"
        ? "voyage_arrived"
        : null;
    if (notifyType) {
      supabase.functions
        .invoke("notify-voyage", { body: { voyageId, eventType: notifyType } })
        .then(({ error: nErr }) => {
          if (nErr) return console.warn("[notify-voyage] failed:", nErr.message);
          mailApi.flushNotifications().catch(() => {});
        });
    }
    return movement;
  };

  const removeMovementEntry = (voyageId, movementId) => {
    dispatch({ type: "REMOVE_VESSEL_MOVEMENT", voyageId, movementId });
    sync(() => dbDeleteVesselMovement(movementId));
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
    createBookingEntry,
    updateBookingEntry,
    removeBookingEntry,
    createMovementEntry,
    removeMovementEntry,
    addCargoItem,
    updateCargoItem,
    removeCargoItem,
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

  if (recovery)
    return (
      <ErrorBoundary>
        <SetPasswordView onDone={() => setRecovery(false)} />
      </ErrorBoundary>
    );

  if (!session) return <ErrorBoundary><LoginView /></ErrorBoundary>;

  if (!appSelected)
    return (
      <ErrorBoundary>
        <AppSelectorView onSelect={selectApp} user={user} profile={profile} />
      </ErrorBoundary>
    );

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, session, profile }}>
        <RouterContext.Provider value={{ route, navigate, goPortal, setDirty: setFormDirty }}>
          <LiveContext.Provider value={live}>
            <ToastProvider>
              <AppShell app={app} />
            </ToastProvider>
          </LiveContext.Provider>
        </RouterContext.Provider>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
