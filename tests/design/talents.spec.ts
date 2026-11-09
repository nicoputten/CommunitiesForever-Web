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

// WEB-100 (board talent-tooltips-v2, WB101 "closer to the game"): the talents on the character page. Ves Doombringer
// syncs the nodes (sample.ts, sampleTalents.ts): B, the tree tooltip on hover, the tree as the game's talent frame on a
// click (desktop dialog) or tap (phone sheet), each talent's game tooltip. Grom Ashfeller sends points per tree only:
// A.

const VES = "/character/Player-1-0000A001";
const GROM = "/character/Player-1-0000A002";

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const row = (page: Page, tree: RegExp) =>
  page.getByRole("region", { name: "Talents" }).getByRole("button", { name: tree });

/** The short fade every change gets with reduced motion (globals.css) has ended. */
const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));

/** Desktop: hovers a tree's row; returns the tree tooltip. */
async function hoverTree(page: Page, url: string, tree: RegExp) {
  await openScreen(page, url);
  await row(page, tree).hover();
  const tip = page.getByTestId("talent-tooltip");
  await expect(tip).toBeVisible();
  await settled(page);
  return tip;
}

/** Clicks (desktop) or taps (phone) Destruction's row: the tree. */
async function openTree(page: Page) {
  await openScreen(page, VES);
  await row(page, /^Destruction/).click();
  const tree = page.getByTestId("talent-tree");
  await expect(tree).toBeVisible();
  await settled(page);
  return tree;
}

/** Hovers (desktop) or taps (phone) a talent in the open tree; returns its game tooltip. */
async function pickTalent(page: Page, name: RegExp) {
  const tree = page.getByTestId("talent-tree");
  const talent = tree.getByRole(isPhone(page) ? "button" : "img", { name });
  if (isPhone(page)) await talent.click();
  else await talent.hover();
  const tip = page.getByTestId("talent-tip").last();
  await expect(tip).toBeVisible();
  await settled(page);
  // On top: not under the tree's dialog.
  const onTop = await tip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect(onTop, "the talent tooltip is on top").toBe(true);
  return tip;
}

test("talents: the tree tooltip (B)", async ({ page }) => {
  test.skip(isPhone(page), "hover");
  const tip = await hoverTree(page, VES, /^Destruction/);
  await expectStyles(page.locator("button[data-open]"), {
    "background-color": "var(--tint-talent-row)",
    "box-shadow": "var(--ring-talent-row)",
    "min-height": "var(--size-talent-row)",
  });
  await expectStyles(tip, {
    width: "var(--size-talent-tree-tip)",
    "background-color": "var(--surface-talent-tip)",
    "border-top-color": "var(--line-game)",
    "font-size": "var(--fs-game)",
  });
  await expect(tip.getByTestId("talent-tree-mini")).toBeVisible();
  await expectStyles(tip.getByText("Destruction", { exact: true }), { color: "var(--warlock-text)" });
  await expectStyles(tip.getByText("Improved Shadow Bolt"), {
    "font-size": "var(--fs-talent-name)",
    "font-weight": "var(--fw-semibold)",
  });
  await expectStyles(tip.getByText(/^Gives your Destruction spells a 4%/), {
    "font-size": "var(--fs-talent-text)",
    color: "var(--game-yellow)",
  });
  await expectStyles(tip.getByText("2/5", { exact: true }), {
    color: "var(--game-green)",
    "border-top-color": "var(--line-talent-rank-partial)",
  });
  await expectStyles(tip.getByText("3/3", { exact: true }), {
    color: "var(--game-yellow)",
    "border-top-color": "var(--line-talent-rank-full)",
  });
  await expectScreenshot(page, "talents-tree-tooltip", [], async () => {
    await hoverTree(page, VES, /^Destruction/);
  });
});

