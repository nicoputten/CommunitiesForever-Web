import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  TYPE,
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

// WEB-92: design checks of the recipe screens (boards recipes-search, recipes-page, recipes-drawer, recipes-phone,
// recipes-states) on the sample data and the sample item database (sampleItems.ts).

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const VES = "Player-1-0000A001";

/** Opens a profession page and waits for the table's rows (skeleton rows until then, RC06 Loading). */
async function openRecipes(page: Page, url: string): Promise<void> {
  await openScreen(page, url);
  await expect(page.locator("[role=rowgroup][aria-busy]")).toHaveCount(0);
}

test("profession page: design values", async ({ page }) => {
  await openRecipes(page, "/professions/tailoring");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByText("11 of 13 recipes known"), { ...TYPE.body, color: "var(--text-dim)" });
  await expectStyles(page.getByRole("tab", { name: /All/ }), {
    ...TYPE.bodySm,
    "background-color": "var(--tint-tab)",
    color: "var(--text-strong)",
  });
  const table = page.getByRole("table", { name: "Recipes" });
  await expectStyles(table.getByRole("columnheader", { name: "Recipe" }), {
    "font-size": "var(--fs-overline)",
    "letter-spacing": "var(--ls-th)",
    color: "var(--text-faint)",
  });
  await expectStyles(table.getByRole("rowheader", { name: "Chest" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  const robe = table.getByRole("link", { name: "Robe of the Archmage" });
  await expectStyles(robe, { ...DATA, color: "var(--quality-epic-text)" });
  await expectStyles(table.getByRole("link", { name: "Mooncloth Robe" }), { color: "var(--quality-rare-text)" });
  if (!isPhone(page)) {
    await expectStyles(table.getByText("Nobody yet").first(), { color: "var(--text-faint)" });
    const skill = table
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "Robe of the Archmage" }) })
      .locator("[data-col=skill] [data-d]");
    await expectStyles(skill.first(), { color: "var(--skill-orange)", "font-size": "var(--fs-meta)" });
    await expectStyles(skill.last(), { color: "var(--skill-grey)" });
  }
});

test("profession page: drawer design values", async ({ page }) => {
  await openRecipes(page, "/professions/tailoring?recipe=91001");
  const drawer = page.getByRole("dialog", { name: "Robe of the Archmage" });
  await expect(drawer).toBeVisible();
  await expectStyles(drawer, { "background-color": "var(--surface-drawer)" });
  await expectStyles(drawer.getByRole("heading", { name: "Robe of the Archmage" }), {
    ...TYPE.name,
    "font-size": "var(--fs-title)",
    color: "var(--quality-epic-text)",
  });
  // The item tooltip in the game's look.
  const tooltip = drawer.getByText("Binds when equipped").locator("..");
  await expectStyles(tooltip, {
    "font-size": "var(--fs-game)",
    "border-top-color": "var(--line-game)",
    "border-radius": "var(--r-game)",
    color: "var(--game-text)",
  });
  await expectStyles(drawer.getByText(/^Equip:/), { color: "var(--game-green)" });
  await expectStyles(drawer.getByRole("heading", { name: "Reagents" }), {
    "font-size": "var(--fs-overline)",
    "letter-spacing": "var(--ls-overline)",
    color: "var(--text-faint)",
  });
  await expectStyles(drawer.getByText("×12"), { color: "var(--text-strong)", "font-weight": "var(--fw-semibold)" });
  await expectStyles(drawer.getByRole("button", { name: "Copy link" }), {
    "min-height": "var(--size-touch)",
    color: "var(--gold-bright)",
  });
});

