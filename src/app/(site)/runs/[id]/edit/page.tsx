import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { mayEdit, runDungeon } from "@/core/runs";
import { localDate, localTime } from "@/core/runTime";
import { planPage } from "@/core/views/runs";
import { PlanForm } from "@/components/runs/PlanForm";
import styles from "@/components/runs/Runs.module.css";
import { PageTitle } from "@/components/ui/PageTitle";
import { getDb } from "@/server/db";
import { getRun } from "@/server/runs";
import { postsTo, runsInput } from "@/server/runsInput";
import { editAction } from "../../actions";

export const metadata: Metadata = { title: "Edit run" };

/** Edit run (WEB-40): the organiser changes day, time and note (another dungeon is another run). */
export default async function EditRunPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const id = Number((await params).id);
  const db = getDb();
  const run = Number.isInteger(id) ? getRun(db, id) : undefined;
  const now = nowSeconds();
  if (viewer === undefined || run === undefined || !mayEdit(run, viewer.battleTag)) notFound();
  if (run.cancelledAt !== undefined || now >= run.startsAt) notFound();
  const input = runsInput(db, viewer.battleTag, now);
  const tz = input.viewer.timeZone;
  return (
    <div className={styles.plan}>
      <p className={styles.crumbs}>
        <Link href="/runs">Runs</Link> › <Link href={`/runs/${id}`}>{runDungeon(run.dungeonId)?.name}</Link> › Edit
      </p>
      <PageTitle>Edit run</PageTitle>
      <PlanForm
        page={planPage(input, run.dungeonId)}
        action={editAction.bind(null, id)}
        postsTo={postsTo(db)}
        edit={{
          dungeonId: run.dungeonId,
          date: localDate(run.startsAt, tz),
          time: localTime(run.startsAt, tz),
          note: run.note ?? "",
          cancelHref: `/runs/${id}`,
        }}
      />
    </div>
  );
}
