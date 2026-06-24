import { useRef, useEffect, useMemo } from "react";
import { gsap } from "gsap";

export default function ParticlesBurst({ visible, position = [0, 0, 0], onDone }) {
  const pointsRef = useRef();
  const startedRef = useRef(false);
  const count = 60;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 1.5 + Math.random() * 2;
      velocities.push([
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 1,
        Math.sin(phi) * Math.sin(theta) * speed,
      ]);
    }
    return { positions, velocities };
  }, [count]);

  useEffect(() => {
    if (!visible || startedRef.current) return;
    startedRef.current = true;
    const mat = pointsRef.current?.material;
    if (mat) mat.opacity = 1;

    const clock = { t: 0 };
    const tween = gsap.to(clock, {
      t: 1,
      duration: 1.4,
      ease: "power1.out",
      onUpdate: () => {
        const geo = pointsRef.current?.geometry;
        if (!geo) return;
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          const [vx, vy, vz] = velocities[i];
          const t = clock.t;
          arr[i * 3] = vx * t * 1.5;
          arr[i * 3 + 1] = vy * t * 1.5 - 2 * t * t;
          arr[i * 3 + 2] = vz * t * 1.5;
        }
        geo.attributes.position.needsUpdate = true;
        if (mat) mat.opacity = 1 - clock.t;
      },
      onComplete: () => {
        startedRef.current = false;
        onDone && onDone();
      },
    });

    return () => tween.kill();
  }, [visible, velocities]);

  if (!visible) return null;

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#22c55e" size={0.1} transparent opacity={1} />
    </points>
  );
}
