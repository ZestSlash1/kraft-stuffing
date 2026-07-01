// useIsMobile — single source of truth for the mobile breakpoint in JS-land.
// Mirrors theme.breakpoints.mobile (640px). Use this to branch inline styles
// instead of hardcoding desktop dimensions. CSS-only responsiveness should keep
// using the media queries in global.css; this is for cases where the value has
// to be computed in React (grid columns, fixed widths, chart heights, etc.).
import { useEffect, useState } from "react";
import { theme } from "../theme";

const QUERY = `(max-width: ${theme.breakpoints.mobile}px)`;

const getMatch = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    // Safari <14 uses addListener/removeListener.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
