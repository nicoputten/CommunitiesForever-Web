"use client";

import { EmptyState } from "@/components/ui/EmptyState";

/** The character page failed to render: the centre card with a way back, never the raw error (WEB-23). */
export default function CharacterError() {
  return (
    <EmptyState title="The character didn't load" as="h1" action={{ href: "/roster", label: "← Roster" }}>
      Something went wrong while reading the data.
    </EmptyState>
  );
}
