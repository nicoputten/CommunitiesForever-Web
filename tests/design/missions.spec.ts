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
// `mission-pool-states`; v2 WEB-109: `mission-pool-v2-overview`, `mission-pool-v2-hunt`) on the sample data: the page, a free day's editor and a locked day. Read only, so the
// desktop and phone projects can run side by side.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

/**
 * Today's and tomorrow's tiles keep the board's 60 % opacity (`--opacity-locked`), below AA contrast: Nico's decision
 * 2026-11-10 (WEB-109, docs/DESIGN.md "Deviations"), so the contrast check leaves those two tiles out.
 */
const LOCKED_TILES = ['[data-testid="mission-day"][data-locked]'];

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
  await expectAccessible(page, [], LOCKED_TILES);
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

/** WEB-109: the recipe bar, today's quarry, 6-line days (board `mission-pool-v2-overview`). */
test("missions: recipe bar, quarry, day lines", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  const tiles = page.getByRole("list", { name: "Missions" }).getByRole("listitem");
  await expect(tiles).toHaveCount(6);
  await expectStyles(tiles.first(), {
    "background-color": "var(--surface-goal)",
    "border-radius": "var(--r-btn)",
  });
  await expectStyles(tiles.filter({ hasText: "Bounty" }), { "border-color": "var(--warn-tile-line)" });
  await expectStyles(tiles.filter({ hasText: "The Hunt" }), { "border-color": "var(--line-hunt)" });
  const quarry = page.getByTestId("quarry");
  await expectStyles(quarry, { "border-radius": "var(--r-quarry)", "border-color": "var(--line-hunt)" });
  await expectStyles(quarry.getByRole("heading", { level: 2 }), {
    "font-size": "var(--fs-kicker)",
    color: "var(--pvp-text)",
  });
  await expect(quarry.getByRole("list", { name: "Next 7 days" }).getByRole("listitem")).toHaveCount(7);
  await expect(quarry.getByRole("link", { name: "Hunt targets ›" })).toBeVisible();
  const day = page.getByTestId("mission-day").nth(3);
  await expectStyles(day.locator("span").filter({ has: page.locator("svg") }).last(), {
    color: "var(--hunt-text)",
    "font-weight": "var(--fw-semibold)",
  });
});

/** WEB-109: the pool as themes, one open (board `mission-pool-v2-overview`). */
test("missions: theme cards and an open theme", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  const pool = page.getByRole("region", { name: "The pool" });
  const cards = pool.getByTestId("theme-card");
  await expect(cards).toHaveCount(9);
  await expectStyles(cards.first(), { "border-color": "var(--gold)", "border-radius": "var(--r-card)" });
  await expectStyles(cards.nth(1), { "border-color": "var(--line-goal)" });
  await cards.nth(6).click();
  await expect(cards.nth(6)).toHaveAttribute("aria-expanded", "true");
  await expect(pool.getByTestId("theme-list").getByRole("heading", { level: 3 })).toHaveText(/^Skirmish · \d+$/);
  await expectAccessible(page, [], LOCKED_TILES);
  if (isPhone(page)) await expectTouchTargets(page);
});

test("missions: an open theme, screenshot", async ({ page }) => {
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  await openScreen(page, "/admin/missions");
  await expect(page.getByRole("region", { name: "The pool" })).toHaveScreenshot("missions-pool.png");
});

/** WEB-109: the Hunt targets (board `mission-pool-v2-hunt`): a grid on a desktop, a list per race on a phone. */
test("missions: Hunt targets", async ({ page }) => {
  await openScreen(page, "/admin/missions/hunt");
  const box = page.getByRole("region", { name: "Hunt targets" });
  await expect(box.getByRole("button", { name: /^Horde hunts · Alliance targets/, pressed: true })).toBeVisible();
  await expect(box.getByText(/^Everloot census · active/)).toBeVisible();
  await expect(box.getByRole("link", { name: "everloot.app/census" })).toHaveAttribute(
    "href",
    "https://everloot.app/census",
  );
  if (isPhone(page)) {
    await expect(box.getByTestId("target-grid")).toBeHidden();
    await expectStyles(box.getByRole("heading", { level: 3, name: "Human" }), {
      "font-family": "var(--font-display)",
      color: "var(--gold-bright)",
    });
    await expectTouchTargets(page);
  } else {
    const grid = box.getByTestId("target-grid");
    await expect(grid.getByRole("columnheader")).toHaveCount(9);
    const cell = grid.getByRole("switch").first();
    await expectStyles(cell, {
      "border-radius": "var(--r-btn)",
      "border-color": "var(--line-cell)",
      "background-color": "var(--tint-cell)",
    });
    await cell.hover();
    await expect(grid.getByRole("tooltip").first()).toBeVisible();
  }
  await expectAccessible(page, [], LOCKED_TILES);
});

test("missions: Hunt targets, screenshot", async ({ page }) => {
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  await openScreen(page, "/admin/missions/hunt");
  await expectScreenshot(page, "missions-hunt-targets");
});

test("missions: a locked day", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  const href = await page.getByTestId("mission-day").first().getAttribute("href");
  await openScreen(page, `/admin/missions${href!.replace(/#.*$/, "")}`);
  await expect(page.locator("#editor")).toContainText("Locked");
  await expect(page.locator("#editor").getByRole("button")).toHaveCount(0);
});
