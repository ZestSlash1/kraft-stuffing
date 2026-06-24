import { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import * as XLSX from "xlsx";
import {
  Box,
  ChevronDown,
  Ship,
  Truck,
  Trash2,
  Plus,
  Package,
  FileDown,
} from "lucide-react";

const MONO_FONT =
  "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace";

const STATUS_COLORS = {
  SEALED: "#22c55e",
  EMPTY: "#475569",
  OVER: "#ef4444",
  FULL: "#f59e0b",
  STUFFING: "#f5a623",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function mkSeed() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    activeVoyageId: "v1",
    voyages: [
      {
        id: "v1",
        vessel: "MV APJ Karan 2",
        voyageNo: "AK2-118",
        date: today,
        containers: [
          {
            id: "c1",
            number: "APZU2231140",
            size: "20",
            capacityBags: 340,
            sealNo: "SL22F34",
            sealed: true,
            lines: [
              {
                id: uid(),
                cargo: "Potato",
                qty: 340,
                unitWeightKg: 50,
                shipper: "Shafrina Impex LLP",
                consignee: "Y.E. Jadwet Group",
                truckNo: "WB23F4471",
              },
            ],
          },
          {
            id: "c2",
            number: "TGHU5567021",
            size: "20",
            capacityBags: 340,
            sealNo: "",
            sealed: false,
            lines: [
              {
                id: uid(),
                cargo: "Potato",
                qty: 180,
                unitWeightKg: 50,
                shipper: "Shafrina Impex LLP",
                consignee: "Y.E. Jadwet Group",
                truckNo: "WB25E2210",
              },
              {
                id: uid(),
                cargo: "Potato",
                qty: 100,
                unitWeightKg: 50,
                shipper: "Shafrina Impex LLP",
                consignee: "Y.E. Jadwet Group",
                truckNo: "WB18C3301",
              },
            ],
          },
          {
            id: "c3",
            number: "",
            size: "20",
            capacityBags: 340,
            sealNo: "",
            sealed: false,
            lines: [],
          },
        ],
      },
    ],
  };
}

function containerBags(c) {
  return c.lines.reduce((s, l) => s + l.qty, 0);
}

function containerKg(c) {
  return c.lines.reduce((s, l) => s + l.qty * l.unitWeightKg, 0);
}

function containerStatus(c) {
  const bags = containerBags(c);
  if (c.sealed) return "SEALED";
  if (bags === 0) return "EMPTY";
  if (bags > c.capacityBags) return "OVER";
  if (bags >= c.capacityBags) return "FULL";
  return "STUFFING";
}

function fillColor(rawPct) {
  if (rawPct > 100) return "#ef4444";
  if (rawPct >= 95) return "#f59e0b";
  if (rawPct >= 60) return "#f5a623";
  return "#22c55e";
}

function uniqueValues(voyages, field) {
  const set = new Set();
  for (const v of voyages) {
    for (const c of v.containers) {
      for (const l of c.lines) {
        if (l[field]) set.add(l[field]);
      }
    }
  }
  return [...set];
}

