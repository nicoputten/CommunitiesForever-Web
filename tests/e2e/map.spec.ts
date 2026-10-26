import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-25: the world map on the sample data (seed.setup.ts): markers per zone, clusters, the hover card, the
// selection in the URL and the continent switch.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const marker = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name},`) });
const card = (page: Page) => page.getByTestId("character-card");

test("shows every located character at its zone", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "World map" });
  await expect(map.getByRole("img", { name: "Map of Kalimdor and the Eastern Kingdoms" })).toBeVisible();
  await expect(marker(page, "Tok Ironhide")).toHaveAccessibleName(/Hillsbrad Foothills, seen/);
  await expect(marker(page, "Ruk Bloodhoof")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2 characters in Westfall, including 1 in The Deadmines" }),
  ).toBeVisible();
  // Characters in a cluster appear when it opens.
  await expect(marker(page, "Ves Doombringer")).toHaveCount(0);
});

test("opens a cluster, selects a character and keeps it in the URL", async ({ page }) => {
  await page.goto("/");
  const stv = page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ });
  await stv.click();
  await expect(stv).toHaveAttribute("aria-expanded", "true");
  await marker(page, "Ves Doombringer").click();
  await expect(marker(page, "Ves Doombringer")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?character=/);
  await expect(card(page).getByRole("heading", { name: "Ves Doombringer" })).toBeVisible();
  await expect(card(page)).toContainText("Stranglethorn Vale");
  await expect(card(page).getByRole("link", { name: "Open character →" })).toHaveAttribute("href", /^\/character\//);

  // A reload keeps the selection (and opens its fan); Escape clears it.
  await page.reload();
  await expect(marker(page, "Ves Doombringer")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/character=/);
  await expect(card(page)).toHaveCount(0);
});

test("shows the card on hover or focus", async ({ page }) => {
  test.skip(isPhone(page), "desktop: hover");
  await page.goto("/");
  await marker(page, "Tok Ironhide").hover();
  await expect(card(page)).toContainText("Hillsbrad Foothills");
  await expect(card(page)).toContainText("Player");
  await page.mouse.move(5, 300);
  await expect(card(page)).toHaveCount(0);
  await marker(page, "Grom Ashfeller").focus();
  await expect(card(page).getByRole("heading", { name: "Grom Ashfeller" })).toBeVisible();
});

test("switches continents in the top bar, and Back returns", async ({ page }) => {
  test.skip(isPhone(page), "the switch is in the desktop top bar (the phone map is WEB-28)");
  await page.goto("/");
  const switcher = page.getByRole("navigation", { name: "Continent" });
  await expect(switcher.getByRole("link", { name: "Azeroth" })).toHaveAttribute("aria-current", "page");
  await switcher.getByRole("link", { name: "Kalimdor" }).click();
  await expect(page).toHaveURL(/\?continent=kalimdor$/);
  await expect(switcher.getByRole("link", { name: "Kalimdor" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "World map" })).toHaveAttribute("data-continent", "kalimdor");
  await page.goBack();
  await expect(page.getByRole("region", { name: "World map" })).toHaveAttribute("data-continent", "azeroth");
});
