"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./professions.module.css";

/** The page failed to render: the centre card with a way back, never the raw error (as the roster, WEB-21). */
export default function ProfessionsError() {
  return (
    <div className={styles.page}>
      <PageTitle>Professions</PageTitle>
      <EmptyState title="Professions didn't load" action={{ href: "/professions", label: "Try again" }}>
        Something went wrong while reading the data.
      </EmptyState>
    </div>
  );
}
