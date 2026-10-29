"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { battleTagName, isAppointedAdmin, isOwner, mayAdmin } from "@/core/access";
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
import { appointAdmin, logChange, OwnerOnlyError, removeAdmin, revokeAnyDevice } from "@/server/admins";
import { auth } from "@/server/auth";
import { CUTOFF_CONFIRM } from "@/core/cutoff";
import { clearCutoff, storeCutoff } from "@/server/cutoff";
import { getDb, type Db } from "@/server/db";
import { rebuild } from "@/server/uploads";

// The admin page's actions (WEB-18; owner and admins since WEB-64). Each checks again who the caller is (CLAUDE.md
// rule 6): admins run the group, the owner alone appoints admins, starts fresh from launch and revokes others'
// uploader devices. A refusal goes back to the page as a line, never half done; someone who lost the admin role
// meanwhile lands on the Discord page with a note. Every change goes in the admin changes log. The /api/admin routes
// stay for scripts.

/** What the add-guest form shows after a try: an error, or who was added (the field then clears). */
export interface AddGuestState {
  error?: string;
  added?: string;
}

/**
 * Runs `action` as an admin (or, with `owner`, as the owner only). Someone who isn't an admin (any more) goes to the
 * Discord page; an owner-only action by an admin goes back to the admin page with the reason.
 */
async function asAdmin<T>(action: (db: Db, by: string) => T, owner = false): Promise<T> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  if (battleTag === undefined || !mayAdmin(battleTag, list)) redirect("/discord?notice=admin-removed");
  if (owner && !isOwner(battleTag, list)) redirect("/admin?refused=owner-only");
  let result: T;
  try {
    result = action(db, battleTag);
  } catch (e) {
    if (e instanceof OwnerOnlyError) redirect("/admin?refused=owner-only");
    throw e;
  }
  revalidatePath("/admin");
  return result;
}

const tagOf = (form: FormData) => String(form.get("battleTag") ?? "");

export async function addGuestAction(_prev: AddGuestState, form: FormData): Promise<AddGuestState> {
  const battleTag = tagOf(form).trim();
  if (battleTag === "") return { error: "Type a BattleTag (Name#1234)." };
  try {
    const guest = await asAdmin((db, by) => {
      const now = nowSeconds();
      const g = addGuest(db, battleTag, form.get("mayUpload") === "on", by, now);
      logChange(db, by, "guestAdded", now, g.battleTag);
      return g;
    });
    return { added: guest.battleTag };
  } catch (e) {
    if (e instanceof AccessError) return { error: e.message };
    throw e;
  }
}

export async function setMayUploadAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => {
    const now = nowSeconds();
    const may = form.get("mayUpload") === "true";
    putGuest(db, tagOf(form), may, by, now);
    logChange(db, by, "guestChanged", now, tagOf(form), may ? "may upload" : "may not upload");
  });
}

export async function removeGuestAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => {
    if (removeGuest(db, tagOf(form))) logChange(db, by, "guestRemoved", nowSeconds(), tagOf(form));
  });
}

export async function blockAction(form: FormData): Promise<void> {
  const tag = tagOf(form);
  const refused = await asAdmin((db, by) => {
    try {
      const now = nowSeconds();
      block(db, tag, by, now);
      logChange(db, by, "blocked", now, tag);
      return undefined;
    } catch (e) {
      if (e instanceof AccessError) return { admin: isAppointedAdmin(tag, loadAccessList(db, adminBattleTag())) };
      throw e;
    }
  });
  // A stale Block button on the owner or an admin (WEB-64): refused, with the reason.
  if (refused !== undefined) {
    redirect(`/admin?refused=cant-block${refused.admin ? `&who=${encodeURIComponent(battleTagName(tag))}` : ""}`);
  }
}

export async function unblockAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => {
    if (unblock(db, tagOf(form))) logChange(db, by, "unblocked", nowSeconds(), tagOf(form));
  });
}

// --- co-admins (WEB-64): the owner only ------------------------------------------------------------------------------

export async function makeAdminAction(form: FormData): Promise<void> {
  const refusal = await asAdmin((db, by) => {
    try {
      appointAdmin(db, tagOf(form), by, nowSeconds());
      return undefined;
    } catch (e) {
      if (e instanceof OwnerOnlyError) throw e;
      if (e instanceof AccessError) return e.message.includes("first sign-in") ? "not-signed-in-yet" : "cant-sign-in";
      throw e;
    }
  }, true);
  if (refusal !== undefined) redirect(`/admin?refused=${refusal}`);
}

export async function removeAdminAction(form: FormData): Promise<void> {
  await asAdmin((db, by) => removeAdmin(db, tagOf(form), by, nowSeconds()), true);
}

/** The owner revokes any friend's uploader device (the "Uploader devices" box). */
export async function revokeDeviceAction(form: FormData): Promise<void> {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  await asAdmin((db, by) => revokeAnyDevice(db, id, by, nowSeconds()), true);
}

// --- the launch cut-off (WEB-62; the owner only since WEB-64) --------------------------------------------------------

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
    logChange(db, by, "cutoff", now);
  }, true);
  // Every page shows the data again from the cut-off.
  revalidatePath("/", "layout");
}

/** Undo: the cut-off goes, and a rebuild brings everything back as it was. */
export async function undoStartFreshAction(): Promise<void> {
  await asAdmin((db, by) => {
    clearCutoff(db);
    rebuild(db);
    logChange(db, by, "cutoffUndone", nowSeconds());
  }, true);
  revalidatePath("/", "layout");
}
