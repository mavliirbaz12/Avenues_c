"use client";

import dynamic from "next/dynamic";

const BottleReveal = dynamic(
  () => import("@/components/landing/bottle-reveal").then((m) => m.BottleReveal),
  { ssr: false },
);

export function LazyBottleReveal() {
  return <BottleReveal />;
}
