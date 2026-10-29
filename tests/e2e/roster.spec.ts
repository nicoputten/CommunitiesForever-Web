import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-21: the roster cards on the sample data (seed.setup.ts): filter, search, sort, open a character, Back.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const panel = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
// A locator, so each check retries until the new view has rendered (the URL changes first).
const rowNames = (page: Page, friend: string) => panel(page, friend).getByRole("link").locator("span[class*=name]");

test("shows the group, the level spread and the quick answers", async ({ page }) => {
  await page.goto("/roster");
  await expect(page.getByText("6 friends · 10 characters · Sanne has no addon yet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who is around which level" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Dungeon bands" })).toContainText("32–42 · 4");
  // No run planned yet: no Next run card (WEB-45).
  await expect(page.getByRole("region", { name: "Next run" })).toHaveCount(0);
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

test("the level spread: dots with names in a tooltip, bands without names (WEB-32)", async ({ page }) => {
  await page.goto("/roster");
  const spread = page.getByRole("region", { name: "Who is around which level" });
  const bands = spread.getByRole("list", { name: "Dungeon bands" });
  // At most 4 rows (WEB-45); the rest after "Show all".
  await expect(spread.getByText(/^\d+ of \d+ shown$/)).toBeVisible();
  await spread.getByRole("button", { name: /^Show all \d+$/ }).click();
  await expect(spread.getByRole("button", { name: "Show fewer" })).toBeVisible();
  // Scarlet Monastery's wings are separate bands; each one's accessible name has what it shows and the full name.
  for (const [id, name, label] of [
    ["sm-graveyard", "Scarlet Monastery: Graveyard", "26–36 · 2"],
    ["sm-library", "Scarlet Monastery: Library", "29–39 · 3"],
    ["sm-cathedral", "Scarlet Monastery: Cathedral", "35–45 · 3"],
  ] as const) {
    const band = bands.locator(`button[data-band="${id}"]`);
    await expect(band).toHaveAttribute("aria-label", new RegExp(label));
    await expect(band).toHaveAttribute("aria-label", new RegExp(name));
  }
  // Full names everywhere, never cut (WEB-65).
  await expect(bands.locator('button[data-band="rfc"]')).toHaveText("Ragefire Chasm 13–18 · 2", { useInnerText: true });
  // The Armory has the most fits.
  await expect(bands.locator('button[data-band="sm-armory"]')).toHaveAttribute("data-best", "true");
  await expect(bands).not.toContainText(/Ves|Lia|Bob|Tok|Ruk/);
  // Lia 37, Ves 39 and Bob 41 share one dot; Ves is the viewer's. A phone merges within 4 levels: Tok 33 too.
  const phone = isPhone(page);
  await expect(spread.locator("[aria-describedby^=spread-tip]:visible")).toHaveCount(phone ? 4 : 8);
  const group = spread.getByRole("button", {
    name: phone ? "4 characters around level 37" : "3 characters around level 39",
  });
  const tip = spread.getByRole("tooltip").filter({ hasText: "Lia Thornwhisper" });
  await expect(group).toHaveText(phone ? "4" : "3");
  await expect(group).toHaveAttribute("data-own", "true");
  await expect(spread.getByRole("button", { name: "Mira Sunstrider 60" })).not.toHaveAttribute("data-own");
  await expect(tip).toBeHidden();
  if (phone) {
    await group.tap();
    await expect(tip).toBeVisible();
    await group.tap();
    await expect(tip).toBeHidden();
  } else {
    await group.hover();
    await expect(tip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
  }
  await group.click();
  await expect(tip).toHaveText(
    phone
      ? /Tok Ironhide 33 · Bob\s*Lia Thornwhisper 37 · Femke\s*Ves Doombringer 39 · you\s*Bob Example 41 · Bob/
      : /Lia Thornwhisper 37 · Femke\s*Ves Doombringer 39 · you\s*Bob Example 41 · Bob/,
  );
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  // Keyboard focus shows a single dot's name.
  await spread.getByRole("button", { name: "Mira Sunstrider 60" }).focus();
  await expect(spread.getByRole("tooltip").filter({ hasText: "Mira Sunstrider" })).toHaveText(
    "Mira Sunstrider 60 · Mira",
  );
});

test("a band opens its popover: who fits, missing roles, Plan a run (WEB-45)", async ({ page }) => {
  await page.goto("/roster");
  const bands = page.getByRole("list", { name: "Dungeon bands" });
  const armory = bands.locator('button[data-band="sm-armory"]');
  await armory.click();
  await expect(armory).toHaveAttribute("aria-expanded", "true");
  const pop = page.getByRole("dialog", { name: "Scarlet Monastery: Armory" });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("4 characters fit");
  await expect(pop.getByRole("link", { name: "Plan a run" })).toHaveAttribute("href", "/runs/new?dungeon=sm-armory");
  await expect(pop.getByRole("link", { name: "View run" })).toHaveCount(0);
  // WEB-42: the dungeon's page.
  await expect(pop.getByRole("link", { name: "Dungeon page" })).toHaveAttribute("href", "/dungeons/sm-armory");
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
  if (!isPhone(page)) await expect(armory).toBeFocused();
});

test("filters by class and role from the menus, and Back undoes it", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the phone has its Filters sheet (WEB-65)");
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
  await expect(rowNames(page, "Femke")).toHaveText(["Lia Thornwhisper", "Zul Kazrek"]);
  // WEB-65: display names only; the BattleTag is on Admin.
  await expect(panel(page, "Femke")).toContainText("2 characters");
  await expect(panel(page, "Femke")).not.toContainText("#");
  await expect(panel(page, "Nico")).toContainText("1 of 3 characters");

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
  await expect(rowNames(page, "Mira")).toHaveText(["Mira Sunstrider"]);
  // The menus are desktop only; the phone has its Filters sheet (WEB-65).
  if (!isPhone(page)) {
    await page.getByRole("button", { name: "Level 60" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "60" })).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/roster$/);
  }

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
  await expect(rowNames(page, "Bob")).toHaveText(["Bob Example", "Tok Ironhide"]);
  await expect(panel(page, "Nico")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search characters" }).fill("thorn");
  await expect(page).toHaveURL(/\/roster\?q=thorn$/);
  await expect(rowNames(page, "Femke")).toHaveText(["Lia Thornwhisper"]);
});

test("sorts within each friend", async ({ page }) => {
  await page.goto("/roster");
  await expect(rowNames(page, "Nico")).toHaveText(["Ves Doombringer", "Grom Ashfeller", "Sela Moonbrook"]);
  await page.getByRole("button", { name: "Sort: Last played" }).click();
  await page.getByRole("menuitemradio", { name: "Name" }).click();
  await expect(page).toHaveURL(/\/roster\?sort=name$/);
  await expect(page.getByRole("button", { name: "Sort: Name" })).toBeVisible();
  await expect(rowNames(page, "Nico")).toHaveText(["Grom Ashfeller", "Sela Moonbrook", "Ves Doombringer"]);
  await page.getByRole("button", { name: "Sort: Name" }).click();
  await page.getByRole("menuitemradio", { name: "Profession" }).click();
  await expect(page).toHaveURL(/sort=profession$/);
  await expect(rowNames(page, "Nico")).toHaveText(["Ves Doombringer", "Grom Ashfeller", "Sela Moonbrook"]);
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
  // WEB-65 (board live-test-phone): the search and one Filters button; the menus are in a bottom sheet.
  await expect(page.getByRole("button", { name: "Class" })).toBeHidden();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Sort" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Clear" })).toBeDisabled();
  await sheet.getByRole("group", { name: "Profession" }).getByRole("button", { name: "Tailoring" }).click();
  await expect(page).toHaveURL(/prof=tailoring$/);
  await expect(sheet.getByRole("button", { name: "Show 3 characters" })).toBeVisible();
  await sheet.getByRole("button", { name: "Show 3 characters" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("3 of 10 characters")).toBeVisible();
  await page.getByRole("button", { name: "Filters · 1" }).click();
  await sheet.getByRole("button", { name: "Clear" }).click();
  await expect(page).toHaveURL(/\/roster$/);
  await expect(sheet.getByRole("button", { name: "Show 10 characters" })).toBeVisible();
});
