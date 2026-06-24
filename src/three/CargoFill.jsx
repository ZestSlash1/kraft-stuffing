import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { calcBagPositions } from "../data/cargoLayout";
import { CARGO_COLORS } from "../data/statusHelpers";

export default function CargoFill({ totalBags, cargoName, containerDims }) {
  const meshRef = useRef();
  const prevCountRef = useRef(0);

  const positions = useMemo(
    () => calcBagPositions(containerDims, totalBags),
    [containerDims, totalBags]
  );

  const color = CARGO_COLORS[cargoName] || CARGO_COLORS.default;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const prevCount = prevCountRef.current;

    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      const scale = i >= prevCount ? 0.001 : 1;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = positions.length;
    mesh.instanceMatrix.needsUpdate = true;

    if (positions.length > prevCount) {
      for (let i = prevCount; i < positions.length; i++) {
        const p = positions[i];
        const delay = (i - prevCount) * 0.012;
        const obj = { scale: 0.001, y: p.y + 1.2 };
        gsap.to(obj, {
          scale: 1,
          y: p.y,
          duration: 0.5,
          delay,
          ease: "bounce.out",
          onUpdate: () => {
            dummy.position.set(p.x, obj.y, p.z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.setScalar(obj.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            mesh.instanceMatrix.needsUpdate = true;
          },
        });
      }
    }

    prevCountRef.current = positions.length;
  }, [positions]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, 320]} castShadow receiveShadow>
      <boxGeometry args={[0.4, 0.26, 0.48]} />
      <meshLambertMaterial color={color} />
    </instancedMesh>
  );
}
