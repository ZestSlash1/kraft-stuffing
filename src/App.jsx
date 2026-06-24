import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { readStore, writeStore } from "./data/store";
import { mkSeed } from "./seed";
import { containerStatus } from "./data/statusHelpers";
import VoyageView from "./views/VoyageView";
import LogView from "./views/LogView";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [state, setState] = useState(() => readStore() || mkSeed());
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [openLogContainerId, setOpenLogContainerId] = useState(null);

  useEffect(() => {
    writeStore(state);
  }, [state]);

  const voyage = state.voyages.find((v) => v.id === state.activeVoyageId);

  const patchContainer = (containerId, patch) => {
    setState((s) => {
      const voyages = s.voyages.map((v) => {
        if (v.id !== s.activeVoyageId) return v;
        return {
          ...v,
          containers: v.containers.map((c) =>
            c.id === containerId ? { ...c, ...patch } : c
          ),
        };
      });
      return { ...s, voyages };
    });
  };

  const addLine = (containerId, line) => {
    setState((s) => {
      const voyages = s.voyages.map((v) => {
        if (v.id !== s.activeVoyageId) return v;
        return {
          ...v,
          containers: v.containers.map((c) =>
            c.id === containerId
              ? { ...c, lines: [...c.lines, { id: uid(), ...line }] }
              : c
          ),
        };
      });
      return { ...s, voyages };
    });
  };

  const deleteLine = (containerId, lineId) => {
    setState((s) => {
      const voyages = s.voyages.map((v) => {
        if (v.id !== s.activeVoyageId) return v;
        return {
          ...v,
          containers: v.containers.map((c) =>
            c.id === containerId
              ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) }
              : c
          ),
        };
      });
      return { ...s, voyages };
    });
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

  const openLogContainer = voyage?.containers.find((c) => c.id === openLogContainerId);

  if (openLogContainer) {
    return (
      <LogView
        container={openLogContainer}
        onBack={() => setOpenLogContainerId(null)}
        onAddLine={(line) => addLine(openLogContainer.id, line)}
        onDeleteLine={(lineId) => deleteLine(openLogContainer.id, lineId)}
        onPatchContainer={(patch) => patchContainer(openLogContainer.id, patch)}
      />
    );
  }

  return (
    <VoyageView
      voyages={state.voyages}
      activeVoyageId={state.activeVoyageId}
      onSelectVoyage={(id) => setState((s) => ({ ...s, activeVoyageId: id }))}
      selectedContainerId={selectedContainerId}
      onSelectContainer={setSelectedContainerId}
      onOpenLog={setOpenLogContainerId}
      onExportXlsx={exportXlsx}
    />
  );
}
