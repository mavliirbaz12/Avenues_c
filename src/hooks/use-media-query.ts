"use client";

import { useEffect, useState } from "react";

/**
 * Reads a media query in JS.
 *
 * Returns false on the server and on the first client render, so anything
 * driven by it must have a sensible "false" state — otherwise hydration
 * mismatches. Use CSS for layout; use this only when JS genuinely needs to
 * branch, such as choosing a motion direction.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
