import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-92: recipes on the sample data and the sample item database (seed.setup.ts, tests/design/sampleItems.ts): the
// live search, the recipe lines, the profession page with its filters in the URL and the drawer.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const VES = "Player-1-0000A001";

test("the live search finds who can craft it and opens the recipe", async ({ page }) => {
  await page.goto("/professions");
  const search = page.getByRole("combobox", { name: "Who can craft…" });
  await search.fill("r");
  await expect(page.getByRole("option")).toHaveCount(0);
  await search.fill("robe");
  const options = page.getByRole("listbox", { name: "Recipes" }).getByRole("option");
  await expect(options).toHaveCount(3);
  await expect(options.first()).toContainText("Robe of the Archmage");
  await expect(options.first()).toContainText("Mira Sunstrider");
  await expect(page.getByRole("link", { name: "All Tailoring recipes ›" })).toBeVisible();
  // Typo-tolerant: "vestmnts" still finds the one nobody knows, with where it's learned.
  await search.fill("vestmnts");
  await expect(page.getByRole("group", { name: "Nobody yet" })).toContainText("Truefaith Vestments");
  await expect(page.getByRole("group", { name: "Nobody yet" })).toContainText("Lower Blackrock Spire");
  await search.press("Escape");
  await expect(page.getByRole("listbox", { name: "Recipes" })).toBeHidden();
  await search.fill("archmage");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/professions\/tailoring\?recipe=91001$/);
  await expect(page.getByRole("dialog", { name: "Robe of the Archmage" })).toBeVisible();
});

test("every crafting card links to its recipes", async ({ page }) => {
  await page.goto("/professions");
  const tailoring = page.getByRole("region", { name: "Tailoring", exact: true });
  await tailoring.getByRole("link", { name: "11 of 13 recipes ›" }).click();
  await expect(page).toHaveURL(/\/professions\/tailoring$/);
  await expect(page.getByText("11 of 13 recipes known")).toBeVisible();
  // Gathering and Fishing cards have no recipe line.
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Fishing", exact: true }).getByRole("link", { name: /recipes/ }),
  ).toHaveCount(0);
});

test("the profession page keeps tabs and filters in the URL, and a row opens the drawer", async ({ page }) => {
  await page.goto("/professions/tailoring");
  const table = page.getByRole("table", { name: "Recipes" });
  await expect(table.getByRole("rowheader", { name: "Chest" })).toBeVisible();
  // Forever's own recipe without a name shows its fallback name; it counts, but not as Nobody has.
  await expect(table.getByText("Item 279972")).toBeVisible();
  await page.getByRole("tab", { name: "Nobody has 2" }).click();
  await expect(page).toHaveURL(/tab=missing/);
  await expect(table.getByRole("link")).toHaveText(["Truefaith Vestments", "Flarecore Gloves"]);
  await page.getByRole("tab", { name: "All 13" }).click();
  await page.getByRole("searchbox", { name: "Search Tailoring" }).fill("felclth hod");
  await expect(page.getByText("No recipe matches “felclth hod”")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/professions\/tailoring$/);

  await table.getByRole("link", { name: "Robe of the Archmage" }).click();
  await expect(page).toHaveURL(/recipe=91001/);
  const drawer = page.getByRole("dialog", { name: "Robe of the Archmage" });
  await expect(drawer.getByText("Tailoring · Chest")).toBeVisible();
  await expect(drawer.getByRole("listitem").filter({ hasText: "Bolt of Runecloth" })).toContainText("×12");
  await expect(drawer.getByText("Drop · Blackrock Spire")).toBeVisible();
  await expect(drawer).not.toContainText(/gold|sell/i);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/professions\/tailoring$/);
});

test("the character page links each crafting profession to its recipes", async ({ page }) => {
  await page.goto(`/character/${VES}`);
  const professions = page.getByRole("region", { name: "Professions" });
  await expect(professions.getByText("Recipes not scanned")).toBeVisible();
  await expect(professions.getByText(/^as of/).first()).toBeVisible();
  await professions.getByRole("link", { name: "3 recipes ›" }).click();
  await expect(page).toHaveURL(/\/professions\/tailoring\?char=Player-1-0000A001$/);
  // Opens on Known, which means "Ves knows it".
  await expect(page.getByRole("tab", { name: "Known 3" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table", { name: "Recipes" }).getByRole("link")).toHaveCount(3);
});

test("a profession nobody opened in game says so and still lists its recipes", async ({ page }) => {
  await page.goto("/professions/engineering");
  await expect(page.getByText("No recipes scanned yet")).toBeVisible();
  await page.getByRole("link", { name: "See all recipes" }).click();
  await expect(page).toHaveURL(/tab=all/);
  await expect(page.getByRole("table", { name: "Recipes" }).getByRole("link", { name: "Big Iron Bomb" })).toBeVisible();
});

// WEB-104: a link to a recipe (a boss's recipe drop, the bot) opens its drawer before anyone scanned the profession;
// closing it stays on all recipes.
test("a recipe link opens its drawer on a profession nobody opened in game", async ({ page }) => {
  await page.goto("/professions/engineering?recipe=96001");
  const drawer = page.getByRole("dialog", { name: "Big Iron Bomb" });
  await expect(drawer).toBeVisible();
  await expect(page.getByText("No recipes scanned yet")).toBeHidden();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/professions\/engineering\?tab=all$/);
  await expect(page.getByRole("table", { name: "Recipes" }).getByRole("link", { name: "Big Iron Bomb" })).toBeVisible();
});

test("on a phone a row opens the recipe as a sheet", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await page.goto("/professions/tailoring");
  await page.getByRole("table", { name: "Recipes" }).getByRole("link", { name: "Truefaith Vestments" }).click();
  const sheet = page.getByRole("dialog", { name: "Truefaith Vestments" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});
