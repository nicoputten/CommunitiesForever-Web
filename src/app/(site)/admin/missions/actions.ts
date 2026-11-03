"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isOwner } from "@/core/access";
import type { Often, Period } from "@/core/doomsday/missionPool";
import { nowSeconds } from "@/app/clock";
import { AccessError, adminBattleTag, loadAccessList } from "@/server/access";
import { OwnerOnlyError } from "@/server/admins";
import { auth } from "@/server/auth";
import { getDb, type Db } from "@/server/db";
import {
  backToNormal,
  MissionLockedError,
  pinMission,
  rerollDay,
  rerollMission,
  setMission,
} from "@/server/missionPool";

// The Mission pool page's actions (WEB-79): the owner only. Each checks again who the caller is (CLAUDE.md rule 6);
// the server functions (WEB-78) check the owner and the lock window once more. A refusal goes back to the page as a
// line, never half done.

const PAGE = "/admin/missions";

/** Where the page was: the open day or week, kept after a change or a refusal. */
function back(form: FormData, refused?: string): string {
  const q = new URLSearchParams();
  const period = form.get("period");
  if (period === "day" || period === "week") q.set(period, String(form.get("n") ?? ""));
  if (refused !== undefined) q.set("refused", refused);
  const s = q.toString();
  return s === "" ? PAGE : `${PAGE}?${s}`;
}

async function asOwner(form: FormData, action: (db: Db, by: string, now: number) => void): Promise<void> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  if (battleTag === undefined || !isOwner(battleTag, loadAccessList(db, adminBattleTag())))
    redirect(back(form, "owner-only"));
  let refused: string | undefined;
  try {
    action(db, battleTag, nowSeconds());
  } catch (e) {
    if (e instanceof MissionLockedError) refused = "locked";
    else if (e instanceof OwnerOnlyError) refused = "owner-only";
    else if (e instanceof AccessError) refused = "mission";
    else throw e;
  }
  revalidatePath(PAGE);
  revalidatePath("/admin");
  if (refused !== undefined) redirect(back(form, refused));
}

function target(form: FormData): { period: Period; n: number; slot: number } {
  const period: Period = form.get("period") === "week" ? "week" : "day";
  return { period, n: Number(form.get("n")), slot: Number(form.get("slot")) };
}

/** On or off: the form sends the new state. */
export async function setOffAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const off = form.get("off") === "true";
  await asOwner(form, (db, by, now) => setMission(db, by, id, { off }, now));
}

export async function setOftenAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const often = String(form.get("often") ?? "") as Often;
  await asOwner(form, (db, by, now) => setMission(db, by, id, { often }, now));
}

export async function pinAction(form: FormData): Promise<void> {
  const t = target(form);
  const id = String(form.get("id") ?? "");
  await asOwner(form, (db, by, now) => pinMission(db, by, t.period, t.n, t.slot, id, now));
}

export async function rerollAction(form: FormData): Promise<void> {
  const t = target(form);
  await asOwner(form, (db, by, now) => rerollMission(db, by, t.period, t.n, t.slot, now));
}

export async function rerollDayAction(form: FormData): Promise<void> {
  const t = target(form);
  await asOwner(form, (db, by, now) => rerollDay(db, by, t.period, t.n, now));
}

export async function backToNormalAction(form: FormData): Promise<void> {
  const t = target(form);
  await asOwner(form, (db, by, now) => backToNormal(db, by, t.period, t.n, now));
}
