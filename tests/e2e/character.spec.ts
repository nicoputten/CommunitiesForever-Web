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
  // With the recipe line under each crafting profession (WEB-92): Ves's Tailoring and Cooking scans are 19 days old.
  await expect(professions.getByRole("listitem")).toHaveText([
    /^Tailoring187 \/ 2253 recipes ›as of \d+ \w+$/,
    "Enchanting160 / 225Recipes not scannediOpen Enchanting in game once.",
    /^Cooking75 \/ 1501 recipe ›as of \d+ \w+$/,
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

// WEB-100 (board talent-tooltips-v2, WB101): a tree's row opens its tooltip, a click or tap the tree as the game's
// talent frame with each talent's tooltip. Ves syncs the talents (B), Grom only points per tree (A).
test("a talent tree's row opens its tooltip and its tree, a talent its game tooltip", async ({ page }) => {
  await page.goto(VES);
  const destruction = region(page, "Talents").getByRole("button", { name: /^Destruction/ });
  if (!isPhone(page)) {
    // The tree tooltip: the small tree and the talents with points.
    await destruction.hover();
    const tip = page.getByTestId("talent-tooltip");
    await expect(tip).toContainText("Destruction 20 points");
    await expect(tip).toContainText(
      "Ruin" + "Increases the critical strike damage bonus of your Destruction spells by 100%.5/5",
    );
    await expect(tip.getByTestId("talent-tree-mini")).toBeVisible();
  }
  await destruction.click();
  const tree = page.getByTestId("talent-tree");
  await expect(page.getByRole("dialog", { name: "Destruction" })).toBeVisible();
  await expect(tree).toContainText("Destruction20 points");
  const talent = (name: RegExp) => tree.getByRole(isPhone(page) ? "button" : "img", { name });
  await expect(talent(/ \d\/\d/)).toHaveCount(16);
  for (const [name, lines] of [
    [
      /^Aftermath 2\/5$/,
      ["Aftermath", "Rank 2/5", "Gives your Destruction spells a 4% chance", "Next rank:", "6% chance"],
    ],
    [/^Pyroclasm 0\/2, locked$/, ["Pyroclasm", "Rank 0/2", "Requires Intensity"]],
  ] as const) {
    if (isPhone(page)) await talent(name).click();
    else await talent(name).hover();
    const game = page.getByTestId("talent-tip").last();
    for (const line of lines) await expect(game).toContainText(line);
    if (!isPhone(page)) await page.mouse.move(1, 1);
  }
  if (isPhone(page)) await page.keyboard.press("Escape");
  else await page.getByRole("button", { name: "Close" }).click();
  await expect(tree).toBeHidden();

  await page.goto("/character/Player-1-0000A002");
  const protection = region(page, "Talents").getByRole("button", { name: /^Protection/ });
  if (isPhone(page)) await protection.click();
  else await protection.focus();
  await expect(page.getByTestId("talent-tooltip")).toHaveText("Protection10 points");
});
