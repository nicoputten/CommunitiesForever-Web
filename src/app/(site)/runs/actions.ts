"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { mayAdmin, roleOf } from "@/core/access";
import { zonedToUtc } from "@/core/runTime";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { auth } from "@/server/auth";
import { refusalText } from "@/server/botRuns";
import { getDb } from "@/server/db";
import { effectiveTimeZone } from "@/server/discord";
import { cancelRun, editRun, planRunFor } from "@/server/runs";

// The Runs pages' actions (WEB-40). Each checks the caller again (CLAUDE.md rule 6): anyone on the list plans and
// answers; the organiser edits; the organiser or the admin deletes. Server actions carry Next.js's Origin check.

export interface FormState {
  error?: string;
}

async function caller() {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  if (battleTag === undefined || roleOf(battleTag, list) === undefined) throw new Error("Sign in.");
  return { db, battleTag, isAdmin: mayAdmin(battleTag, list), timeZone: effectiveTimeZone(db, battleTag) };
}

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
};

/** The day (a chip or "Other date…") and time as typed, in the viewer's zone. */
function startFrom(form: FormData, timeZone: string): number | undefined {
  const day = text(form, "day") === "other" ? text(form, "otherDay") : text(form, "day");
  const time = text(form, "time");
  return day === undefined || time === undefined ? undefined : zonedToUtc(day, time, timeZone);
}

export async function planAction(_: FormState, form: FormData): Promise<FormState> {
  const { db, battleTag, timeZone } = await caller();
  const startsAt = startFrom(form, timeZone);
  if (startsAt === undefined) return { error: "Pick a day and a time." };
  const lead = text(form, "lead");
  const planned = planRunFor(
    db,
    {
      dungeonId: text(form, "dungeon") ?? "",
      startsAt,
      note: text(form, "note"),
      organiser: battleTag,
      source: "website",
      ...(lead === undefined || lead === "" ? {} : { leadGuid: lead }),
    },
    nowSeconds(),
  );
  if (typeof planned === "string") return { error: refusalText(planned)[1] };
  revalidatePath("/runs");
  redirect(`/runs/${planned.id}`);
}

export async function editAction(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { db, battleTag, timeZone } = await caller();
  const startsAt = startFrom(form, timeZone);
  if (startsAt === undefined) return { error: "Pick a day and a time." };
  const edited = editRun(db, id, battleTag, { startsAt, note: text(form, "note") ?? "" }, nowSeconds());
  if (typeof edited === "string") return { error: refusalText(edited)[1] };
  revalidatePath("/runs");
  redirect(`/runs/${id}`);
}

export async function deleteAction(id: number): Promise<void> {
  const { db, battleTag, isAdmin } = await caller();
  const result = cancelRun(db, id, battleTag, isAdmin, nowSeconds());
  if (typeof result === "string" && result !== "already_cancelled") throw new Error(refusalText(result)[1]);
  revalidatePath("/runs");
  redirect(`/runs/${id}`);
}
