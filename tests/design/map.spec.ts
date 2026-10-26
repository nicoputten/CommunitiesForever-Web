import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE,
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

// WEB-25: design checks of the world map (boards map and map-states) on the sample data.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const marker = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });

test("map: design values", async ({ page }) => {
  await openScreen(page, "/");
  await expectBackground(page, "map");
  // DESIGN.md §4: new = class fill; days = dark fill, class ring, 70%; week+ = dashed ring, 50%.
  await expectStyles(marker(page, "Tok Ironhide").locator("span").first(), {
    ...DATA,
    "font-size": "var(--fs-meta-sm)",
    "background-color": "var(--shaman)",
    color: "var(--on-shaman)",
    width: "var(--size-marker)",
  });
  await expectStyles(marker(page, "Grom Ashfeller").locator("span").first(), {
    "background-color": "var(--marker-ring-bg)",
    "border-top-color": "var(--warrior)",
    opacity: "var(--opacity-days)",
  });
  await expectStyles(marker(page, "Ruk Bloodhoof").locator("span").first(), {
    "border-top-style": "dashed",
    "border-top-color": "var(--hunter)",
    opacity: "var(--opacity-week)",
  });
  await expectStyles(page.getByText("9d", { exact: true }), { "font-size": "var(--fs-tiny)", color: "var(--stale-note)" });
  await expectStyles(page.getByRole("button", { name: /^2 characters in Westfall/ }).locator('[class*="count"]'), {
    ...DATA,
    "font-size": "var(--fs-body-sm)",
    "background-color": "var(--cluster-core)",
  });
});

test("map: hover card", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the card beside the marker");
  await openScreen(page, "/");
  await marker(page, "Tok Ironhide").hover();
  const card = page.getByTestId("character-card");
  await expect(card).toBeVisible();
  await expectStyles(card, {
    ...SURFACE,
    "background-color": "var(--surface-strong)",
    "border-radius": "var(--r-card)",
    "box-shadow": "var(--shadow-card)",
    width: "var(--size-card-map)",
  });
  await expectStyles(card.getByRole("heading", { name: "Tok Ironhide" }), {
    ...characterName("SHAMAN"),
    "font-size": "var(--fs-name-card)",
  });
  await expectStyles(card.getByText(/^Level 33/), { ...DATA, "font-size": "var(--fs-meta)", color: "var(--text-muted)" });
  await expectAccessible(page);
});

test("map: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/");
  await expectTouchTargets(page);
});

// On a phone the whole world is 375 px wide, so neighbouring markers overlap until zoom (WEB-26) and the phone map
// (WEB-28): approved by Nico for WEB-25 (proposal 9). Each marker still has its 44 px target.
const OVERLAP = ["target-size"];

test("map: accessibility", async ({ page }) => {
  await openScreen(page, "/");
  await expectAccessible(page, isPhone(page) ? OVERLAP : []);
});

test("map: reduced motion", async ({ page }) => {
  await openScreen(page, "/");
  await expectNoMotion(page);
});

test("map: screenshot", async ({ page }) => {
  await openScreen(page, "/");
  await expectScreenshot(page, "map");
});

test("map: screenshot with a selected character in an open fan", async ({ page }) => {
  await openScreen(page, "/");
  await page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ }).click();
  await marker(page, "Ves Doombringer").click();
  await expect(page.getByTestId("character-card")).toBeVisible();
  await page.mouse.move(0, 0);
  await expectScreenshot(page, "map-selected");
});

test("map: screenshot of Kalimdor", async ({ page }) => {
  await openScreen(page, "/?continent=kalimdor");
  await expectScreenshot(page, "map-kalimdor");
});
