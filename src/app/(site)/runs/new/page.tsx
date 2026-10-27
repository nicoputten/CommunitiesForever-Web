import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { planPage } from "@/core/views/runs";
import { PlanForm } from "@/components/runs/PlanForm";
import styles from "@/components/runs/Runs.module.css";
import { PageTitle } from "@/components/ui/PageTitle";
import { getDb } from "@/server/db";
import { postsTo, runsInput } from "@/server/runsInput";
import { planAction } from "../actions";

export const metadata: Metadata = { title: "Plan a run" };

/** Plan a run (WEB-40, board `run-create`); `?dungeon=` fills in the dungeon (a roster band, a dungeon page). */
export default async function PlanRunPage({ searchParams }: { searchParams: Promise<{ dungeon?: string }> }) {
  const viewer = await getViewer();
  if (viewer === undefined) notFound();
  const db = getDb();
  const page = planPage(runsInput(db, viewer.battleTag, nowSeconds()), (await searchParams).dungeon);
  return (
    <div className={styles.plan}>
      <p className={styles.crumbs}>
        <Link href="/runs">Runs</Link> › Plan a run
      </p>
      <PageTitle>Plan a run</PageTitle>
      <PlanForm page={page} action={planAction} postsTo={postsTo(db)} />
    </div>
  );
}
