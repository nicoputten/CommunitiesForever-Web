import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-17: the sign-in screens at desktop and phone size. Battle.net is never called: its authorize URL is caught.

/** Catches the redirect to Battle.net and returns the authorize URL it would have opened. */
function catchBattleNet(page: import("@playwright/test").Page): () => URL | undefined {
  let authorize: URL | undefined;
  void page.route("https://eu.battle.net/**", async (route) => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "Battle.net" });
  });
  return () => authorize;
}

test("sign-in shows the site name, the question and the Battle.net button", async ({ page }) => {
  await page.goto("/signin");
  const name = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  expect(name).not.toBe("");
  await expect(page).toHaveTitle(`Sign in · ${name}`);
  await expect(page.getByText("Where is everyone in Azeroth tonight?")).toBeVisible();
  await expect(page.getByText("We only read your BattleTag, nothing else.", { exact: false })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("after Battle.net, the sign-in goes through the welcome step to the page asked for", async ({ page }) => {
  const authorize = catchBattleNet(page);
  await page.goto("/roster");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Froster$/);
  await page.getByRole("button", { name: "Sign in with Battle.net" }).click();
  await expect.poll(() => authorize()?.pathname).toBe("/oauth/authorize");
  // Auth.js keeps where to go after the callback in a cookie: the welcome step, then the roster.
  const callback = (await page.context().cookies()).find((c) => c.name.endsWith("authjs.callback-url"));
  expect(decodeURIComponent(callback?.value ?? "")).toMatch(/\/signin\/welcome\?to=%2Froster$/);
});

test("the welcome step shows who came back, then goes on", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/signin/welcome?to=%2Froster");
  await expect(page.getByRole("status")).toContainText(`Back from Battle.net as ${E2E.admin}`);
  await expect(page).toHaveURL(/\/roster$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roster");
});

test("the welcome step never goes to another site", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/signin/welcome?to=%2F%2Fexample.com");
  await expect(page.getByText("Then straight to the map")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/$`));
});

test("the welcome step needs a session", async ({ page }) => {
  await page.goto("/signin/welcome");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fsignin%2Fwelcome$/);
});

test("Battle.net didn't answer: try again starts a new sign-in", async ({ page }) => {
  const authorize = catchBattleNet(page);
  await page.goto("/signin?error=Configuration");
  await expect(page.getByRole("alert", { name: "Couldn't reach Battle.net" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => authorize()?.pathname).toBe("/oauth/authorize");
});

test("a refusal sent back to sign-in goes to not on the list", async ({ page }) => {
  await page.goto("/signin?error=AccessDenied");
  await expect(page).toHaveURL(/\/not-on-list$/);
});

test.describe("not on the list", () => {
  test("names the refused BattleTag and the admin", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cf-refused", value: "Stranger#1234", url: baseURL!, httpOnly: true }]);
    await page.goto("/not-on-list");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The gate stays closed");
    await expect(page.getByText(/^Stranger#1234 isn't on the .+ guest list\.$/)).toBeVisible();
    // The admin's name is the part of ADMIN_BATTLETAG before the #.
    await expect(page.getByText(/^Send Admin your BattleTag and he can add you\./)).toBeVisible();
  });

  test("shows a cookie that isn't a BattleTag as nothing", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cf-refused", value: "<b>hi</b>", url: baseURL!, httpOnly: true }]);
    await page.goto("/not-on-list");
    await expect(page.getByText(/^This BattleTag isn't on the .+ guest list\.$/)).toBeVisible();
  });

  test("sign out forgets the BattleTag and goes back to sign-in", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cf-refused", value: "Stranger#1234", url: baseURL!, httpOnly: true }]);
    await page.goto("/not-on-list");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signin$/);
    expect((await context.cookies()).some((c) => c.name === "cf-refused")).toBe(false);
  });

  test("another account asks Battle.net for its login form", async ({ page, context, baseURL }) => {
    const authorize = catchBattleNet(page);
    await signInAs(context, baseURL!, "Stranger#9999");
    await page.goto("/not-on-list");
    await page.getByRole("button", { name: "Use another Battle.net account" }).click();
    await expect.poll(() => authorize()?.searchParams.get("prompt")).toBe("login");
    expect((await context.cookies()).some((c) => c.name.endsWith("authjs.session-token"))).toBe(false);
  });
});
