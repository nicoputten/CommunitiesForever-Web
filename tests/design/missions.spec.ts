import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  TYPE,
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-79: design checks of the owner's Mission pool (boards `mission-pool`, `mission-pool-steering`,
// `mission-pool-states`) on the sample data: the page, a free day's editor and a locked day. Read only, so the
// desktop and phone projects can run side by side.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

/**
 * Dimmed by design, below AA contrast: today's and tomorrow's tiles and Off missions' rows (Nico 2026-11-10, WEB-109's
 * docs/DESIGN.md "Deviations"), left out of the contrast check. The last selector is the current page's Off rows
 * (pool 6's check missions start Off, WEB-108) until WEB-109's page replaces it.
 */
const DIMMED_BY_DESIGN = ['[data-testid="mission-day"][data-locked]', '[data-testid="theme-list"] [data-off]', "[data-off]"];

/** The fourth day shown: free (today and tomorrow are locked). */
async function freeDay(page: import("@playwright/test").Page): Promise<string> {
  await openScreen(page, "/admin/missions");
  const href = await page.getByTestId("mission-day").nth(3).getAttribute("href");
  return `/admin/missions${href!.replace(/#.*$/, "")}`;
}

test("missions: design values", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const days = page.getByRole("region", { name: "Next 14 days" });
  await expectStyles(days, { "border-radius": "var(--r-panel)", "background-color": "var(--surface-box)" });
  await expectStyles(days.getByRole("heading", { name: "Next 14 days" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  await expectStyles(page.getByTestId("mission-day").first(), {
    "background-color": "var(--surface-day-locked)",
    opacity: "var(--opacity-locked)",
    "border-radius": "var(--r-btn)",
  });
  await expectStyles(page.getByTestId("mission-day").nth(3), { "background-color": "var(--surface-goal)" });
  const pool = page.getByRole("region", { name: "The pool" });
  if (!isPhone(page)) {
    await expectStyles(pool.getByRole("columnheader", { name: "Mission" }), {
      "font-size": "var(--fs-meta-sm)",
      color: "var(--text-faint)",
    });
    await expectStyles(pool.getByRole("switch").first().locator("span"), { "background-color": "var(--gold)" });
  }
  await expectStyles(pool.getByRole("button", { name: "Normal", pressed: true }).locator("visible=true").first(), {
    "background-color": "var(--tint-selected)",
    color: "var(--text-strong)",
  });
});

test("missions: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, await freeDay(page));
  await expectTouchTargets(page);
});

test("missions: accessibility", async ({ page }) => {
  await openScreen(page, await freeDay(page));
  await expectAccessible(page, [], DIMMED_BY_DESIGN);
});

test("missions: reduced motion", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectNoMotion(page);
});

test("missions: screenshot", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectScreenshot(page, "missions");
});

test("missions: a free day's editor", async ({ page }) => {
  await openScreen(page, await freeDay(page));
  const editor = page.locator("#editor");
  await expect(editor.getByRole("button", { name: "Reroll day" })).toBeVisible();
  await expectStyles(editor, { "border-color": "var(--gold)" });
  await expectScreenshot(page, "missions-day");
});

test("missions: a locked day", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  const href = await page.getByTestId("mission-day").first().getAttribute("href");
  await openScreen(page, `/admin/missions${href!.replace(/#.*$/, "")}`);
  await expect(page.locator("#editor")).toContainText("Locked");
  await expect(page.locator("#editor").getByRole("button")).toHaveCount(0);
});
