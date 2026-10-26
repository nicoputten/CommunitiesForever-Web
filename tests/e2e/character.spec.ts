import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-23: the character page on the sample data (seed.setup.ts): hero, panels, mini map, links and states.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const VES = "/character/Player-1-0000A001";
const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("opens from the roster and shows the character", async ({ page }) => {
  await page.goto("/roster");
  await page
    .getByRole("link", { name: /Ves Doombringer/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${VES}$`));
  await expect(page).toHaveTitle(/Ves Doombringer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ves Doombringer");
  await expect(page.getByText("Level 39 Undead Warlock · Horde · PvP")).toBeVisible();
  await expect(page.getByRole("img", { name: "Warlock, level 39" })).toBeVisible();
  const pills = page.getByRole("region", { name: "Ves Doombringer" }).getByRole("listitem");
  await expect(pills).toHaveText(["Played by Nico", "Last played 2 h ago", /^Data .* · own addon$/]);
  await expect(page.getByText("21 levels to 60")).toBeVisible();
  await expect(page.getByText(/^Fits .+ \(\d+–\d+\) with /)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Roster" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("shows the panels of the board", async ({ page }) => {
  await page.goto(VES);
  await expect(region(page, "At a glance").locator("dl > div")).toHaveText([
    "Item level34",
    "RoleDamage",
    "Main treeDestruction",
    "FactionHorde",
    "RulesetPvP",
  ]);
  const talents = region(page, "Talents");
  await expect(talents.getByText("30 of 30 points spent (level − 9)")).toBeVisible();
  await expect(talents.getByRole("listitem")).toHaveText(["Affliction10", "Demonology0", "Destruction (main tree)20"]);
  const professions = region(page, "Professions");
  await expect(professions.getByRole("listitem")).toHaveText([
    "Tailoring187 / 225",
    "Enchanting160 / 225",
    "Cooking75 / 150",
  ]);
  await expect(professions.getByRole("link", { name: "Compare with the group →" })).toHaveAttribute(
    "href",
    "/professions#tailoring",
  );
  const quests = region(page, "Quest log");
  await expect(quests.getByRole("listitem")).toHaveCount(6);
  await expect(quests.getByRole("listitem").first()).toHaveText("Tiger Mastery");
  await expect(quests.getByText("Titles only, as the addon recorded them 2 h ago")).toBeVisible();
});

test("shows where the character was last seen, with who is there too", async ({ page }) => {
  await page.goto(VES);
  const seen = region(page, "Last seen");
  await expect(seen.getByRole("img", { name: "Map of Stranglethorn Vale" })).toBeVisible();
  await expect(seen.getByRole("paragraph").filter({ hasText: /^Stranglethorn Vale$/ })).toBeVisible();
  await expect(seen.getByText("Seen 2 h ago · Lia Thornwhisper is here too")).toBeVisible();
  await expect(seen.getByRole("img", { name: /^Ves Doombringer, level 39 Warlock/ })).toBeVisible();
  await expect(seen.getByRole("link", { name: "On the map →" })).toHaveAttribute(
    "href",
    "/?character=Player-1-0000A001",
  );
  await seen.getByRole("link", { name: /^Lia Thornwhisper/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lia Thornwhisper");
});

test("lists the owner's other characters and opens one", async ({ page }) => {
  await page.goto(VES);
  const others = region(page, "Nico's other characters");
  await expect(others.getByRole("link")).toHaveText([
    /Grom Ashfeller24 Warrior · Tank · 3 days ago$/,
    /Sela Moonbrook12 Druid · Healer · 2 weeks ago$/,
  ]);
  await others.getByRole("link", { name: /Grom Ashfeller/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grom Ashfeller");
});

test("a character never seen has unknown whereabouts", async ({ page }) => {
  await page.goto("/character/Player-1-0000A003");
  await expect(region(page, "Last seen").getByText("Unknown whereabouts")).toBeVisible();
  await expect(region(page, "Last seen").getByRole("img")).toHaveCount(0);
});

test("an unknown character is not found", async ({ page }) => {
  const res = await page.goto("/character/Player-1-nobody");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Character not found");
  await page.getByRole("link", { name: "← Roster" }).click();
  await expect(page).toHaveURL(/\/roster$/);
});

test("phone: one column in the decided order", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await page.goto(VES);
  const titles = ["At a glance", "Last seen", "Talents", "Professions", "Quest log", "Nico's other characters"];
  let previous = -Infinity;
  for (const name of titles) {
    const box = await region(page, name).boundingBox();
    expect(box!.y, name).toBeGreaterThan(previous);
    previous = box!.y;
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
