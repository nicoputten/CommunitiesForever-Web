"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "../admin.module.css";

/** The admin page failed (or an action did): the centre card with a way back, never the raw error (WEB-18). */
export default function AdminError() {
  return (
    <div className={styles.page}>
      <PageTitle>Admin</PageTitle>
      <EmptyState title="The admin page didn't load" action={{ href: "/admin", label: "Try again" }}>
        Something went wrong while reading the access list.
      </EmptyState>
    </div>
  );
}
