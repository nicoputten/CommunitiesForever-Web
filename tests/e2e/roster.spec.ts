import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-21: the roster cards on the sample data (seed.setup.ts): filter, search, sort, open a character, Back.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const panel = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const rowNames = (page: Page, friend: string) =>
  panel(page, friend).getByRole("link").locator("span[class*=name]").allInnerTexts();

test("shows the group, the level spread and the quick answers", async ({ page }) => {
  await page.goto("/roster");
  await expect(page.getByText("6 friends · 10 characters · Sanne has no addon yet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who is around which level" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Dungeon bands" })).toContainText(
    "Scarlet Monastery 26–45 · fits Bob Example, Ves Doombringer, Lia Thornwhisper, Tok Ironhide, Ruk Bloodhoof",
  );
  await expect(page.getByRole("heading", { name: "Healers" }).locator("..")).toContainText(
    "Lia Thornwhisper 37 Priest · Tok Ironhide 33 Shaman · Sela Moonbrook 12 Druid",
  );
  await expect(panel(page, "Jorrit")).toContainText("Data 9 days old · via Mira");
  await expect(panel(page, "Jorrit")).toContainText("Jorrit's data reached us through Mira's addon.");
  await expect(panel(page, "Sanne")).toContainText("We don't know Sanne's characters yet.");
  await expect(panel(page, "Nico").getByRole("link", { name: /Sela Moonbrook/ })).toContainText("ilvl —");
  await expect(page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Cards" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("filters by class and role from the menus, and Back undoes it", async ({ page }) => {
  await page.goto("/roster");
  await page.getByRole("button", { name: "Class" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Warlock" }).click();
  await expect(page).toHaveURL(/\/roster\?class=warlock$/);
  await expect(page.getByText("2 of 10 characters")).toBeVisible();
  await expect(panel(page, "Sanne")).toHaveCount(0);
  // A checkbox menu stays open for another class.
  await page.getByRole("menuitemcheckbox", { name: "Priest" }).click();
  await expect(page).toHaveURL(/\/roster\?class=priest,warlock$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Class" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Class · 2" })).toBeFocused();
  expect(await rowNames(page, "Femke")).toEqual(["Lia Thornwhisper", "Zul Kazrek"]);
  await expect(panel(page, "Femke")).toContainText("Femke#3307 · 2 characters");
  await expect(panel(page, "Nico")).toContainText(`${E2E.admin} · 1 of 3 characters`);

  await page.getByRole("button", { name: "Role" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Healer" }).click();
  await expect(page).toHaveURL(/role=heal/);
  await expect(page.getByText("1 of 10 characters")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/roster\?class=priest,warlock$/);
  await expect(page.getByText("3 of 10 characters")).toBeVisible();
});

test("filters by level with the keyboard, and shows no matches", async ({ page }) => {
  await page.goto("/roster?level=60");
  expect(await rowNames(page, "Mira")).toEqual(["Mira Sunstrider"]);
  await page.getByRole("button", { name: "Level 60" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "60" })).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/roster$/);

  await page.goto("/roster?q=nobody");
  await expect(page.getByRole("heading", { name: "No characters match" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Clear filters" }).last().click();
  await expect(page).toHaveURL(/\/roster$/);
  await expect(page.getByText("6 friends · 10 characters")).toBeVisible();
});

test("searches as you type, by character or friend", async ({ page }) => {
  await page.goto("/roster");
  await page.getByRole("searchbox", { name: "Search characters" }).fill("bob");
  await expect(page).toHaveURL(/\/roster\?q=bob$/);
  expect(await rowNames(page, "Bob")).toEqual(["Bob Example", "Tok Ironhide"]);
  await expect(panel(page, "Nico")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search characters" }).fill("thorn");
  await expect(page).toHaveURL(/\/roster\?q=thorn$/);
  expect(await rowNames(page, "Femke")).toEqual(["Lia Thornwhisper"]);
});

test("sorts within each friend", async ({ page }) => {
  await page.goto("/roster");
  expect(await rowNames(page, "Nico")).toEqual(["Ves Doombringer", "Grom Ashfeller", "Sela Moonbrook"]);
  await page.getByRole("button", { name: "Sort: Last played" }).click();
  await page.getByRole("menuitemradio", { name: "Name" }).click();
  await expect(page).toHaveURL(/\/roster\?sort=name$/);
  await expect(page.getByRole("button", { name: "Sort: Name" })).toBeVisible();
  expect(await rowNames(page, "Nico")).toEqual(["Grom Ashfeller", "Sela Moonbrook", "Ves Doombringer"]);
  await page.getByRole("button", { name: "Sort: Name" }).click();
  await page.getByRole("menuitemradio", { name: "Profession" }).click();
  await expect(page).toHaveURL(/sort=profession$/);
  expect(await rowNames(page, "Nico")).toEqual(["Ves Doombringer", "Grom Ashfeller", "Sela Moonbrook"]);
});

test("opens a character, and the table link keeps the view", async ({ page }) => {
  await page.goto("/roster?class=warlock");
  await expect(page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Table" })).toHaveAttribute(
    "href",
    "/roster/table?class=warlock",
  );
  await panel(page, "Nico")
    .getByRole("link", { name: /Ves Doombringer/ })
    .click();
  await expect(page).toHaveURL(/\/character\/Player-1-0000A001$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ves Doombringer");
  await page.goBack();
  await expect(page).toHaveURL(/\/roster\?class=warlock$/);
  expect((await page.request.get("/character/Player-1-nobody")).status()).toBe(404);
});

test("phone: rows stack and the filters stay usable", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await page.goto("/roster");
  const row = await panel(page, "Nico")
    .getByRole("link", { name: /Ves Doombringer/ })
    .boundingBox();
  expect(row!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Profession" }).click();
  const menu = page.getByRole("menu", { name: "Profession" });
  await expect(menu).toBeVisible();
  const m = await menu.boundingBox();
  expect(m!.x).toBeGreaterThanOrEqual(0);
  expect(m!.x + m!.width).toBeLessThanOrEqual(375);
  await page.getByRole("menuitemradio", { name: "Tailoring" }).click();
  await expect(page).toHaveURL(/prof=tailoring$/);
  await expect(page.getByText("3 of 10 characters")).toBeVisible();
});
