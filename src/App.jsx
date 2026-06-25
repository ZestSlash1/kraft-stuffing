import { useEffect, useReducer, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";
import { useVoyageRealtime } from "./lib/realtime";
import {
  KRAFT_ORG_ID,
  ensureProfile,
  fetchVoyages,
  fetchContainers,
  fetchLines,
  fetchShippers,
  fetchConsignees,
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
  toDbVoyage,
  toDbContainer,
  toDbLine,
  toDbContainerPatch,
  toDbShipper,
  toDbConsignee,
} from "./lib/db";
import { readStore, writeStore } from "./data/store";
import { mkSeed } from "./seed";
import { containerStatus } from "./data/statusHelpers";
import { appReducer, initialState } from "./data/appReducer";
import AuthView from "./views/AuthView";
import VoyageView from "./views/VoyageView";
import LogView from "./views/LogView";
import OfflineBanner from "./components/OfflineBanner";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

// Fire-and-forget Supabase sync. The reducer has already updated the UI, so we
// only log failures here — offline failures are queued inside db.js.
const sync = (promise) => {
  Promise.resolve(promise).then((res) => {
    if (res?.error) console.warn("[sync] write failed:", res.error.message);
  });
};

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

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  // Existing session check + auth subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data once we have a user (falls back to local seed if Supabase is
  // unreachable or not yet seeded — keeps the app usable offline).
  useEffect(() => {
    const user = session?.user;
    if (!user) {
      loadedForUser.current = null;
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    let cancelled = false;
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      await ensureProfile(user);
      try {
        let voyages = await loadVoyageTree(KRAFT_ORG_ID);
        if (cancelled) return;
        // Fresh project: seed Supabase once, then read back the canonical tree.
        if (!voyages.length) {
          await bootstrapSeed(user.id);
          voyages = await loadVoyageTree(KRAFT_ORG_ID);
        }
        if (cancelled) return;
        if (!voyages.length) throw new Error("no remote voyages");
        dispatch({ type: "SET_VOYAGES", voyages });

        const { data: shippers } = await fetchShippers(KRAFT_ORG_ID);
        const { data: consignees } = await fetchConsignees(KRAFT_ORG_ID);
        if (cancelled) return;
        dispatch({ type: "SET_SHIPPERS", shippers: (shippers || []).map(fromDbShipper) });
        dispatch({
          type: "SET_CONSIGNEES",
          consignees: (consignees || []).map(fromDbConsignee),
        });
      } catch (err) {
        // Supabase empty/unreachable → use the last local snapshot or the seed.
        console.warn("[load] falling back to local store:", err.message);
        const local = readStore() || mkSeed();
        if (cancelled) return;
        dispatch({
          type: "SET_VOYAGES",
          voyages: local.voyages,
          activeVoyageId: local.activeVoyageId,
        });
      } finally {
        if (!cancelled) dispatch({ type: "SET_LOADING", loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

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
    sync(dbUpdateContainer(containerId, toDbContainerPatch(patch)));
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
    sync(createLine(toDbLine(newLine)));
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
    sync(dbDeleteLine(lineId));
    setPending(pendingCount());
  };

  const exportXlsx = () => {
    if (!voyage) return;
    const rows = [];
    voyage.containers.forEach((c) => {
      const status = containerStatus(c);
      if (c.lines.length === 0) {
        rows.push({
          Container: c.number || "Unassigned",
          Size: c.size,
          Status: status,
          Seal: c.sealNo,
          Cargo: "",
          Bags: "",
          UnitKg: "",
          TotalKg: "",
          Shipper: "",
          Consignee: "",
          Truck: "",
        });
        return;
      }
      c.lines.forEach((l) => {
        rows.push({
          Container: c.number || "Unassigned",
          Size: c.size,
          Status: status,
          Seal: c.sealNo,
          Cargo: l.cargo,
          Bags: l.qty,
          UnitKg: l.unitWeightKg,
          TotalKg: Number(l.qty || 0) * Number(l.unitWeightKg || 0),
          Shipper: l.shipper,
          Consignee: l.consignee,
          Truck: l.truckNo,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stuffing Log");
    XLSX.writeFile(wb, `${voyage.voyageNo || "voyage"}-stuffing-log.xlsx`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (checkingAuth) return null;
  if (!session) return <AuthView />;

  const banner = offline ? <OfflineBanner pending={pending} /> : null;

  if (state.loading) {
    return (
      <>
        {banner}
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a9aaa",
            fontFamily: `'JetBrains Mono', ui-monospace, monospace`,
            fontSize: 12,
          }}
        >
          loading voyages…
        </div>
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
      />
    </>
  );
}
