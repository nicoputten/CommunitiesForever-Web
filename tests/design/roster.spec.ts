import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE,
  TYPE,
  characterName,
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

// WEB-21: design checks of the roster cards (board roster-cards) on the sample data.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("roster: design values", async ({ page }) => {
  await openScreen(page, "/roster");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByText("6 friends · 10 characters · Sanne has no addon yet"), {
    ...TYPE.bodySm,
    color: "var(--text-dim)",
  });
  await expectStyles(page.getByRole("heading", { name: "Who is around which level" }), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  // The level spread (WEB-32, board roster-cards-runs): a merged dot with its count, the gold ring, the tooltip.
  const spread = page.getByRole("region", { name: "Who is around which level" });
  const group = spread.getByRole("button", {
    name: isPhone(page) ? "4 characters around level 37" : "3 characters around level 39",
  });
  await expectStyles(group.locator("span").first(), {
    width: "var(--size-dot-group)",
    "box-shadow": "var(--ring-dot-own)",
  });
  await expectStyles(group.locator("span span"), {
    "font-size": "var(--fs-meta-sm)",
    "font-weight": "var(--fw-bold)",
    color: "var(--gold-pale)",
    "background-color": "var(--dot-count-bg)",
  });
  await expectStyles(spread.getByRole("button", { name: "Mira Sunstrider 60" }).locator("span"), {
    width: "var(--size-dot)",
    "background-color": "var(--mage)",
    "box-shadow": "var(--ring-dot)",
  });
  await group.click();
  await expectStyles(spread.getByRole("tooltip").filter({ hasText: "Lia Thornwhisper" }), {
    "font-size": "var(--fs-meta)",
    "border-radius": "var(--r-btn)",
    "background-color": "var(--surface-tooltip)",
    "border-color": "var(--line-tooltip)",
    "box-shadow": "var(--shadow-tooltip)",
  });
  await page.keyboard.press("Escape");
  // The bands (WEB-45): the best band in gold; a click opens its popover (board roster-cards-runs).
  const armory = spread.locator('button[data-band="sm-armory"]');
  await expectStyles(armory, {
    "font-size": isPhone(page) ? "var(--fs-meta-sm)" : "var(--fs-meta)",
    color: "var(--gold-pale)",
  });
  await armory.click();
  const pop = page.getByRole("dialog", { name: "Scarlet Monastery: Armory" });
  await expectStyles(pop, {
    "background-color": "var(--surface-menu)",
  });
  await expectStyles(pop.getByRole("link", { name: "Plan a run" }), {
    "background-color": "var(--gold)",
    "min-height": "var(--size-touch)",
  });
  await page.keyboard.press("Escape");

  await expectStyles(page.getByRole("heading", { name: "Healers" }), {
    ...TYPE.overline,
    "letter-spacing": "var(--ls-overline)",
    color: "var(--text-faint)",
  });

  const nico = page.getByRole("region", { name: "Nico", exact: true });
  await expectStyles(nico, { "border-radius": "var(--r-panel)", "background-color": "var(--surface-panel)" });
  await expectStyles(nico.getByRole("heading", { name: "Nico" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-friend)",
    color: "var(--text-strong)",
  });
  await expectStyles(nico.getByText("Ves Doombringer", { exact: true }), {
    ...characterName("WARLOCK"),
    "font-size": "var(--fs-name)",
  });
  const bob = page.getByRole("region", { name: "Bob", exact: true });
  await expectStyles(bob.getByText("Tok Ironhide", { exact: true }), characterName("SHAMAN"));
  await expectStyles(nico.getByText("Data 1 h ago"), { ...DATA, "font-size": "var(--fs-meta-sm)", color: "var(--fresh-text)" });
  await expectStyles(nico.getByRole("img", { name: "Warlock, level 39" }), { ...DATA, "background-color": "var(--warlock)" });
  // On phone the "when · where · ilvl" line is one size up (meta), as the row's only detail line.
  await expectStyles(nico.getByText("ilvl 34"), {
    ...DATA,
    ...(isPhone(page) ? TYPE.meta : TYPE.metaSm),
    color: "var(--text-dim)",
  });
  await expectStyles(page.getByText("Data 9 days old · via Mira"), { color: "var(--stale-text)" });
  await expectStyles(page.getByRole("link", { name: /Ruk Bloodhoof/ }).getByRole("img"), {
    opacity: "var(--opacity-old)",
  });
  await expectStyles(page.getByText(/^We don.t know Sanne.s characters yet/), {
    ...TYPE.bodySm,
    color: "var(--text-dim)",
  });
});

test("roster: filter menu surface", async ({ page }) => {
  await openScreen(page, "/roster");
  await page.getByRole("button", { name: "Class" }).click();
  const menu = page.getByRole("menu", { name: "Class" });
  await expect(menu).toBeVisible();
  await expectStyles(menu, { ...SURFACE, "border-radius": "var(--r-panel)", "box-shadow": "var(--shadow-card)" });
  if (isPhone(page)) await expectTouchTargets(page);
  await expectAccessible(page);
});

test("roster: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/roster");
  await expectTouchTargets(page);
});

test("roster: accessibility", async ({ page }) => {
  await openScreen(page, "/roster");
  await expectAccessible(page);
});

test("roster: reduced motion", async ({ page }) => {
  await openScreen(page, "/roster");
  await expectNoMotion(page);
});

test("roster: screenshot", async ({ page }) => {
  await openScreen(page, "/roster");
  await expectScreenshot(page, "roster");
});

test("roster: band chips with full names, wrapping (WEB-65)", async ({ page }) => {
  test.skip(isPhone(page), "the phone list has a band per row");
  await openScreen(page, "/roster");
  const bands = page.getByRole("list", { name: "Dungeon bands" });
  const band = (id: string) => bands.locator(`button[data-band="${id}"]`);
  await expect(band("rfc")).toHaveText("Ragefire Chasm 13–18 · 2", { useInnerText: true });
  await expect(band("sm-cathedral")).toHaveText("Scarlet Monastery: Cathedral 35–45 · 3 · 1 run", {
    useInnerText: true,
  });
  await expectStyles(band("rfc"), { "border-radius": "var(--r-btn)", "font-size": "var(--fs-meta)" });
  // Never cut: every chip shows all of its text, and the chips wrap onto more than one row.
  const layout = await bands.evaluate((ul) => {
    const buttons = [...ul.querySelectorAll<HTMLElement>("button[data-band]")];
    return {
      cut: buttons.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.dataset.band),
      rows: new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
    };
  });
  expect(layout.cut).toEqual([]);
  expect(layout.rows).toBeGreaterThan(1);
  await expectAccessible(page);
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  await expect(page.getByRole("region", { name: "Who is around which level" })).toHaveScreenshot("roster-bands.png");
});

test("roster: no matches", async ({ page }) => {
  await openScreen(page, "/roster?q=nobody");
  await expect(page.getByRole("heading", { name: "No characters match" })).toBeVisible();
  await expectAccessible(page);
  await expectScreenshot(page, "roster-no-matches");
});
