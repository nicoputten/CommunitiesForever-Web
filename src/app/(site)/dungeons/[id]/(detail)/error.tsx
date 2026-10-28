"use client";

import { EmptyState } from "@/components/ui/EmptyState";

/** The dungeon page failed to render: the centre card with a way back, never the raw error (WEB-42). */
export default function DungeonError() {
  return (
    <EmptyState title="The dungeon didn't load" as="h1" action={{ href: "/", label: "← Map" }}>
      Something went wrong while reading the runs.
    </EmptyState>
  );
}
