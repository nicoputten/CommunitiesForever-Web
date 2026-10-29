import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-24: professions on the sample data (seed.setup.ts): summary, cards, matrix, links to the roster and a character.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("sums up the group and shows every profession", async ({ page }) => {
  await page.goto("/professions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professions");
  // The recipe search is hidden until the addon shares recipes (WEB-65).
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  const summary = page.getByRole("list", { name: "Summary" }).getByRole("listitem");
  await expect(summary).toHaveText([
    "4 coveredSomeone is at 225 or higher: Enchanting, Tailoring, First Aid, Fishing",
    "3 thinBest is 175–224: Herbalism, Leatherworking, Skinning",
    "5 gapsBest is under 175: Alchemy 160, Blacksmithing 120, Engineering 70, Mining 142, Cooking 150",
  ]);

  const tailoring = card(page, "Tailoring");
  await expect(tailoring).toContainText("Covered");
  await expect(tailoring.getByRole("listitem")).toHaveText([
    "Mira Sunstrider★, best in the group300 / 300",
    "Lia Thornwhisper205 / 225",
    "Ves Doombringer187 / 225",
  ]);
  await expect(card(page, "Cooking")).toContainText("secondary");
  await expect(card(page, "Cooking")).toContainText("Gap");
  await expect(page.locator("section#first-aid")).toHaveCount(1);
});

test("the matrix lists characters by level, without professions last", async ({ page }) => {
  await page.goto("/professions");
  const matrix = page.getByRole("region", { name: "Professions by character" });
  const rows = matrix.getByRole("row");
  await expect(rows).toHaveCount(11);
  await expect(rows.nth(1)).toContainText("Mira Sunstrider 60");
  await expect(rows.nth(10)).toContainText("Zul Kazrek 15No professions yet");
  await expect(matrix.getByRole("columnheader", { name: "Alch" })).toHaveAttribute("scope", "col");
  await expect(matrix.locator("abbr[title=Alchemy]")).toHaveText("Alch");
});

test("a card title opens the roster on that profession, a name opens the character", async ({ page }) => {
  await page.goto("/professions");
  await card(page, "Tailoring").getByRole("link", { name: "Tailoring" }).click();
  await expect(page).toHaveURL(/\/roster\?prof=tailoring$/);
  await expect(page.getByText("3 of 10 characters")).toBeVisible();
  await page.goBack();
  await card(page, "Tailoring")
    .getByRole("link", { name: /Lia Thornwhisper/ })
    .click();
  await expect(page).toHaveURL(/\/character\/Player-/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lia Thornwhisper");
});

test("phone: one column, the matrix scrolls in its frame", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await page.goto("/professions");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const a = await card(page, "Alchemy").boundingBox();
  const b = await card(page, "Blacksmithing").boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
  const frame = page.getByRole("region", { name: "Professions by character" });
  expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});
