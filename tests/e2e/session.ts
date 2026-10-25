import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { E2E } from "../../playwright.config";

const COOKIE = "authjs.session-token";

/** Signs the browser in as a BattleTag the way Auth.js would after a Battle.net sign-in, without Battle.net. */
export async function signInAs(context: BrowserContext, baseURL: string, battleTag: string): Promise<void> {
  const value = await encode({ token: { battleTag, name: battleTag }, secret: E2E.secret, salt: COOKIE });
  await context.addCookies([{ name: COOKIE, value, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
