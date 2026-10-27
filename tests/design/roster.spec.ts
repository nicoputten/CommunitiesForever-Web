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

test("roster: no matches", async ({ page }) => {
  await openScreen(page, "/roster?q=nobody");
  await expect(page.getByRole("heading", { name: "No characters match" })).toBeVisible();
  await expectAccessible(page);
  await expectScreenshot(page, "roster-no-matches");
});
