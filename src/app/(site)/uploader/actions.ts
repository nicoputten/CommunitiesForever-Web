"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { mayUpload } from "@/core/access";
import { cleanLabel } from "@/core/uploader";
import type { Notice } from "@/core/views/uploader";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { auth } from "@/server/auth";
import { getDb, type Db } from "@/server/db";
import { createToken, decidePairing, limits, revokeToken, TooManyTokensError } from "@/server/uploader";

// The uploader page's actions (WEB-34). Each checks again that the caller may upload (CLAUDE.md rule 6).

/** Runs `action` as someone who may upload; throws for anyone else (the page is never shown to them). */
async function asUploader<T>(action: (db: Db, battleTag: string) => T): Promise<T> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  if (battleTag === undefined || !mayUpload(battleTag, loadAccessList(db, adminBattleTag()))) {
    throw new Error("You may not upload.");
  }
  const result = action(db, battleTag);
  revalidatePath("/uploader");
  return result;
}

const to = (notice: Notice, code?: string) =>
  `/uploader?${new URLSearchParams(code === undefined ? { notice } : { code, notice }).toString()}`;

/** Allow or Deny on the pairing request (`decision` is the pressed button). */
export async function decideAction(form: FormData): Promise<void> {
  const code = String(form.get("code") ?? "");
  const allow = form.get("decision") === "allow";
  const target = await asUploader((db, battleTag): string => {
    const now = nowSeconds();
    if (limits.wrongCode.full(battleTag.toLowerCase(), now)) return to("too-many-tries");
    try {
      if (decidePairing(db, code, battleTag, allow, now)) return to(allow ? "allowed" : "denied");
    } catch (e) {
      if (e instanceof TooManyTokensError) return to("too-many", code);
      throw e;
    }
    limits.wrongCode.hit(battleTag.toLowerCase(), now);
    return to("bad-code");
  });
  redirect(target);
}

export async function revokeAction(form: FormData): Promise<void> {
  const id = Number(form.get("id"));
  await asUploader((db, battleTag) => revokeToken(db, battleTag, id, nowSeconds()));
}

/** What "Create a token by hand" shows: an error, or the token, once. */
export interface TokenState {
  error?: string;
  token?: string;
  name?: string;
}

export async function createTokenAction(_prev: TokenState, form: FormData): Promise<TokenState> {
  const name = cleanLabel(form.get("name"));
  if (name === undefined) return { error: "Give it a name, like Gaming PC." };
  try {
    const { token } = await asUploader((db, battleTag) =>
      createToken(db, battleTag, name, null, "manual", nowSeconds()),
    );
    return { token, name };
  } catch (e) {
    if (e instanceof TooManyTokensError) return { error: "You have 5 uploaders. Revoke one first." };
    throw e;
  }
}
