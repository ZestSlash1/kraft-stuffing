import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { TOKENS } from "../data/statusHelpers";

// Lazy/dynamic import — react-globe.gl (and the three.js it bundles) is kept
// out of the main bundle and only fetched when this screen is visited.
const Globe = lazy(() => import("react-globe.gl"));

const PORTS = [
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Port Blair", lat: 11.6234, lng: 92.7265 },
];

function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function GlobeLoading() {
  return (
    <div
      style={{
        fontFamily: TOKENS.mono,
        fontSize: 11,
        color: TOKENS.steel,
        letterSpacing: "0.2em",
      }}
    >
      LOADING GLOBE…
    </div>
  );
}

export default function PortGlobeView({ voyage }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const { width, height } = useContainerSize(containerRef);

  const movements = (voyage?.vesselMovements || []).filter(
    (m) => m.latitude != null && m.longitude != null
  );

  const points = useMemo(() => {
    const ports = PORTS.map((p) => ({ ...p, color: TOKENS.amber, size: 1 }));
    const events = movements.map((m) => ({
      lat: m.latitude,
      lng: m.longitude,
      name: `${m.eventType.replace("_", " ")} — ${m.location || ""}`,
      color: TOKENS.green,
      size: 0.6,
    }));
    return [...ports, ...events];
  }, [movements]);

  const arcs = useMemo(
    () => [
      {
        startLat: PORTS[0].lat,
        startLng: PORTS[0].lng,
        endLat: PORTS[1].lat,
        endLng: PORTS[1].lng,
        color: [TOKENS.amber, TOKENS.green],
      },
    ],
    []
  );

  useEffect(() => {
    if (globeRef.current?.pointOfView) {
      globeRef.current.pointOfView({ lat: 17, lng: 90, altitude: 1.8 }, 0);
    }
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "calc(100vh - 52px - 56px)",
        minHeight: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {width > 0 && (
        <Suspense fallback={<GlobeLoading />}>
          <Globe
            ref={globeRef}
            width={width}
            height={height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
            showAtmosphere
            atmosphereColor={TOKENS.amber}
            atmosphereAltitude={0.18}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude={0.01}
            pointRadius="size"
            pointLabel="name"
            arcsData={arcs}
            arcColor="color"
            arcStroke={0.6}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={2500}
            labelsData={PORTS}
            labelLat="lat"
            labelLng="lng"
            labelText="name"
            labelSize={0.9}
            labelColor={() => TOKENS.steel}
            labelDotRadius={0}
          />
        </Suspense>
      )}
    </div>
  );
}
