"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";

/** The map failed to render: the centre card with a way back, never the raw error (as the roster, WEB-21). */
export default function MapError() {
  return (
    <>
      <PageTitle>Map</PageTitle>
      <EmptyState title="The map didn't load" action={{ href: "/", label: "Try again" }}>
        Something went wrong while reading the data.
      </EmptyState>
    </>
  );
}
