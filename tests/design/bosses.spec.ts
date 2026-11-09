import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  characterName,
  expectAccessible,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-102 (board DL04) and WEB-97 (board DL05): the dungeon page's Bosses & loot on The Deadmines (sampleItems.ts
// DM_BOSSES) and the run page's Bosses box on tonight's run there, started two hours ago with three bosses down
// (seed.setup.ts "plan the started Deadmines run", sample.ts sampleKills). The viewer is Nico: "Usable by" starts on
// his most recently played character, Ves the warlock.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const DM = "/dungeons/dm";

/** Tonight's Deadmines run, from the runs list's past runs. */
async function deadminesRun(page: Page): Promise<string> {
  await openScreen(page, "/runs?show=all");
  return (await page.getByRole("link", { name: /The Deadmines/ }).first().getAttribute("href"))!;
}

test("dungeon bosses & loot: design values", async ({ page }) => {
  await openScreen(page, DM);
  const loot = page.getByRole("region", { name: "Bosses & loot" });
  await expectStyles(loot, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(loot.getByRole("heading", { name: "Bosses & loot" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  await expectStyles(loot.getByText("Classic data"), { "font-size": "var(--fs-meta)", color: "var(--text-faint)" });
  const vancleef = loot.getByRole("region", { name: /Edwin VanCleef/ });
  await expectStyles(vancleef.getByRole("heading"), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-boss)",
    "letter-spacing": "var(--ls-tag)",
    color: "var(--gold-pale)",
  });
  await expectStyles(vancleef.getByText("6", { exact: true }), { "font-size": "var(--fs-meta)", color: "var(--boss-number)" });
  await expectStyles(vancleef.getByText("Cape of the Brotherhood"), {
    "font-size": "var(--fs-body)",
    "font-weight": "var(--fw-medium)",
    color: "var(--quality-rare-text)",
  });
  await expectStyles(vancleef.getByText("29%"), {
    "font-size": "var(--fs-body-sm)",
    color: "var(--text-chip)",
    "font-variant-numeric": "tabular-nums",
  });
  // Six drops, then the other two behind "Show 2 more".
  await expect(vancleef.getByRole("listitem")).toHaveCount(6);
  const more = vancleef.getByRole("button", { name: "Show 2 more ▾" });
  await expectStyles(more, { color: "var(--gold)", "border-color": "var(--line-neutral)", "border-radius": "var(--r-btn)" });
  // Ves is a warlock: leather is dimmed (icon dimmed, text faint), cloth is not.
  const leather = vancleef.getByRole("listitem").filter({ hasText: "Blackened Defias Armor" });
  await expectStyles(leather.getByText("Blackened Defias Armor"), { color: "var(--text-faint)" });
  await expectStyles(leather.locator("span").first(), { opacity: "var(--opacity-unusable)" });
  const cape = vancleef.getByRole("listitem").filter({ hasText: "Cape of the Brotherhood" });
  await expectStyles(cape.locator("span").first(), { opacity: "1" });
  const gilnid = loot.getByRole("region", { name: /Gilnid/ });
  await expectStyles(gilnid.getByText("Quest", { exact: true }), {
    "background-color": "var(--tag-quest-bg)",
    color: "var(--tag-quest-text)",
    "font-size": "var(--fs-overline)",
  });
  const cookie = loot.getByRole("region", { name: /Cookie/ });
  await expectStyles(cookie.getByText("optional"), { "font-size": "var(--fs-meta)", color: "var(--text-dim)" });
  await expectStyles(cookie.getByText("Nobody knows it"), {
    "background-color": "var(--tag-unknown-bg)",
    color: "var(--tag-unknown-text)",
  });
  // Ran here: when VanCleef last died, and who killed him.
  const ran = page.getByRole("region", { name: "Ran here" });
  await expect(ran.getByText("Last cleared Tue")).toBeVisible();
  await expectStyles(ran.getByText("Kel Dawnhammer"), { color: characterName("PALADIN").color! });
  if (!isPhone(page)) {
    const jump = page.getByRole("navigation", { name: "Bosses" });
    await expectStyles(jump, { position: "sticky", top: "var(--size-boss-sticky)" });
    await expectStyles(jump.getByRole("link", { name: /Rhahk/ }), { "font-weight": "var(--fw-semibold)" });
  } else {
    await expect(page.getByRole("navigation", { name: "Bosses" })).toBeHidden();
  }
});

test("dungeon bosses & loot: Usable by hides and is remembered; Show more", async ({ page }) => {
  await openScreen(page, DM);
  const loot = page.getByRole("region", { name: "Bosses & loot" });
  const vancleef = loot.getByRole("region", { name: /Edwin VanCleef/ });
  await vancleef.getByRole("button", { name: "Show 2 more ▾" }).click();
  await expect(vancleef.getByRole("listitem")).toHaveCount(8);
  const hide = loot.getByRole("switch", { name: "Hide what Ves Doombringer can't use" });
  await expect(hide).toHaveAttribute("aria-checked", "false");
  await hide.click();
  await expect(hide).toHaveAttribute("aria-checked", "true");
  // The cloth and the one-hand sword are left of VanCleef's eight for a warlock.
  await expect(vancleef.getByRole("listitem")).toHaveCount(3);
  await page.reload();
  await expect(loot.getByRole("switch", { name: /Ves Doombringer/ })).toHaveAttribute("aria-checked", "true");
  if (isPhone(page)) await expectTouchTargets(page);
  await expectAccessible(page);
});

test("dungeon bosses & loot: the recipe drop's tooltip", async ({ page }) => {
  test.skip(isPhone(page), "hover");
  await openScreen(page, DM);
  const recipe = page.getByRole("link", { name: "Recipe: Roast Raptor" });
  await expect(recipe).toHaveAttribute("href", "/professions/cooking?recipe=93002");
  await recipe.hover();
  const card = page.getByText("Can learn:").locator("..");
  await expect(card).toContainText("Lia Thornwhisper · Cooking 150");
  await expect(page.getByText("Click to open the recipe ›")).toBeVisible();
  // WEB-104: the item the recipe makes, under the recipe's own lines, in its quality colour.
  await expectStyles(page.getByText("Roast Raptor", { exact: true }), {
    color: "var(--quality-common)",
    "font-size": "var(--fs-game)",
  });
  await expectScreenshot(page, "dungeon-bosses-recipe");
});

test("dungeon bosses & loot: a set piece's tooltip (WEB-99)", async ({ page }) => {
  // Board WB99: hovering a loot row (desktop), the icon's sheet (phone); VanCleef's five Defias Leather pieces.
  await openScreen(page, DM);
  const vancleef = page.getByRole("region", { name: /Edwin VanCleef/ });
  if (isPhone(page)) {
    await vancleef.getByRole("button", { name: "Blackened Defias Armor, item details" }).click();
  } else {
    await vancleef.getByText("Blackened Defias Armor", { exact: true }).hover();
  }
  const card = page.getByText("Defias Leather (0/5)").locator("../..");
  await expectStyles(page.getByText("Defias Leather (0/5)"), {
    color: "var(--game-yellow)",
    "font-size": "var(--fs-game)",
    "margin-top": "0px",
  });
  await expectStyles(page.getByText("Defias Leather (0/5)").locator(".."), { "margin-top": "var(--s-2-5)" });
  const pieces = card.getByRole("list").first();
  await expect(pieces.getByRole("listitem")).toHaveText([
    "Blackened Defias Armor",
    "Blackened Defias Leggings",
    "Blackened Defias Gloves",
    "Blackened Defias Boots",
    "Blackened Defias Belt",
  ]);
  await expectStyles(pieces, { color: "var(--game-grey)", "padding-left": "var(--s-2-5)" });
  const bonuses = card.getByRole("list").nth(1);
  await expect(bonuses.getByRole("listitem")).toHaveText([
    "(2) Set: +50 Armor.",
    "(3) Set: Increases your chance to dodge an attack by 1%.",
    "(5) Set: +10 Agility.",
  ]);
  await expectStyles(bonuses, { color: "var(--game-grey)", "margin-top": "var(--s-2-5)" });
  if (isPhone(page)) {
    await expectStyles(page.getByRole("dialog"), { "background-color": "var(--surface-drawer)" });
    await expectTouchTargets(page);
  } else {
    await expectStyles(card.locator(".."), { width: "var(--size-game-tooltip)" });
  }
  await expectAccessible(page);
  await expectNoMotion(page);
  await expectScreenshot(page, "dungeon-bosses-set");
});

test("dungeon bosses & loot: touch targets", async ({ page }) => {
  test.skip(!isPhone(page));
  await openScreen(page, DM);
  await expectTouchTargets(page);
});

test("dungeon bosses & loot: accessibility", async ({ page }) => {
  await openScreen(page, DM);
  await expectAccessible(page);
});

test("dungeon bosses & loot: reduced motion", async ({ page }) => {
  await openScreen(page, DM);
  await expectNoMotion(page);
});

test("dungeon bosses & loot: screenshot", async ({ page }) => {
  await openScreen(page, DM);
  await expectScreenshot(page, "dungeon-bosses");
});

test("run bosses: design values", async ({ page }) => {
  await openScreen(page, await deadminesRun(page));
  await expect(page.getByRole("link", { name: "Dungeon page ›", exact: true })).toHaveAttribute("href", "/dungeons/dm");
  const box = page.getByRole("region", { name: "Bosses" });
  await expectStyles(box, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(box.getByText("3 of 6"), { "font-size": "var(--fs-body-sm)", color: "var(--text-chip)" });
  await expectStyles(box.getByRole("progressbar"), {
    height: "var(--size-boss-bar)",
    "background-color": "var(--boss-bar-track)",
  });
  await expectStyles(box.getByRole("progressbar").locator("i"), { "background-color": "var(--boss-bar-fill)" });
  await expect(box.getByText(/^as of \d{2}:\d{2} · Nico’s upload$/)).toBeVisible();
  const rhahk = box.getByRole("listitem").filter({ hasText: "Rhahk’Zor" });
  await expectStyles(rhahk, { "min-height": "var(--size-boss-row)", color: "var(--text)" });
  await expectStyles(rhahk.locator("span").first(), {
    width: "var(--size-boss-check)",
    "background-color": "var(--boss-killed)",
  });
  await expectStyles(box.getByRole("listitem").filter({ hasText: "Mr. Smite" }), { color: "var(--text-dim)" });
  await expect(box.getByRole("listitem").filter({ hasText: "Cookie" })).toContainText("optional");
  await expect(box.getByRole("link", { name: "Loot on the dungeon page ›" })).toHaveAttribute(
    "href",
    "/dungeons/dm#bosses-loot",
  );
});

test("run bosses: accessibility, motion, screenshot", async ({ page }) => {
  const href = await deadminesRun(page);
  await openScreen(page, href);
  if (isPhone(page)) await expectTouchTargets(page);
  await expectAccessible(page);
  await expectNoMotion(page);
  await expectScreenshot(page, "run-bosses");
});
