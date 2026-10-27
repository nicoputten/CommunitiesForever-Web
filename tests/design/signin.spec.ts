import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  TYPE,
  expectAccessible,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-17: design checks of the sign-in board and the sign-in-states board (not on the list, Battle.net didn't answer,
// signing in), each on the drifting map.

/** The refused sign-in's cookie (src/server/refused.ts), as Auth.js's signIn callback leaves it. */
async function refused(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([{ name: "cf-refused", value: "Stranger#1234", url: baseURL, httpOnly: true }]);
}

/**
 * The welcome step goes on to the map after a second. Answering that with 204 No Content keeps the browser on the
 * welcome step (a paused clock would also stop the accessibility scan's own timers).
 */
async function openWelcome(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/",
    (route) => route.fulfill({ status: 204 }),
  );
  await openScreen(page, "/signin/welcome");
}

const SCREENS = [
  { name: "signin", open: (page: Page) => openScreen(page, "/signin") },
  { name: "signin-error", open: (page: Page) => openScreen(page, "/signin?error=Configuration") },
  { name: "not-on-list", open: (page: Page) => openScreen(page, "/not-on-list") },
  { name: "signin-welcome", open: openWelcome },
];

test.beforeEach(async ({ context, baseURL }, info) => {
  if (info.title.startsWith("not-on-list")) await refused(context, baseURL!);
  if (info.title.startsWith("signin-welcome")) await signInAs(context, baseURL!, ADMIN);
});

for (const screen of SCREENS) {
  test(`${screen.name}: touch targets, fits the phone`, async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await screen.open(page);
    await expectTouchTargets(page);
    const box = await page.locator("main section").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test(`${screen.name}: accessibility`, async ({ page }) => {
    await screen.open(page);
    await expectAccessible(page);
  });

  test(`${screen.name}: reduced motion`, async ({ page }) => {
    await screen.open(page);
    await expectNoMotion(page);
  });

  test(`${screen.name}: screenshot`, async ({ page }) => {
    await screen.open(page);
    await expectScreenshot(page, screen.name);
  });
}

test("signin: design values", async ({ page }) => {
  await openScreen(page, "/signin");
  const panel = page.getByRole("region", { name: "Doombringers" });
  await expectStyles(panel, {
    "backdrop-filter": "blur(var(--blur-signin))",
    "background-color": "var(--surface-signin)",
    "border-radius": "var(--r-modal)",
    "box-shadow": "var(--shadow-modal)",
  });
  await expectStyles(page.getByRole("heading", { level: 1, name: "Doombringers" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-signin)",
    "letter-spacing": "var(--ls-display-xl)",
    color: "var(--gold-pale)",
  });
  await expectStyles(page.getByText("Where is everyone in Azeroth tonight?"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-tagline)",
    color: "var(--text-tagline)",
  });
  await expectStyles(page.getByRole("button", { name: "Sign in with Battle.net" }), {
    ...TYPE.body,
    "font-size": "var(--fs-cta)",
    "font-weight": "var(--fw-semibold)",
    "min-height": "var(--size-bnet)",
    "box-shadow": "var(--shadow-bnet)",
    color: "var(--on-bnet)",
  });
  await expectStyles(page.getByText(/^For the friends on the guest list/), { ...TYPE.meta, color: "var(--text-dim)" });
});

test("not-on-list: design values", async ({ page }) => {
  await openScreen(page, "/not-on-list");
  await expectStyles(page.getByRole("region", { name: "The gate stays closed" }), {
    "background-color": "var(--surface-modal)",
    "backdrop-filter": "blur(var(--blur-signin))",
    "border-radius": "var(--r-modal)",
    "box-shadow": "var(--shadow-signin-state)",
  });
  await expectStyles(page.getByRole("heading", { level: 1 }), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-signin-state)",
    color: "var(--text-strong)",
  });
  await expectStyles(page.getByText("Stranger#1234", { exact: true }), {
    "font-weight": "var(--fw-semibold)",
    color: "var(--text)",
  });
  await expectStyles(page.getByRole("button", { name: "Use another Battle.net account" }), {
    "font-size": "var(--fs-cta)",
    "min-height": "var(--size-cta)",
    color: "var(--gold-bright)",
  });
  await expectStyles(page.getByRole("button", { name: "Sign out" }), { ...TYPE.bodySm, color: "var(--text-dim)" });
});

test("signin-error: design values", async ({ page }) => {
  await openScreen(page, "/signin?error=Configuration");
  await expect(page.getByRole("alert", { name: "Couldn't reach Battle.net" })).toBeVisible();
  await expectStyles(page.getByRole("button", { name: "Try again" }), {
    "min-height": "var(--size-cta)",
    color: "var(--on-bnet)",
  });
});

test("signin-welcome: design values", async ({ page }) => {
  await openWelcome(page);
  await expectStyles(page.getByText(ADMIN, { exact: true }), { "font-weight": "var(--fw-semibold)", color: "var(--text)" });
  await expectStyles(page.getByText("Then straight to the map"), { ...TYPE.meta, color: "var(--text-faint)" });
});
