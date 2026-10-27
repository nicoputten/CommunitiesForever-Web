import { test } from "@playwright/test";
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

// WEB-23: design checks of the character page (board character) on the sample data: Ves Doombringer.

const VES = "/character/Player-1-0000A001";

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("character: design values", async ({ page }) => {
  await openScreen(page, VES);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), {
    ...characterName("WARLOCK"),
    "font-size": isPhone(page) ? "var(--fs-display)" : "var(--fs-hero)",
  });
  await expectStyles(page.getByText("Level 39 Undead Warlock · Horde · PvP"), {
    "font-size": "var(--fs-lead)",
    color: "var(--text-chip)",
  });
  await expectStyles(page.getByText("Last played 2 h ago"), {
    "font-size": "var(--fs-meta)",
    color: "var(--fresh-text)",
    "border-top-color": "var(--fresh-line)",
  });
  await expectStyles(page.getByText(/^Fits /), { "font-size": "var(--fs-meta)", color: "var(--gold-pale)" });

  const glance = page.getByRole("region", { name: "At a glance" });
  await expectStyles(glance, { ...SURFACE, "border-radius": "var(--r-panel)", "background-color": "var(--surface)" });
  await expectStyles(glance.getByRole("heading"), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  await expectStyles(glance.getByText("34", { exact: true }), { "font-size": "var(--fs-lead)", color: "var(--text)" });
  await expectStyles(glance.getByText("Horde"), { color: "var(--horde-text)" });

  const talents = page.getByRole("region", { name: "Talents" });
  await expectStyles(talents.getByText("Destruction"), { "font-size": "var(--fs-body-sm)", color: "var(--warlock-text)" });
  await expectStyles(talents.getByText("20", { exact: true }), { ...DATA, color: "var(--text)" });
  await expectStyles(talents.getByText(/^Bars are out of 31/), { ...TYPE.metaSm, color: "var(--text-faint)" });

  const professions = page.getByRole("region", { name: "Professions" });
  await expectStyles(professions.getByText("Cooking"), { color: "var(--text-muted)" });
  await expectStyles(professions.getByText("187 / 225"), { ...DATA, color: "var(--text-muted)" });
  await expectStyles(professions.getByRole("link"), { "font-size": "var(--fs-meta)", color: "var(--gold)" });

  const quests = page.getByRole("region", { name: "Quest log" });
  await expectStyles(quests.getByText("Tiger Mastery"), { "font-size": "var(--fs-body-sm)", color: "var(--text-chip)" });

  const seen = page.getByRole("region", { name: "Last seen" });
  await expectStyles(seen.getByRole("paragraph").filter({ hasText: /^Stranglethorn Vale$/ }), {
    ...TYPE.name,
    "font-size": "var(--fs-name)",
    color: "var(--gold-pale)",
  });
  await expectStyles(seen.getByRole("img", { name: "Map of Stranglethorn Vale" }).locator(".."), {
    "border-radius": "var(--r-minimap)",
  });

  const others = page.getByRole("region", { name: "Nico's other characters" });
  await expectStyles(others.getByText("Grom Ashfeller"), { "font-size": "var(--fs-body)", color: "var(--warrior)" });
});

test("character: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, VES);
  await expectTouchTargets(page);
});

test("character: accessibility", async ({ page }) => {
  await openScreen(page, VES);
  await expectAccessible(page);
});

test("character: reduced motion", async ({ page }) => {
  await openScreen(page, VES);
  await expectNoMotion(page);
});

test("character: screenshot", async ({ page }) => {
  await openScreen(page, VES);
  await expectScreenshot(page, "character");
});

test("character not found: screenshot", async ({ page }) => {
  await openScreen(page, "/character/Player-1-nobody");
  await expectAccessible(page);
  await expectScreenshot(page, "character-not-found");
});
