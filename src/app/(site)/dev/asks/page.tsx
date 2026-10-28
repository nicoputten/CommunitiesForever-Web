import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { isAdmin } from "@/app/viewer";
import { AsksNow } from "@/components/runs/AsksNow";
import styles from "@/components/runs/Runs.module.css";
import { PageTitle } from "@/components/ui/PageTitle";
import { sampleAsks } from "./sample";

export const metadata: Metadata = { title: "Asking now states" };

/**
 * Asking now's states for the design checks (WEB-51, board asks-now-states), as /dev/components is for the shared
 * components: fixed, so no countdown runs and an answer doesn't go through. Admin only.
 */
export default async function AsksStatesPage() {
  if (!(await isAdmin())) notFound();
  const now = nowSeconds();
  return (
    <div className={styles.main}>
      <PageTitle sub="WEB-51: one with a default character, answered, the last minute, none fit, your own ask.">
        Asking now states
      </PageTitle>
      <AsksNow asks={sampleAsks(now)} now={now} frozen />
    </div>
  );
}
