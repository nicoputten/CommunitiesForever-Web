"use server";

import { signOut as authSignOut } from "@/server/auth";

/** Sign out (user menu): ends the Auth.js session and goes to sign-in. */
export async function signOut(): Promise<void> {
  await authSignOut({ redirectTo: "/signin" });
}