function exportVoyageXlsx(voyage) {
  const rows = [];
  let totalBags = 0;
  let totalKg = 0;

  for (const c of voyage.containers) {
    for (const l of c.lines) {
      const totalLineKg = l.qty * l.unitWeightKg;
      totalBags += l.qty;
      totalKg += totalLineKg;
      rows.push({
        "Voyage No": voyage.voyageNo,
        Vessel: voyage.vessel,
        Date: voyage.date,
        "Container No": c.number || "—",
        Size: `${c.size}ft`,
        "Seal No": c.sealNo || "—",
        Cargo: l.cargo,
        Bags: l.qty,
        "Unit Wt (kg)": l.unitWeightKg,
        "Total Wt (kg)": totalLineKg,
        Shipper: l.shipper,
        Consignee: l.consignee,
        "Truck No": l.truckNo,
      });
    }
  }

  rows.push({});
  rows.push({
    "Voyage No": "VOYAGE TOTAL",
    Vessel: "",
    Date: "",
    "Container No": "",
    Size: "",
    "Seal No": "",
    Cargo: "",
    Bags: totalBags,
    "Unit Wt (kg)": "",
    "Total Wt (kg)": totalKg,
    Shipper: "",
    Consignee: "",
    "Truck No": "",
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 6 },
    { wch: 12 },
    { wch: 14 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stuffing");
  XLSX.writeFile(wb, `Stuffing_${voyage.voyageNo || "voyage"}.xlsx`);
}

const labelStyle = {
  fontSize: 11,
  color: "#64748b",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const inputStyle = {
  width: "100%",
  background: "#07090e",
  border: "1px solid #1c2d42",
  borderRadius: 6,
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const dangerButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "center",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid #ef4444",
  color: "#ef4444",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
};

const iconButtonStyle = {
  background: "transparent",
  border: "none",
  color: "#64748b",
  cursor: "pointer",
  padding: 4,
  display: "flex",
  alignItems: "center",
};

const sizeBadgeStyle = {
  background: "#1c2d42",
  color: "#94a3b8",
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 4,
  fontWeight: 600,
};

function statusBadgeStyle(status) {
  const c = STATUS_COLORS[status];
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 4,
    background: `${c}1a`,
    color: c,
    letterSpacing: 0.5,
  };
}

const addButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#f5a623",
  color: "#1a1206",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const exportButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #1c2d42",
  borderRadius: 6,
  padding: "8px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

function ThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer, scene, camera, points, lines, frameId;
    let particles = [];
    let frameCount = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let disposed = false;

    try {
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, width, 0, height, -10, 10);
      camera.position.z = 5;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      mount.appendChild(renderer.domElement);

      const COUNT = 45;
      const posAttr = new Float32Array(COUNT * 3);
      particles = [];
      for (let i = 0; i < COUNT; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        });
        posAttr[i * 3] = x;
        posAttr[i * 3 + 1] = y;
        posAttr[i * 3 + 2] = 0;
      }

      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute("position", new THREE.BufferAttribute(posAttr, 3));
      const pointMat = new THREE.PointsMaterial({
        color: 0x1e3d6e,
        size: 2.5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.7,
      });
      points = new THREE.Points(pointGeo, pointMat);
      scene.add(points);

      const maxPairs = (COUNT * (COUNT - 1)) / 2;
      const linePosAttr = new Float32Array(maxPairs * 2 * 3);
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(linePosAttr, 3)
      );
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x1e3d6e,
        transparent: true,
        opacity: 0.25,
      });
      lines = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lines);

      function updateLines() {
        const threshold = Math.min(width, height) * 0.22;
        const arr = lines.geometry.attributes.position.array;
        let idx = 0;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < threshold && idx + 6 <= arr.length) {
              arr[idx++] = particles[i].x;
              arr[idx++] = particles[i].y;
              arr[idx++] = 0;
              arr[idx++] = particles[j].x;
              arr[idx++] = particles[j].y;
              arr[idx++] = 0;
            }
          }
        }
        lines.geometry.setDrawRange(0, idx / 3);
        lines.geometry.attributes.position.needsUpdate = true;
      }

      function animate() {
        frameId = requestAnimationFrame(animate);
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.x = Math.max(0, Math.min(width, p.x));
          p.y = Math.max(0, Math.min(height, p.y));
        }
        const posArr = points.geometry.attributes.position.array;
        for (let i = 0; i < particles.length; i++) {
          posArr[i * 3] = particles[i].x;
          posArr[i * 3 + 1] = particles[i].y;
        }
        points.geometry.attributes.position.needsUpdate = true;

        frameCount++;
        if (frameCount % 3 === 0) updateLines();

        renderer.render(scene, camera);
      }
      animate();

      const handleResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        renderer.setSize(width, height);
        camera.right = width;
        camera.bottom = height;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        disposed = true;
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(frameId);
        pointGeo.dispose();
        pointMat.dispose();
        lineGeo.dispose();
        lineMat.dispose();
        renderer.dispose();
        if (mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      };
    } catch (e) {
      console.warn("ThreeBackground failed to initialise:", e);
      return () => {
        disposed = true;
      };
    }
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function LabeledInput({ label, icon, value, onChange, type = "text", mono }) {
  return (
    <label style={{ display: "block" }}>
      <div style={labelStyle}>
        {icon}
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={mono ? { ...inputStyle, fontFamily: MONO_FONT } : inputStyle}
      />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: "block" }}>
      <div style={labelStyle}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LineCard({ line, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && gsap) {
      gsap.from(ref.current, {
        x: -18,
        opacity: 0,
        duration: 0.35,
        ease: "back.out(1.5)",
      });
    }
  }, []);

  const totalKg = line.qty * line.unitWeightKg;

  return (
    <div
      ref={ref}
      style={{
        background: "#0d1520",
        border: "1px solid #1c2d42",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <div style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {line.cargo}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 400 }}>
            · {line.qty} bags · {totalKg.toLocaleString()} kg
          </span>
        </div>
        <button
          onClick={() => onDelete(line.id)}
          style={iconButtonStyle}
          aria-label="Delete line"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
        {line.shipper} <span style={{ color: "#475569" }}>→</span>{" "}
        {line.consignee}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Truck size={12} /> {line.truckNo}
      </div>
    </div>
  );
}

