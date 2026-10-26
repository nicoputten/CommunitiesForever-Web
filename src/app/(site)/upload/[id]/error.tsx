"use client";

import { usePathname } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./report.module.css";

/** The report failed to render: the centre card with a way back, never the raw error (Nico, WEB-20). */
export default function ReportError() {
  const path = usePathname();
  return (
    <div className={styles.page}>
      <PageTitle>Session report</PageTitle>
      <EmptyState title="The report didn't load" action={{ href: path, label: "Try again" }}>
        Something went wrong while reading the upload.
      </EmptyState>
    </div>
  );
}
