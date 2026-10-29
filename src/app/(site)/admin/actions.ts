"use server";

import { revalidatePath } from "next/cache";
import { mayAdmin } from "@/core/access";
import { nowSeconds } from "@/app/clock";
import {
  AccessError,
  addGuest,
  adminBattleTag,
  block,
  loadAccessList,
  putGuest,
  removeGuest,
  unblock,
} from "@/server/access";
import { auth } from "@/server/auth";
import { CUTOFF_CONFIRM } from "@/core/cutoff";
import { clearCutoff, storeCutoff } from "@/server/cutoff";
import { getDb, type Db } from "@/server/db";
import { rebuild } from "@/server/uploads";

// The admin page's actions (WEB-18). Each checks again that the caller is the admin (CLAUDE.md rule 6); the
// /api/admin routes stay for scripts.

/** What the add-guest form shows after a try: an error, or who was added (the field then clears). */
export interface AddGuestState {
  error?: string;
  added?: string;
}

/** Runs `action` as the admin; throws for anyone else (the page is never shown to them). */
async function asAdmin<T>(action: (db: Db, admin: string) => T): Promise<T> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  if (battleTag === undefined || !mayAdmin(battleTag, loadAccessList(db, adminBattleTag()))) {
    throw new Error("Only the admin may do this.");
  }
  const result = action(db, battleTag);
  revalidatePath("/admin");
  return result;
}

const tagOf = (form: FormData) => String(form.get("battleTag") ?? "");

export async function addGuestAction(_prev: AddGuestState, form: FormData): Promise<AddGuestState> {
  const battleTag = tagOf(form).trim();
  if (battleTag === "") return { error: "Type a BattleTag (Name#1234)." };
  try {
    const guest = await asAdmin((db, by) => addGuest(db, battleTag, form.get("mayUpload") === "on", by, nowSeconds()));
    return { added: guest.battleTag };
  } catch (e) {
    if (e instanceof AccessError) return { error: e.message };
    throw e;
  }
}

export async function setMayUploadAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => putGuest(db, tagOf(form), form.get("mayUpload") === "true", by, nowSeconds()));
}

export async function removeGuestAction(form: FormData): Promise<void> {
  await asAdmin((db) => removeGuest(db, tagOf(form)));
}

export async function blockAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => block(db, tagOf(form), by, nowSeconds()));
}

export async function unblockAction(form: FormData): Promise<void> {
  await asAdmin((db) => unblock(db, tagOf(form)));
}

// --- the launch cut-off (WEB-62) ---------------------------------------------------------------------------------

/**
 * "Start fresh from launch": the cut-off is now, then a rebuild from the uploads after it. Nothing is deleted. Only
 * with the confirmation typed exactly; anything else changes nothing.
 */
export async function startFreshAction(form: FormData): Promise<void> {
  if (String(form.get("confirm") ?? "").trim() !== CUTOFF_CONFIRM) return;
  await asAdmin((db, by) => {
    const now = nowSeconds();
    storeCutoff(db, now, by, now);
    rebuild(db);
  });
  // Every page shows the data again from the cut-off.
  revalidatePath("/", "layout");
}

/** Undo: the cut-off goes, and a rebuild brings everything back as it was. */
export async function undoStartFreshAction(): Promise<void> {
  await asAdmin((db) => {
    clearCutoff(db);
    rebuild(db);
  });
  revalidatePath("/", "layout");
}
