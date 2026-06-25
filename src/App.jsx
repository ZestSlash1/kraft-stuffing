import { useEffect, useReducer, useRef, useState } from "react";
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
  createVoyage,
  createContainer,
  createLine,
  deleteLine as dbDeleteLine,
  updateContainer as dbUpdateContainer,
  upsertShipper,
  upsertConsignee,
  flushQueue,
  pendingCount,
  fromDbVoyage,
  fromDbContainer,
  fromDbLine,
  fromDbShipper,
  fromDbConsignee,
  fromDbProfile,
  toDbVoyage,
  toDbContainer,
  toDbLine,
  toDbContainerPatch,
  toDbShipper,
  toDbConsignee,
} from "./lib/db";
import { readStore, writeStore } from "./data/store";
import { mkSeed } from "./seed";
import { appReducer, initialState } from "./data/appReducer";
// AuthView (email OTP) is disabled for now — re-enable by restoring the
// checkingAuth/session gate below. Kept around so it's a one-line revert.
// import AuthView from "./views/AuthView";
import VoyageView from "./views/VoyageView";
import LogView from "./views/LogView";
import OfflineBanner from "./components/OfflineBanner";
import SyncErrorBanner from "./components/SyncErrorBanner";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

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

// First run on a fresh Supabase project: seed one voyage (with containers and
// lines) so the app is immediately usable and backed by real, persisting rows.
// Idempotent in practice — only called when the remote has zero voyages.
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

// OTP login is disabled for now (see App() below) — every device gets a
// stable local identity so loggedBy/sealedBy/presence keep working without a
// real Supabase auth session. Swap back to session.user once OTP returns.
const LOCAL_USER_ID_KEY = "kraft-local-user-id";
function getLocalUser() {
  let id = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = uid();
    localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return { id, email: "dock-staff" };
}

