import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { CONTAINER_COLORS } from "../data/statusHelpers";

export default function ContainerModel({
  position = [0, 0, 0],
  status = "EMPTY",
  isOpen = false,
  selected = false,
  onClick,
  children,
}) {
  const W = 2.4, H = 2.6, D = 6.0;
  const WALL = 0.04;
  const DOOR_W = W / 2 - 0.02;
  const DOOR_H = H - WALL * 2;

  const leftPivotRef = useRef();
  const rightPivotRef = useRef();

  const colors = CONTAINER_COLORS[status] || CONTAINER_COLORS.EMPTY;
  const hull = colors.hull;
  const emis = selected ? "#1a3a20" : colors.emissive;
  const emInt = selected ? 0.4 : 0.15;

  useEffect(() => {
    if (!leftPivotRef.current || !rightPivotRef.current) return;
    const angle = isOpen ? Math.PI * 0.82 : 0;
    gsap.to(leftPivotRef.current.rotation, {
      y: -angle,
      duration: 1.3,
      ease: isOpen ? "power3.out" : "power2.in",
    });
    gsap.to(rightPivotRef.current.rotation, {
      y: angle,
      duration: 1.3,
      ease: isOpen ? "power3.out" : "power2.in",
      delay: 0.06,
    });
  }, [isOpen]);

  const matProps = { color: hull, emissive: emis, emissiveIntensity: emInt };
  const dark = "#101820";
  const darker = "#0a1018";
  const floorCol = "#0e1c14";
  const ribColor = "#0c1a20";

  return (
    <group position={position} onClick={onClick}>
      <mesh position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W - WALL * 2, D - WALL * 2]} />
        <meshLambertMaterial color={floorCol} />
      </mesh>
      <mesh position={[0, H / 2 - WALL, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - WALL * 2, D - WALL * 2]} />
        <meshLambertMaterial {...matProps} />
      </mesh>
      <mesh position={[0, 0, -D / 2 + WALL]}>
        <planeGeometry args={[W - WALL * 2, H - WALL * 2]} />
        <meshLambertMaterial {...matProps} />
      </mesh>
      <mesh position={[-W / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[D, H, WALL]} />
        <meshLambertMaterial {...matProps} />
      </mesh>
      <mesh position={[W / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[D, H, WALL]} />
        <meshLambertMaterial {...matProps} />
      </mesh>
      <mesh position={[0, H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[W, WALL, D]} />
        <meshLambertMaterial color={dark} />
      </mesh>
      <mesh position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[W, WALL, D]} />
        <meshLambertMaterial color={darker} />
      </mesh>

      {Array.from({ length: 14 }, (_, i) => {
        const z = -D / 2 + (i + 0.5) * (D / 14);
        return (
          <group key={i}>
            <mesh position={[-W / 2 - WALL / 2, 0, z]}>
              <boxGeometry args={[WALL * 1.5, H, 0.08]} />
              <meshLambertMaterial color={ribColor} />
            </mesh>
            <mesh position={[W / 2 + WALL / 2, 0, z]}>
              <boxGeometry args={[WALL * 1.5, H, 0.08]} />
              <meshLambertMaterial color={ribColor} />
            </mesh>
          </group>
        );
      })}

      {[[-1, 1], [-1, -1], [1, 1], [1, -1]].map(([sx, sy], i) => (
        <group key={i}>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[sx * W / 2, sy * H / 2, sz * D / 2]}>
              <boxGeometry args={[0.12, 0.14, 0.14]} />
              <meshLambertMaterial color="#0a1218" />
            </mesh>
          ))}
        </group>
      ))}

      <group ref={leftPivotRef} position={[-W / 2, 0, D / 2]}>
        <mesh position={[DOOR_W / 2, 0, 0.02]} castShadow>
          <boxGeometry args={[DOOR_W, DOOR_H, WALL]} />
          <meshLambertMaterial {...matProps} />
        </mesh>
        {[0.25, 0.5, 0.75].map((f) => (
          <mesh key={f} position={[DOOR_W * f, 0, 0.045]}>
            <boxGeometry args={[0.04, DOOR_H, 0.02]} />
            <meshLambertMaterial color={ribColor} />
          </mesh>
        ))}
        <mesh position={[DOOR_W - 0.12, 0, 0.05]}>
          <boxGeometry args={[0.03, DOOR_H * 0.85, 0.03]} />
          <meshLambertMaterial color="#1a2a1a" />
        </mesh>
        <mesh position={[DOOR_W - 0.10, 0, 0.065]}>
          <boxGeometry args={[0.06, 0.06, 0.04]} />
          <meshLambertMaterial color="#8a9a8a" />
        </mesh>
      </group>

      <group ref={rightPivotRef} position={[W / 2, 0, D / 2]}>
        <mesh position={[-DOOR_W / 2, 0, 0.02]} castShadow>
          <boxGeometry args={[DOOR_W, DOOR_H, WALL]} />
          <meshLambertMaterial {...matProps} />
        </mesh>
        {[0.25, 0.5, 0.75].map((f) => (
          <mesh key={f} position={[-DOOR_W * f, 0, 0.045]}>
            <boxGeometry args={[0.04, DOOR_H, 0.02]} />
            <meshLambertMaterial color={ribColor} />
          </mesh>
        ))}
        <mesh position={[-(DOOR_W - 0.12), 0, 0.05]}>
          <boxGeometry args={[0.03, DOOR_H * 0.85, 0.03]} />
          <meshLambertMaterial color="#1a2a1a" />
        </mesh>
        <mesh position={[-(DOOR_W - 0.10), 0, 0.065]}>
          <boxGeometry args={[0.06, 0.06, 0.04]} />
          <meshLambertMaterial color="#8a9a8a" />
        </mesh>
      </group>

      <mesh position={[0, H / 2 - WALL / 2, D / 2]}>
        <boxGeometry args={[W, WALL, WALL * 2]} />
        <meshLambertMaterial color={dark} />
      </mesh>
      <mesh position={[0, -H / 2 + WALL / 2, D / 2]}>
        <boxGeometry args={[W, WALL, WALL * 2]} />
        <meshLambertMaterial color={darker} />
      </mesh>
      <mesh position={[-W / 2, 0, D / 2]}>
        <boxGeometry args={[WALL, H, WALL * 2]} />
        <meshLambertMaterial color={dark} />
      </mesh>
      <mesh position={[W / 2, 0, D / 2]}>
        <boxGeometry args={[WALL, H, WALL * 2]} />
        <meshLambertMaterial color={dark} />
      </mesh>
      <mesh position={[0, 0, D / 2]}>
        <boxGeometry args={[WALL, H, WALL * 2]} />
        <meshLambertMaterial color={dark} />
      </mesh>

      {children}
    </group>
  );
}
