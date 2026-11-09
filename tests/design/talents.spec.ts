import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  expectAccessible,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-100 (board talent-tooltips, WB100): the talent tooltips on the character page. Ves Doombringer syncs the nodes
// (sample.ts, sampleTalents.ts): B with the grid ("B+", next to the list on a desktop, above it in the phone sheet).
// Grom Ashfeller sends points per tree only, as every addon release does: A.

const VES = "/character/Player-1-0000A001";
const GROM = "/character/Player-1-0000A002";

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

/** Hovers (desktop) or taps (phone) a tree's row; returns the tooltip. */
async function openTree(page: Page, url: string, tree: RegExp) {
  await openScreen(page, url);
  const row = page.getByRole("region", { name: "Talents" }).getByRole("button", { name: tree });
  if (isPhone(page)) await row.click();
  else await row.hover();
  const tip = page.getByTestId("talent-tooltip");
  await expect(tip).toBeVisible();
  // The short fade every change gets with reduced motion (globals.css) has ended.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  return { tip };
}

test("talents B+: design values", async ({ page }) => {
  const { tip } = await openTree(page, VES, /^Destruction/);
  // The open row (a phone's sheet hides the page from the accessibility tree, so not by role).
  const row = page.locator("button[data-open]");
  await expect(row).toHaveText(/^Destruction/);
  await expectStyles(row, {
    "background-color": "var(--tint-talent-row)",
    "box-shadow": "var(--ring-talent-row)",
    "border-radius": "var(--r-talent-row)",
    "min-height": isPhone(page) ? "var(--size-touch)" : "var(--size-talent-row)",
  });
  await expectStyles(tip, {
    "background-image": "var(--surface-game)",
    "border-top-color": "var(--line-game)",
    "border-radius": "var(--r-game)",
    "font-size": "var(--fs-game)",
    color: "var(--game-text)",
    ...(!isPhone(page) && { width: "var(--size-talent-tooltip-grid)" }),
  });
  await expectStyles(tip.getByText("Destruction", { exact: true }), {
    "font-size": "var(--fs-section)",
    "font-weight": "var(--fw-semibold)",
    color: "var(--warlock-text)",
  });
  await expect(tip.getByText("20 points", { exact: true })).toBeVisible();
  // The talents with points in tree order, rank in the game's yellow, the text.
  await expect(tip).toHaveText(/Improved Shadow Bolt5\/5.+Bane5\/5.+Cataclysm3\/3.+Aftermath2\/5.+Ruin5\/5/);
  await expectStyles(tip.getByText("Improved Shadow Bolt"), { "font-weight": "var(--fw-semibold)" });
  await expectStyles(tip.getByText("2/5", { exact: true }).last(), { color: "var(--game-yellow)" });
  await expectStyles(tip.getByText(/^Gives your Destruction spells/), {
    color: "var(--game-yellow)",
    opacity: "var(--opacity-talent-text)",
  });
  // The grid: 4 × 7, full gold, partial green, rows not reached faded.
  const grid = tip.getByTestId("talent-grid");
  await expect(grid.locator("[data-state]")).toHaveCount(16);
  await expectStyles(grid.locator('[data-state="full"]').first(), {
    width: "var(--size-talent-icon)",
    "border-top-color": "var(--gold-bright)",
    "background-image": "var(--talent-icon-taken)",
  });
  await expectStyles(grid.locator('[data-state="partial"]'), { "border-top-color": "var(--game-green)" });
  await expectStyles(grid.locator('[data-state="open"]').first(), {
    "border-top-color": "var(--line-talent-icon)",
    "background-image": "var(--talent-icon)",
  });
  await expectStyles(grid.locator('[data-state="locked"]').first(), { opacity: "var(--opacity-talent-locked)" });
  await expectStyles(grid.locator("b").first(), {
    "font-size": "var(--fs-talent-rank)",
    color: "var(--talent-rank-text)",
  });
});

test("talents B+: a grid talent's own tooltip on hover", async ({ page }) => {
  test.skip(isPhone(page), "hover");
  const { tip } = await openTree(page, VES, /^Destruction/);
  await tip.getByRole("img", { name: /^Bane of Havoc 0\/1/ }).hover();
  await expect(page.getByText("Made-up text for Bane of Havoc.")).toBeVisible();
});

test("talents B: a tree without points shows 0 points and its grid", async ({ page }) => {
  const { tip } = await openTree(page, VES, /^Demonology/);
  await expect(tip.getByText("0 points", { exact: true })).toBeVisible();
  await expect(tip.getByTestId("talent-grid").locator('[data-state="open"]')).toHaveCount(4);
});

test("talents A: the tree's name and points only", async ({ page }) => {
  const { tip } = await openTree(page, GROM, /^Protection/);
  await expect(tip).toHaveText(/^Protection10 points$/);
  await expectStyles(tip, isPhone(page) ? { "font-size": "var(--fs-game)" } : { width: "var(--size-talent-tooltip)" });
  await expectStyles(tip.getByText("Protection", { exact: true }), { color: "var(--warrior)" });
});

test("talents: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openTree(page, VES, /^Destruction/);
  await expectTouchTargets(page);
});

test("talents: accessibility", async ({ page }) => {
  await openTree(page, VES, /^Destruction/);
  await expectAccessible(page);
});

test("talents: reduced motion", async ({ page }) => {
  await openTree(page, VES, /^Destruction/);
  await expectNoMotion(page);
});

test("talents B+: screenshot", async ({ page }) => {
  await openTree(page, VES, /^Destruction/);
  await expectScreenshot(page, "talents-b-grid", [], async () => {
    await openTree(page, VES, /^Destruction/);
  });
});

test("talents A: screenshot", async ({ page }) => {
  await openTree(page, GROM, /^Protection/);
  await expectScreenshot(page, "talents-a", [], async () => {
    await openTree(page, GROM, /^Protection/);
  });
});