function AddForm({ onAdd, cargoOptions, shipperOptions, consigneeOptions }) {
  const [cargo, setCargo] = useState("");
  const [qty, setQty] = useState("");
  const [unitWeightKg, setUnitWeightKg] = useState("");
  const [shipper, setShipper] = useState("");
  const [consignee, setConsignee] = useState("");
  const [truckNo, setTruckNo] = useState("");

  function submit() {
    if (!cargo.trim() || !qty || Number(qty) <= 0) return;
    onAdd({
      id: uid(),
      cargo: cargo.trim(),
      qty: Number(qty),
      unitWeightKg: Number(unitWeightKg) || 0,
      shipper: shipper.trim(),
      consignee: consignee.trim(),
      truckNo: truckNo.trim(),
    });
    setCargo("");
    setQty("");
    setUnitWeightKg("");
    setTruckNo("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter") submit();
  }

  return (
    <div style={{ marginTop: 10 }} onKeyDown={onKeyDown}>
      <input
        list="cargo-options"
        placeholder="Cargo"
        value={cargo}
        onChange={(e) => setCargo(e.target.value)}
        style={inputStyle}
      />
      <datalist id="cargo-options">
        {cargoOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <input
          type="number"
          placeholder="Bags"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="kg / bag"
          value={unitWeightKg}
          onChange={(e) => setUnitWeightKg(e.target.value)}
          style={inputStyle}
        />
      </div>

      <input
        list="shipper-options"
        placeholder="Shipper"
        value={shipper}
        onChange={(e) => setShipper(e.target.value)}
        style={{ ...inputStyle, marginTop: 8 }}
      />
      <datalist id="shipper-options">
        {shipperOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <input
        list="consignee-options"
        placeholder="Consignee"
        value={consignee}
        onChange={(e) => setConsignee(e.target.value)}
        style={{ ...inputStyle, marginTop: 8 }}
      />
      <datalist id="consignee-options">
        {consigneeOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          marginTop: 8,
        }}
      >
        <input
          placeholder="Truck No"
          value={truckNo}
          onChange={(e) => setTruckNo(e.target.value)}
          style={inputStyle}
        />
        <button onClick={submit} style={addButtonStyle}>
          Add
        </button>
      </div>
    </div>
  );
}

function ContainerCard({
  container,
  index,
  onUpdate,
  onDelete,
  onAddLine,
  onDeleteLine,
  cargoOptions,
  shipperOptions,
  consigneeOptions,
}) {
  const [open, setOpen] = useState(false);
  const gaugeRef = useRef(null);

  const bags = containerBags(container);
  const kg = containerKg(container);
  const status = containerStatus(container);
  const rawPct =
    container.capacityBags > 0 ? (bags / container.capacityBags) * 100 : 0;
  const widthPct = Math.min(100, rawPct);

  useEffect(() => {
    if (gaugeRef.current) {
      gaugeRef.current.style.width = widthPct + "%";
    }
  }, [widthPct]);

  return (
    <div
      data-cid={container.id}
      className="kcard"
      style={{
        position: "relative",
        background: "#0d1520",
        border: "1px solid #1c2d42",
        borderRadius: 10,
        marginBottom: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: STATUS_COLORS[status],
          boxShadow: `0 0 8px ${STATUS_COLORS[status]}`,
        }}
      />
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px 14px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#e2e8f0",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <span style={{ color: "#475569", fontSize: 12, width: 18 }}>
          {index + 1}
        </span>
        <Box size={18} color="#64748b" />
        <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>
          {container.number || "— NO NUMBER —"}
        </span>
        <span style={sizeBadgeStyle}>{container.size}ft</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            ...statusBadgeStyle(status),
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: STATUS_COLORS[status],
            }}
          />
          {status}
        </span>
        <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 13 }}>
          {bags}/{container.capacityBags} bags
        </span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>
          {(kg / 1000).toFixed(2)} MT
        </span>
        <ChevronDown
          size={16}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            color: "#64748b",
            flexShrink: 0,
          }}
        />
      </button>

      <div style={{ height: 3, background: "#0a0f17" }}>
        <div
          ref={gaugeRef}
          style={{
            height: "100%",
            width: "0%",
            background: fillColor(rawPct),
            transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </div>

      <div
        style={{
          maxHeight: open ? "2000px" : "0px",
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease",
        }}
      >
        <div style={{ padding: "4px 16px 18px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label="Container No"
              value={container.number}
              onChange={(v) => onUpdate({ ...container, number: v })}
              mono
            />
            <LabeledSelect
              label="Type"
              value={container.size}
              onChange={(v) => onUpdate({ ...container, size: v })}
              options={[
                { value: "20", label: "20ft" },
                { value: "40", label: "40ft" },
              ]}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <LabeledInput
              label="Capacity (bags)"
              type="number"
              value={container.capacityBags}
              onChange={(v) =>
                onUpdate({ ...container, capacityBags: Number(v) || 0 })
              }
            />
            <LabeledInput
              label="Seal No"
              value={container.sealNo}
              onChange={(v) => onUpdate({ ...container, sealNo: v })}
              mono
            />
          </div>

          {bags > container.capacityBags && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              ⚠ Over capacity by {bags - container.capacityBags} bags
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => onUpdate({ ...container, sealed: !container.sealed })}
              style={{
                flex: 1,
                background: container.sealed
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(245,166,35,0.15)",
                border: `1px solid ${
                  container.sealed ? "#22c55e" : "#f5a623"
                }`,
                color: container.sealed ? "#22c55e" : "#f5a623",
                borderRadius: 6,
                padding: "8px 0",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              {container.sealed ? "Sealed ✓" : "Mark Sealed"}
            </button>
            <button onClick={() => onDelete(container.id)} style={dangerButtonStyle}>
              <Trash2 size={14} /> Delete
            </button>
          </div>

          {container.lines.map((line) => (
            <LineCard
              key={line.id}
              line={line}
              onDelete={(lid) => onDeleteLine(container.id, lid)}
            />
          ))}

          <AddForm
            onAdd={(line) => onAddLine(container.id, line)}
            cargoOptions={cargoOptions}
            shipperOptions={shipperOptions}
            consigneeOptions={consigneeOptions}
          />
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, valueRef, accent }) {
  return (
    <div style={{ background: "#0d1520", padding: "12px 14px" }}>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: accent || "#e2e8f0",
          fontFamily: "inherit",
        }}
      >
        {valueRef ? <span ref={valueRef}>0</span> : value}
      </div>
    </div>
  );
}

function StatsStrip({ voyage }) {
  const bagsRef = useRef(null);
  const kgRef = useRef(null);

  const totals = useMemo(() => {
    let bags = 0;
    let kg = 0;
    let sealed = 0;
    for (const c of voyage.containers) {
      bags += containerBags(c);
      kg += containerKg(c);
      if (c.sealed) sealed++;
    }
    return { bags, kg, sealed, total: voyage.containers.length };
  }, [voyage]);

  useEffect(() => {
    if (!gsap) {
      if (bagsRef.current) bagsRef.current.textContent = totals.bags.toLocaleString();
      if (kgRef.current) kgRef.current.textContent = totals.kg.toLocaleString();
      return undefined;
    }
    const counter = { b: 0, k: 0 };
    const tween = gsap.to(counter, {
      b: totals.bags,
      k: totals.kg,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        if (bagsRef.current) {
          bagsRef.current.textContent = Math.round(counter.b).toLocaleString();
        }
        if (kgRef.current) {
          kgRef.current.textContent = Math.round(counter.k).toLocaleString();
        }
      },
    });
    return () => tween.kill();
  }, [totals.bags, totals.kg]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1,
        background: "#1c2d42",
        border: "1px solid #1c2d42",
        borderRadius: 8,
        overflow: "hidden",
        marginTop: 14,
      }}
    >
      <StatCell label="SEALED" value={`${totals.sealed}/${totals.total}`} />
      <StatCell label="BAGS" valueRef={bagsRef} />
      <StatCell
        label="WEIGHT"
        value={`${(totals.kg / 1000).toFixed(2)} MT`}
        accent="#f5a623"
      />
      <StatCell label="KG" valueRef={kgRef} />
    </div>
  );
}