test("WEB-98: where to get a reagent, design values (board reagent-sources)", async ({ page }) => {
  await openRecipes(page, "/professions/tailoring?recipe=91001");
  const drawer = page.getByRole("dialog", { name: "Robe of the Archmage" });
  const essence = drawer.getByRole("listitem").filter({ hasText: "Essence of Water" });
  const vendor = essence.getByRole("listitem").first();
  await expectStyles(vendor, {
    "font-size": "var(--fs-body-sm)",
    color: "var(--text-chip)",
  });
  await expectStyles(vendor.getByText("Vendor", { exact: true }), { color: "var(--text-dim)" });
  await expectStyles(vendor.locator("svg"), { color: "var(--gold)", width: "var(--size-icon)" });
  await expectStyles(vendor.getByText("limited stock"), {
    "font-size": "var(--fs-meta-sm)",
    "font-weight": "var(--fw-semibold)",
    "background-color": "var(--tag-limited-bg)",
    color: "var(--pill-soon-text)",
    "border-top-left-radius": "var(--r-pill)",
  });
  await expectStyles(essence.getByText("12%"), { color: "var(--text)" });
  await expectStyles(drawer.getByRole("link", { name: "Bolt of Runecloth ›" }), { color: "var(--gold)" });
  await expectStyles(drawer.getByRole("listitem").filter({ hasText: "Bolt of Runecloth" }).first(), {
    "border-bottom-color": "var(--line-reagent)",
  });

  await openRecipes(page, "/professions/tailoring?recipe=91002");
  await expectStyles(page.getByRole("dialog").getByText("No known source"), {
    "font-size": "var(--fs-body-sm)",
    color: "var(--text-faint)",
  });

  await openRecipes(page, "/professions/leatherworking?recipe=97001");
  const leather = page.getByRole("dialog").getByRole("listitem").filter({ hasText: "Heavy Leather" });
  await expect(leather.getByRole("listitem")).toHaveText([
    "Skinning · beasts, level 30–45",
    /^Vendor · Hadda Stonebrow · Arathi Highlands/,
    "Drop · Duskpelt Prowler 6% · Elder Duskpelt Prowler 4%",
  ]);
  await expectStyles(leather.locator("svg").first(), { color: "var(--source-skin)" });

  // Engineering's bomb uses Blacksmithing's grinding stone: its recipe opens in the drawer, with Back.
  await openRecipes(page, "/professions/engineering?recipe=96001");
  await page.getByRole("dialog").getByRole("link", { name: "Heavy Grinding Stone ›" }).click();
  const stone = page.getByRole("dialog", { name: "Heavy Grinding Stone" });
  await expect(stone.getByText("Blacksmithing · Trade Goods")).toBeVisible();
  await expect(stone.getByText("Mining · Iron Deposit · Tin Vein")).toBeVisible();
  await expectStyles(stone.getByRole("button", { name: "Back to Big Iron Bomb" }), {
    width: isPhone(page) ? "var(--size-touch)" : "var(--size-drawer-close)",
    "border-top-color": "var(--line-neutral)",
  });
});

test("professions page: the live search", async ({ page }) => {
  await openScreen(page, "/professions");
  const search = page.getByRole("combobox", { name: "Who can craft…" });
  await expectStyles(search.locator(".."), {
    "border-radius": "var(--r-card)",
    "background-color": "var(--surface-search)",
  });
  await search.fill("robe");
  const results = page.getByRole("listbox", { name: "Recipes" });
  await expect(results.getByRole("option")).toHaveCount(3);
  await expectStyles(results.getByText("Can craft"), {
    "font-size": "var(--fs-overline)",
    color: "var(--text-faint)",
  });
  await expectStyles(results.getByRole("option").first(), { "background-color": "var(--tint-result)" });
  await expectStyles(page.getByRole("link", { name: "11 of 13 recipes ›" }), {
    ...TYPE.meta,
    color: "var(--gold)",
  });
  await expectAccessible(page);
  await expectScreenshot(page, "professions-search");
});

for (const [name, url] of [
  ["profession-tailoring", "/professions/tailoring"],
  ["profession-drawer", "/professions/tailoring?recipe=91001"],
  // WEB-98 (board reagent-sources): gathered sources, a crafted reagent's recipe with Back, a reagent with none.
  ["profession-drawer-gathered", "/professions/leatherworking?recipe=97001"],
  ["profession-drawer-crafted", "/professions/engineering?recipe=95001&back=96001"],
  ["profession-drawer-none", "/professions/tailoring?recipe=91002"],
  ["profession-nobody-has", "/professions/tailoring?tab=missing"],
  ["profession-one-character", `/professions/tailoring?char=${VES}`],
  ["profession-no-results", "/professions/tailoring?q=felclth%20hod"],
  ["profession-not-scanned", "/professions/engineering"],
] as const) {
  test(`${name}: touch targets`, async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await openRecipes(page, url);
    await expectTouchTargets(page);
  });

  test(`${name}: accessibility`, async ({ page }) => {
    await openRecipes(page, url);
    await expectAccessible(page);
  });

  test(`${name}: reduced motion`, async ({ page }) => {
    await openRecipes(page, url);
    await expectNoMotion(page);
  });

  test(`${name}: screenshot`, async ({ page }) => {
    await openRecipes(page, url);
    await expectScreenshot(page, name, [], () => openRecipes(page, url));
  });
}

test("phone: an icon tap opens the item tooltip as a sheet", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openRecipes(page, "/professions/tailoring");
  await page.getByRole("button", { name: "Robe of the Archmage, item details" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Open recipe" })).toBeVisible();
  await expectStyles(sheet, { "background-color": "var(--surface-drawer)", "border-top-left-radius": "var(--r-sheet)" });
  await expectTouchTargets(page);
  await expectAccessible(page);
  await expectScreenshot(page, "profession-icon-sheet");
});

test("character page: the recipe line under each crafting profession", async ({ page }) => {
  await openScreen(page, `/character/${VES}`);
  const professions = page.getByRole("region", { name: "Professions" });
  await expectStyles(professions.getByRole("link", { name: "3 recipes ›" }), { ...TYPE.meta, color: "var(--gold)" });
  await expect(professions.getByText("Recipes not scanned")).toBeVisible();
  await expectStyles(professions.getByText(/^as of/).first(), { color: "var(--text-dim)" });
});
