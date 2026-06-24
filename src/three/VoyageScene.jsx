import { useState, useRef } from "react";
import { OrbitControls, Html } from "@react-three/drei";
import ContainerModel from "./ContainerModel";
import CargoFill from "./CargoFill";
import ParticlesBurst from "./ParticlesBurst";
import { containerStatus } from "../data/statusHelpers";

function ContainerInScene({
  container,
  position,
  selected,
  onSelect,
  justSealed,
  onAckBurst,
}) {
  const [burstVisible, setBurstVisible] = useState(false);
  const status = containerStatus(container);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const primaryCargo = container.lines[0]?.cargo;

  if (justSealed && !burstVisible) {
    setBurstVisible(true);
  }

  return (
    <ContainerModel
      position={position}
      status={status}
      isOpen={false}
      selected={selected}
      onClick={() => onSelect(container.id)}
    >
      <CargoFill
        totalBags={totalBags}
        cargoName={primaryCargo}
        containerDims={{ W: 2.2, H: 2.4, D: 5.6 }}
      />
      <ParticlesBurst
        visible={burstVisible}
        position={[0, 1.6, 0]}
        onDone={() => {
          setBurstVisible(false);
          onAckBurst && onAckBurst();
        }}
      />
      <Html position={[0, 1.7, 3.2]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            color: "#cbd5e1",
            background: "rgba(7,9,14,0.75)",
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {container.number || "Unassigned"}
        </div>
      </Html>
    </ContainerModel>
  );
}

export default function VoyageScene({
  voyage,
  selectedId,
  onSelect,
  justSealedId,
  onAckBurst,
}) {
  const controlsRef = useRef();
  const gap = 7.5;
  const startX = -((voyage.containers.length - 1) * gap) / 2;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 4, -5]} intensity={0.3} />

      {voyage.containers.map((c, i) => (
        <ContainerInScene
          key={c.id}
          container={c}
          position={[startX + i * gap, 0, 0]}
          selected={selectedId === c.id}
          onSelect={onSelect}
          justSealed={justSealedId === c.id}
          onAckBurst={onAckBurst}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={6}
        maxDistance={26}
        autoRotate
        autoRotateSpeed={0.6}
        onStart={() => {
          if (controlsRef.current) controlsRef.current.autoRotate = false;
        }}
      />
    </>
  );
}