test("talents: the tree as the game's talent frame", async ({ page }) => {
  const tree = await openTree(page);
  await expectStyles(tree, {
    "border-top-color": "var(--line-talent-frame)",
    "border-radius": "var(--r-talent-frame)",
    "background-image": "var(--talent-frame)",
  });
  await expectStyles(tree.getByText("Destruction", { exact: true }), {
    "font-size": "var(--fs-talent-tree)",
    color: "var(--gold-bright)",
  });
  await expectStyles(tree.getByText("20 points"), { color: "var(--game-yellow)" });
  const icon = (state: string) => tree.locator(`[data-size="full"][data-state="${state}"]`).first();
  await expect(tree.locator('[data-size="full"][data-state]')).toHaveCount(16);
  await expectStyles(icon("full"), {
    width: "var(--size-talent)",
    "border-top-color": "var(--game-yellow)",
    "box-shadow": "var(--shadow-talent-full)",
  });
  await expectStyles(icon("partial"), { "border-top-color": "var(--game-green)" });
  await expectStyles(icon("open"), { "border-top-color": "var(--line-talent-open)" });
  await expectStyles(icon("locked"), { filter: "var(--filter-talent-locked)" });
  await expectStyles(icon("full").getByText("5/5"), {
    "font-size": "var(--fs-talent-rank)",
    color: "var(--game-yellow)",
    "background-color": "var(--talent-rank-bg)",
  });
  await expectStyles(icon("open").getByText(/^0\//), { color: "var(--talent-rank-text)" });
  // Three prerequisite arrows, all grey: none of the first talents has points.
  const arrows = tree.locator('[aria-hidden="true"][data-dir]');
  await expect(arrows).toHaveCount(3);
  await expectStyles(arrows.first(), {
    width: "var(--size-talent-arrow)",
    "background-color": "var(--talent-arrow)",
  });
  await expectScreenshot(page, "talents-tree", [], async () => {
    await openTree(page);
  });
});

test("talents: a talent's game tooltip with the next rank", async ({ page }) => {
  await openTree(page);
  const tip = await pickTalent(page, /^Aftermath 2\/5$/);
  await expectStyles(tip, {
    "background-color": "var(--surface-talent-tip)",
    "border-radius": "var(--r-talent-tip)",
    color: "var(--game-text)",
  });
  await expectStyles(tip.getByText("Aftermath", { exact: true }), {
    "font-size": "var(--fs-game-title)",
    "font-weight": "var(--fw-semibold)",
  });
  await expect(tip.getByText("Rank 2/5")).toBeVisible();
  await expectStyles(tip.getByText(/a 4% chance/), { color: "var(--game-yellow)" });
  await expectStyles(tip.getByText("Next rank:"), { color: "var(--game-text)" });
  await expectStyles(tip.getByText(/a 6% chance/), { color: "var(--game-yellow)" });
  await expectScreenshot(page, "talents-talent-tooltip", [], async () => {
    await openTree(page);
    await pickTalent(page, /^Aftermath/);
  });
});

test("talents: a locked talent's red requirements", async ({ page }) => {
  await openTree(page);
  const pyroclasm = await pickTalent(page, /^Pyroclasm 0\/2, locked$/);
  await expectStyles(pyroclasm.getByText("Requires Intensity"), { color: "var(--game-red)" });
  await expect(pyroclasm).not.toContainText("Next rank:");
  if (!isPhone(page)) {
    await page.mouse.move(1, 1);
    await expect(page.getByTestId("talent-tip")).toHaveCount(0);
  }
  const incinerate = await pickTalent(page, /^Incinerate 0\/1, locked$/);
  await expect(incinerate).toContainText("Requires 30 points in Destruction Talents");
  await expect(incinerate).toContainText("Requires Bane of Havoc");
  await expectScreenshot(page, "talents-locked", [], async () => {
    await openTree(page);
    await pickTalent(page, /^Incinerate/);
  });
});

test("talents A: the tree's name and points only", async ({ page }) => {
  await openScreen(page, GROM);
  const protection = row(page, /^Protection/);
  // No talent data: on a desktop a click opens nothing more than the tooltip.
  if (!isPhone(page)) await expect(protection).not.toHaveAttribute("aria-haspopup");
  if (isPhone(page)) await protection.click();
  else await protection.hover();
  const tip = page.getByTestId("talent-tooltip");
  await expect(tip).toHaveText(/^Protection10 points$/);
  await settled(page);
  await expectStyles(tip.getByText("Protection", { exact: true }), { color: "var(--warrior)" });
  await expectScreenshot(page, "talents-a", [], async () => {
    await openScreen(page, GROM);
    if (isPhone(page)) await row(page, /^Protection/).click();
    else await row(page, /^Protection/).hover();
  });
});

test("talents: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openTree(page);
  await pickTalent(page, /^Aftermath/);
  await expectTouchTargets(page);
});

test("talents: accessibility", async ({ page }) => {
  await openTree(page);
  await expectAccessible(page);
  await pickTalent(page, /^Pyroclasm/);
  await expectAccessible(page);
});

test("talents: reduced motion", async ({ page }) => {
  await openTree(page);
  await expectNoMotion(page);
});
