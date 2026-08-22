"use client";

import dynamic from "next/dynamic";

const BogotaMapInner = dynamic(
  () => import("./bogota-map-inner").then((mod) => mod.BogotaMapInner),
  { ssr: false }
);

export function BogotaMap({ className }: { className?: string }) {
  return (
    <div className={className}>
      <BogotaMapInner />
    </div>
  );
}
