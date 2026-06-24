import { OrbitControls } from "@react-three/drei";
import ContainerModel from "./ContainerModel";
import CargoFill from "./CargoFill";
import { containerStatus } from "../data/statusHelpers";

export default function LogScene({ container, isOpen }) {
  const status = containerStatus(container);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const primaryCargo = container.lines[0]?.cargo;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 7, 6]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 3, -4]} intensity={0.35} />

      <ContainerModel position={[0, 0, 0]} status={status} isOpen={isOpen} selected={false}>
        <CargoFill
          totalBags={totalBags}
          cargoName={primaryCargo}
          containerDims={{ W: 2.2, H: 2.4, D: 5.6 }}
        />
      </ContainerModel>

      <OrbitControls enablePan={false} minDistance={4} maxDistance={16} />
    </>
  );
}
