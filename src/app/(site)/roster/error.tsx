"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./roster.module.css";

/** The roster failed to render: the centre card with a way back, never the raw error (decided with Nico for WEB-21). */
export default function RosterError() {
  return (
    <div className={styles.page}>
      <PageTitle>Roster</PageTitle>
      <EmptyState title="The roster didn't load" action={{ href: "/roster", label: "Try again" }}>
        Something went wrong while reading the data.
      </EmptyState>
    </div>
  );
}
