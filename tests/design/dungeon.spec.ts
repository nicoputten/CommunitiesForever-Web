import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
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

// WEB-42: design checks of the dungeon page (board dungeon-page) on SM Armory with the sample runs (seed.setup.ts
// "plan the sample runs": one run in Armory, one in Cathedral), and the map's dungeon entrance popover.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const ARMORY = "/dungeons/sm-armory";

test("dungeon: design values", async ({ page }) => {
  await openScreen(page, ARMORY);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), {
    "font-family": "var(--font-display)",
    "font-size": isPhone(page) ? "var(--fs-run-title)" : "var(--fs-dungeon-title)",
    color: "var(--gold-pale)",
  });
  const hero = page.getByRole("region", { name: "Armory" });
  await expectStyles(hero, { "min-height": "var(--size-dungeon-hero)", "border-color": "var(--line-hero)" });
  await expectStyles(hero.getByText("Scarlet Monastery · Tirisfal Glades"), {
    "font-size": "var(--fs-meta)",
    color: "var(--gold)",
  });
  const wings = page.getByRole("navigation", { name: "Scarlet Monastery wings" });
  await expectStyles(wings.getByRole("link", { name: /^Armory 32–42/ }), {
    "border-color": "var(--gold)",
    "background-color": "var(--tint-selected)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(wings.getByRole("link", { name: /^Cathedral/ }).locator("span"), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
  });
  await expectStyles(hero.getByRole("link", { name: "Plan a run" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "min-height": "var(--size-touch)",
  });
  const fits = page.getByRole("region", { name: "Who fits" });
  await expectStyles(fits.getByRole("heading", { name: "Who fits" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  await expectStyles(fits.getByText("Nobody in range."), {
    "border-top-color": "var(--line-nobody)",
    "border-top-style": "dashed",
    color: "var(--text-nobody)",
  });
  await expectStyles(fits.getByText("Lia Thornwhisper", { exact: true }), { color: "var(--priest)" });
  await expectStyles(fits.getByText("Grom Ashfeller", { exact: true }), { color: characterName("WARRIOR").color! });
  const planned = page.getByRole("region", { name: "Planned here" }).getByRole("link").first();
  await expectStyles(planned, {
    "background-color": "var(--surface-planned)",
    "border-color": "var(--line-planned)",
  });
});

test("dungeon: touch targets", async ({ page }) => {
  test.skip(!isPhone(page));
  await openScreen(page, ARMORY);
  await expectTouchTargets(page);
});

test("dungeon: accessibility", async ({ page }) => {
  await openScreen(page, ARMORY);
  await expectAccessible(page);
});

test("dungeon: reduced motion", async ({ page }) => {
  await openScreen(page, ARMORY);
  await expectNoMotion(page);
});

test("dungeon: screenshot", async ({ page }) => {
  await openScreen(page, ARMORY);
  await expectScreenshot(page, "dungeon");
});

test("dungeon: without wings, nothing planned or ran", async ({ page }) => {
  await openScreen(page, "/dungeons/rfc");
  await expect(page.getByText("Nothing planned here yet.")).toBeVisible();
  await expect(page.getByText("Not yet.", { exact: true })).toBeVisible();
  await expectAccessible(page);
  await expectScreenshot(page, "dungeon-empty");
});

/** The Scarlet Monastery entrance on the Eastern Kingdoms (shown on its continent: it has planned runs). */
async function openEntrance(page: Page) {
  await openScreen(page, "/?continent=eastern-kingdoms");
  const entrance = page.getByRole("button", { name: /^Scarlet Monastery, 2 planned$/ });
  await expectStyles(entrance.getByText("2", { exact: true }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
  });
  await entrance.click();
  return page.getByTestId("dungeon-popover");
}

test("map: the dungeon entrance's popover", async ({ page }) => {
  const popover = await openEntrance(page);
  await expect(popover.getByRole("heading", { name: "Scarlet Monastery" })).toBeVisible();
  await expect(popover.getByText("Levels 26–45 (typical) · 2 planned")).toBeVisible();
  await expectStyles(popover.getByRole("link", { name: "Plan a run" }), {
    "background-color": "var(--gold)",
    "min-height": "var(--size-touch)",
  });
  if (isPhone(page)) await expectTouchTargets(page);
  await expectAccessible(page);
  await expectNoMotion(page);
  await expectScreenshot(page, "map-dungeon-popover");
});