function VoyageHeader({ voyage, onUpdate, onDelete }) {
  return (
    <div
      style={{
        background: "#0d1520",
        border: "1px solid #1c2d42",
        borderRadius: 10,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <LabeledInput
          label="Vessel"
          icon={<Ship size={13} />}
          value={voyage.vessel}
          onChange={(v) => onUpdate({ ...voyage, vessel: v })}
        />
        <LabeledInput
          label="Voyage No"
          value={voyage.voyageNo}
          onChange={(v) => onUpdate({ ...voyage, voyageNo: v })}
          mono
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          marginTop: 10,
          alignItems: "end",
        }}
      >
        <LabeledInput
          label="Date"
          type="date"
          value={voyage.date}
          onChange={(v) => onUpdate({ ...voyage, date: v })}
        />
        <button onClick={() => onDelete(voyage.id)} style={dangerButtonStyle}>
          <Trash2 size={14} /> Delete Voyage
        </button>
      </div>
      <StatsStrip voyage={voyage} />
    </div>
  );
}

function TopHeader({ voyages, activeVoyageId, onSelectVoyage, onNewVoyage }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(7,9,14,0.75)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid #1c2d42",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Package size={22} color="#f5a623" />
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              color: "#e2e8f0",
              letterSpacing: 0.5,
            }}
          >
            STUFFING LOG
          </div>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>
            KRAFT SHIPPING &amp; LOGISTICS
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={activeVoyageId}
          onChange={(e) => onSelectVoyage(e.target.value)}
          style={{ ...inputStyle, width: "auto" }}
        >
          {voyages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.voyageNo || "(untitled)"} — {v.vessel || "?"}
            </option>
          ))}
        </select>
        <button onClick={onNewVoyage} style={addButtonStyle}>
          <Plus size={14} /> New
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem("kraft-stuffing-v3");
      return s ? JSON.parse(s) : mkSeed();
    } catch {
      return mkSeed();
    }
  });

  useEffect(() => {
    localStorage.setItem("kraft-stuffing-v3", JSON.stringify(state));
  }, [state]);

  const [newCid, setNewCid] = useState(null);
  const cardsRef = useRef(null);

  const voyage =
    state.voyages.find((v) => v.id === state.activeVoyageId) ||
    state.voyages[0];

  const cargoOptions = useMemo(
    () => uniqueValues(state.voyages, "cargo"),
    [state]
  );
  const shipperOptions = useMemo(
    () => uniqueValues(state.voyages, "shipper"),
    [state]
  );
  const consigneeOptions = useMemo(
    () => uniqueValues(state.voyages, "consignee"),
    [state]
  );

  useEffect(() => {
    const cards = cardsRef.current?.querySelectorAll(".kcard");
    if (cards?.length && gsap) {
      gsap.from([...cards], {
        y: 28,
        opacity: 0,
        stagger: 0.1,
        duration: 0.55,
        ease: "power3.out",
        delay: 0.2,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!newCid) return;
    const el = cardsRef.current?.querySelector(`[data-cid="${newCid}"]`);
    if (el && gsap) {
      gsap.from(el, { y: 24, opacity: 0, duration: 0.5, ease: "power3.out" });
    }
    setNewCid(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCid]);

  function updateVoyage(updated) {
    setState((s) => ({
      ...s,
      voyages: s.voyages.map((v) => (v.id === updated.id ? updated : v)),
    }));
  }

  function updateContainer(updated) {
    updateVoyage({
      ...voyage,
      containers: voyage.containers.map((c) =>
        c.id === updated.id ? updated : c
      ),
    });
  }

  function deleteContainer(cid) {
    updateVoyage({
      ...voyage,
      containers: voyage.containers.filter((c) => c.id !== cid),
    });
  }

  function addContainer() {
    const c = {
      id: uid(),
      number: "",
      size: "20",
      capacityBags: 340,
      sealNo: "",
      sealed: false,
      lines: [],
    };
    updateVoyage({ ...voyage, containers: [...voyage.containers, c] });
    setNewCid(c.id);
  }

  function addLine(cid, line) {
    updateVoyage({
      ...voyage,
      containers: voyage.containers.map((c) =>
        c.id === cid ? { ...c, lines: [...c.lines, line] } : c
      ),
    });
  }

  function deleteLine(cid, lid) {
    updateVoyage({
      ...voyage,
      containers: voyage.containers.map((c) =>
        c.id === cid
          ? { ...c, lines: c.lines.filter((l) => l.id !== lid) }
          : c
      ),
    });
  }

  function newVoyage() {
    const v = {
      id: uid(),
      vessel: "",
      voyageNo: "",
      date: new Date().toISOString().slice(0, 10),
      containers: [],
    };
    setState((s) => ({
      ...s,
      voyages: [...s.voyages, v],
      activeVoyageId: v.id,
    }));
  }

  function deleteVoyage(vid) {
    setState((s) => {
      const remaining = s.voyages.filter((v) => v.id !== vid);
      const voyages = remaining.length ? remaining : [mkSeed().voyages[0]];
      return { ...s, voyages, activeVoyageId: voyages[0].id };
    });
  }

  if (!voyage) return null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        fontFamily: MONO_FONT,
        color: "#e2e8f0",
      }}
    >
      <ThreeBackground />
      <div style={{ position: "relative", zIndex: 1 }}>
        <TopHeader
          voyages={state.voyages}
          activeVoyageId={voyage.id}
          onSelectVoyage={(id) =>
            setState((s) => ({ ...s, activeVoyageId: id }))
          }
          onNewVoyage={newVoyage}
        />
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 60px" }}>
          <VoyageHeader
            voyage={voyage}
            onUpdate={updateVoyage}
            onDelete={deleteVoyage}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 0.5 }}>
              CONTAINERS
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => exportVoyageXlsx(voyage)}
                style={exportButtonStyle}
              >
                <FileDown size={14} /> Export XLSX
              </button>
              <button onClick={addContainer} style={addButtonStyle}>
                <Plus size={14} /> Add Container
              </button>
            </div>
          </div>

          <div ref={cardsRef}>
            {voyage.containers.map((c, i) => (
              <ContainerCard
                key={c.id}
                container={c}
                index={i}
                onUpdate={updateContainer}
                onDelete={deleteContainer}
                onAddLine={addLine}
                onDeleteLine={deleteLine}
                cargoOptions={cargoOptions}
                shipperOptions={shipperOptions}
                consigneeOptions={consigneeOptions}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