export default function App() {
  // ── Auth (OTP disabled for now — see import comment above) ─────────────────
  const [localUser] = useState(getLocalUser);
  const session = { user: localUser };

  // ── App data ────────────────────────────────────────────────────────────────
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [openLogContainerId, setOpenLogContainerId] = useState(null);

  // ── Connectivity ──────────────────────────────────────────────────────────
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [pending, setPending] = useState(0);
  const loadedForUser = useRef(null);
  const [syncError, setSyncError] = useState(null);

  // Fire-and-forget Supabase sync. The reducer has already updated the UI, so
  // a failure only needs to surface a retry banner — offline failures are
  // already queued inside db.js and don't reach the `error` branch.
  const sync = (thunk) => {
    Promise.resolve(thunk()).then((res) => {
      if (res?.error) {
        console.warn("[sync] write failed:", res.error.message);
        setSyncError({ thunk });
      } else {
        setSyncError(null);
      }
    });
  };

  const retrySync = () => {
    if (syncError?.thunk) sync(syncError.thunk);
  };

  // Load data once we have a user (falls back to local seed if Supabase is
  // unreachable or not yet seeded — keeps the app usable offline).
  useEffect(() => {
    const user = localUser;
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    // Note: no cancellation flag here — `loadedForUser` above already ensures
    // this body runs at most once per user, so React 18 StrictMode's
    // mount→cleanup→remount dev cycle can't race against itself.
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      await ensureProfile(user);
      try {
        let voyages = await loadVoyageTree(KRAFT_ORG_ID);
        // Fresh project: seed Supabase once, then read back the canonical tree.
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
        dispatch({
          type: "SET_CONSIGNEES",
          consignees: (consignees || []).map(fromDbConsignee),
        });
        dispatch({ type: "SET_PROFILES", profiles: (profiles || []).map(fromDbProfile) });
      } catch (err) {
        // Supabase empty/unreachable → use the last local snapshot or the seed.
        console.warn("[load] falling back to local store:", err.message);
        const local = readStore() || mkSeed();
        dispatch({
          type: "SET_VOYAGES",
          voyages: local.voyages,
          activeVoyageId: local.activeVoyageId,
        });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    })();
  }, [localUser]);

  // Mirror state to localStorage so an offline reload has something to show.
  useEffect(() => {
    if (state.loading) return;
    writeStore({ activeVoyageId: state.activeVoyageId, voyages: state.voyages });
  }, [state.voyages, state.activeVoyageId, state.loading]);

  // Online/offline handling: flush the write queue on reconnect.
  useEffect(() => {
    const goOnline = async () => {
      setOffline(false);
      const { remaining } = await flushQueue();
      setPending(remaining ?? pendingCount());
    };
    const goOffline = () => {
      setOffline(true);
      setPending(pendingCount());
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const voyage = state.voyages.find((v) => v.id === state.activeVoyageId);

  // ── Realtime: one channel per active voyage, shared across views ───────────
  const { presence, track: trackPresence } = useVoyageRealtime(
    state.activeVoyageId,
    dispatch,
    voyage?.containers.map((c) => c.id) || []
  );

  // ── Mutations: dispatch (instant UI) + Supabase sync (async) ────────────────
  const patchContainer = (containerId, patch) => {
    dispatch({
      type: "UPDATE_CONTAINER",
      voyageId: state.activeVoyageId,
      containerId,
      patch,
    });
    sync(() => dbUpdateContainer(containerId, toDbContainerPatch(patch)));
    setPending(pendingCount());
  };

  const addLine = (containerId, line) => {
    const newLine = { id: uid(), unit: "Bags", ...line, containerId };
    dispatch({
      type: "ADD_LINE",
      voyageId: state.activeVoyageId,
      containerId,
      line: newLine,
    });
    sync(() => createLine(toDbLine(newLine)));
    setPending(pendingCount());
  };

  const sealContainer = (containerId, { sealNo, sealNo2 }) => {
    patchContainer(containerId, {
      sealed: true,
      sealNo,
      sealNo2,
      sealedAt: new Date().toISOString(),
      sealedBy: session?.user?.id,
    });
    supabase.functions
      .invoke("notify-seal", { body: { containerId } })
      .then(({ error }) => {
        if (error) console.warn("[notify-seal] failed:", error.message);
      });
  };

  const createShipperEntry = async (draft) => {
    const { data, error } = await upsertShipper(
      toDbShipper({ orgId: KRAFT_ORG_ID, ...draft })
    );
    if (error || !data) {
      console.warn("[shipper] create failed:", error?.message);
      return null;
    }
    const shipper = fromDbShipper(data);
    dispatch({ type: "SET_SHIPPERS", shippers: [...state.shippers, shipper] });
    return shipper;
  };

  const createConsigneeEntry = async (draft) => {
    const { data, error } = await upsertConsignee(
      toDbConsignee({ orgId: KRAFT_ORG_ID, ...draft })
    );
    if (error || !data) {
      console.warn("[consignee] create failed:", error?.message);
      return null;
    }
    const consignee = fromDbConsignee(data);
    dispatch({ type: "SET_CONSIGNEES", consignees: [...state.consignees, consignee] });
    return consignee;
  };

  const deleteLine = (containerId, lineId) => {
    dispatch({
      type: "DELETE_LINE",
      voyageId: state.activeVoyageId,
      containerId,
      lineId,
    });
    sync(() => dbDeleteLine(lineId));
    setPending(pendingCount());
  };

  const profilesById = state.profiles.reduce((acc, p) => {
    acc[p.id] = p.displayName || p.id;
    return acc;
  }, {});

  const exportXlsx = () => exportVoyageXlsx(voyage, profilesById);
  const exportPdf = () => voyage && generatePackingList(voyage, voyage.containers);

  // ── Render ──────────────────────────────────────────────────────────────────
  const banner = (
    <>
      {syncError && <SyncErrorBanner onRetry={retrySync} />}
      {offline && <OfflineBanner pending={pending} top={syncError ? 38 : 0} />}
    </>
  );

  if (state.loading) {
    return (
      <>
        {banner}
        <VoyageView
          user={session.user}
          voyages={[]}
          activeVoyageId={null}
          onSelectVoyage={() => {}}
          selectedContainerId={null}
          onSelectContainer={() => {}}
          onOpenLog={() => {}}
          loading
        />
      </>
    );
  }

  const openLogContainer = voyage?.containers.find(
    (c) => c.id === openLogContainerId
  );

  if (openLogContainer) {
    return (
      <>
        {banner}
        <LogView
          container={openLogContainer}
          user={session.user}
          presenceMap={presence}
          trackPresence={trackPresence}
          shippers={state.shippers}
          consignees={state.consignees}
          onCreateShipper={createShipperEntry}
          onCreateConsignee={createConsigneeEntry}
          onBack={() => setOpenLogContainerId(null)}
          onAddLine={(line) => addLine(openLogContainer.id, line)}
          onDeleteLine={(lineId) => deleteLine(openLogContainer.id, lineId)}
          onPatchContainer={(patch) =>
            patchContainer(openLogContainer.id, patch)
          }
          onSeal={(payload) => sealContainer(openLogContainer.id, payload)}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      <VoyageView
        user={session.user}
        voyages={state.voyages}
        activeVoyageId={state.activeVoyageId}
        presenceMap={presence}
        onSelectVoyage={(id) =>
          dispatch({ type: "SET_ACTIVE_VOYAGE", voyageId: id })
        }
        selectedContainerId={selectedContainerId}
        onSelectContainer={setSelectedContainerId}
        onOpenLog={setOpenLogContainerId}
        onExportXlsx={exportXlsx}
        onExportPdf={exportPdf}
        profilesById={profilesById}
      />
    </>
  );
}
