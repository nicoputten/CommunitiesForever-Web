import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-27: the roll call next to the map on the sample data (seed.setup.ts): groups, filters in the URL that the map
// follows, picking a row flies the map there, the unknown tray and the no-addon line. Desktop only (from 1024 px).

test.beforeEach(async ({ context, baseURL, page }) => {
  test.skip(isPhone(page), "desktop: the phone has its sheet (WEB-28)");
  await signInAs(context, baseURL!, E2E.admin);
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Roll call" });
const row = (page: Page, name: string) => panel(page).getByRole("button", { name: new RegExp(`^${name}`) });
const marker = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name},`) });

test("lists who was seen where, newest first, with the unknown tray", async ({ page }) => {
  await page.goto("/");
  await expect(panel(page)).toContainText(/9 of \d+ located/);
  const fresh = panel(page).getByRole("region", { name: "New" });
  await expect(fresh.getByRole("listitem")).toHaveCount(4);
  await expect(fresh.getByRole("listitem").first()).toContainText("Lia Thornwhisper");
  await expect(row(page, "Bob Example")).toContainText("The Deadmines, Westfall · Bob");
  await expect(row(page, "Mira Sunstrider")).toContainText("Mira, via Bob");
  await expect(row(page, "Ruk Bloodhoof")).toContainText("Jorrit's data is 9 days old");
  // One row until opened (WEB-65).
  const tray = panel(page).getByRole("region", { name: "Unknown whereabouts" });
  const sela = tray.getByRole("link", { name: /Sela Moonbrook/ });
  await expect(sela).toBeHidden();
  await tray.getByText("1 not sighted yet").click();
  await expect(sela).toHaveAttribute("href", /^\/character\//);
  await expect(sela).toBeVisible();
  await expect(tray).toContainText("Sanne has no addon data yet.");
});

test("picking a row flies the map to the character and selects it", async ({ page }) => {
  await page.goto("/");
  await row(page, "Tok Ironhide").click();
  await expect(page).toHaveURL(/character=/);
  await expect(marker(page, "Tok Ironhide")).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "Tok Ironhide")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("character-card").getByRole("heading", { name: "Tok Ironhide" })).toBeVisible();
});

test("filters the roll call and the map through the URL, and Back undoes a filter", async ({ page }) => {
  await page.goto("/");
  await panel(page).getByRole("button", { name: "Bob", exact: true }).click();
  await expect(page).toHaveURL(/friend=Bob%232002/);
  await expect(panel(page)).toContainText("2 of 2 located");
  await expect(marker(page, "Ruk Bloodhoof")).toHaveCount(0);
  await expect(marker(page, "Tok Ironhide")).toBeVisible();

  await panel(page).getByRole("button", { name: "Level 1–60" }).click();
  await page.getByRole("menuitemradio", { name: "40–49" }).click();
  await expect(page).toHaveURL(/level=40-49/);
  await expect(panel(page)).toContainText("1 of 1 located");
  await expect(row(page, "Bob Example")).toBeVisible();

  await page.goBack();
  await expect(panel(page)).toContainText("2 of 2 located");
  await page.goBack();
  await expect(panel(page)).toContainText(/9 of \d+ located/);
  await expect(marker(page, "Ruk Bloodhoof")).toBeVisible();
});

test("New, faction and an empty result with Clear filters", async ({ page }) => {
  await page.goto("/?new=1");
  await expect(panel(page).getByRole("button", { name: "New", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page)).toContainText("4 of 4 located");
  await panel(page).getByRole("button", { name: "Horde + Alliance" }).click();
  await page.getByRole("menuitemradio", { name: "Alliance", exact: true }).click();
  await expect(panel(page).getByRole("heading", { name: "No characters match" })).toBeVisible();
  await panel(page).getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(panel(page)).toContainText(/9 of \d+ located/);
});
