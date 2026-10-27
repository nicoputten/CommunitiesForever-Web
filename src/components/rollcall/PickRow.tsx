"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { flyToCharacter } from "@/components/map/flyTo";

/** A roll call row with a place on the map: picking it selects the character and flies there (WEB-26). */
export function PickRow({ guid, className, children }: { guid: string; className?: string; children: ReactNode }) {
  const selected = useSearchParams().get("character") === guid;
  return (
    <button
      type="button"
      className={className}
      aria-current={selected || undefined}
      onClick={() => flyToCharacter(guid)}
    >
      {children}
    </button>
  );
}
