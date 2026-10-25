"use server";

import { redirect } from "next/navigation";

/** Sign out. STUB until WEB-06, which replaces the body with Auth.js signOut(). */
export async function signOut(): Promise<void> {
  redirect("/");
}
