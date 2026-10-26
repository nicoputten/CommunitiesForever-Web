import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-22: the roster table on the sample data (seed.setup.ts): sort by the headers, group by friend, the cards'
// filters in the URL; on a phone the card list and the filter sheet.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const table = (page: Page) => page.getByRole("table");
const rowNames = (page: Page) => table(page).locator("tbody tr td:first-child a").allInnerTexts();
const header = (page: Page, name: string) => table(page).getByRole("columnheader", { name, exact: false });

test.describe("desktop", () => {
  test.skip(({ page }) => isPhone(page), "desktop only");

  test("shows every character, newest played first", async ({ page }) => {
    await page.goto("/roster/table");
    await expect(page.getByText("10 characters · sorted by last played")).toBeVisible();
    expect(await rowNames(page)).toHaveLength(10);
    await expect(header(page, "Last played")).toHaveAttribute("aria-sort", "descending");
    const ruk = table(page).getByRole("row", { name: /Ruk Bloodhoof/ });
    await expect(ruk).toContainText("Jorrit · 9 d old");
    await expect(ruk).toContainText("Beast Mastery 18/0/0");
    const sela = table(page).getByRole("row", { name: /Sela Moonbrook/ });
    await expect(sela).toContainText("Location unknown");
    await expect(page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Table" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("sorts by a header, reverses on a second click, and Back undoes it", async ({ page }) => {
    await page.goto("/roster/table");
    await header(page, "Level").getByRole("link").click();
    await expect(page).toHaveURL(/\/roster\/table\?sort=level$/);
    await expect(header(page, "Level")).toHaveAttribute("aria-sort", "descending");
    expect((await rowNames(page))[0]).toBe("Mira Sunstrider");
    await header(page, "Level").getByRole("link").click();
    await expect(page).toHaveURL(/sort=level&dir=asc$/);
    await expect(header(page, "Level")).toHaveAttribute("aria-sort", "ascending");
    expect((await rowNames(page))[0]).toBe("Sela Moonbrook");
    await header(page, "Last seen in").getByRole("link").click();
    await expect(page).toHaveURL(/sort=seen$/);
    expect((await rowNames(page)).at(-1)).toBe("Sela Moonbrook");
    await page.goBack();
    await expect(page).toHaveURL(/sort=level&dir=asc$/);
  });

  test("keeps the cards' filters, and filters the same way", async ({ page }) => {
    await page.goto("/roster?class=warlock");
    await page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Table" }).click();
    await expect(page).toHaveURL(/\/roster\/table\?class=warlock$/);
    expect(await rowNames(page)).toEqual(["Ves Doombringer", "Zul Kazrek"]);
    await expect(page.getByText("2 of 10 characters")).toBeVisible();
    await page.getByRole("button", { name: "Role" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Damage" }).click();
    await expect(page).toHaveURL(/\/roster\/table\?class=warlock&role=dps$/);
    await page.keyboard.press("Escape");
    await header(page, "Character").getByRole("link").click();
    await expect(page).toHaveURL(/\/roster\/table\?class=warlock&role=dps&sort=name$/);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/roster\/table\?sort=name$/);
    expect(await rowNames(page)).toHaveLength(10);
  });

  test("groups by friend", async ({ page }) => {
    await page.goto("/roster/table?sort=level");
    await page.getByRole("button", { name: "Group by friend" }).click();
    await expect(page).toHaveURL(/sort=level&group=friend$/);
    await expect(page.getByRole("button", { name: "Group by friend" })).toHaveAttribute("aria-pressed", "true");
    await expect(header(page, "Player")).toHaveCount(0);
    const groups = table(page).locator("tbody");
    await expect(groups).toHaveCount(5);
    await expect(groups.first().getByRole("rowheader")).toContainText(`Nico${E2E.admin} · 3 characters`);
    expect(await groups.first().locator("tr td:first-child a").allInnerTexts()).toEqual([
      "Ves Doombringer",
      "Grom Ashfeller",
      "Sela Moonbrook",
    ]);
  });

  test("opens a character from its name", async ({ page }) => {
    await page.goto("/roster/table");
    await table(page).getByRole("link", { name: "Ves Doombringer" }).click();
    await expect(page).toHaveURL(/\/character\/Player-1-0000A001$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/roster\/table$/);
  });
});

test.describe("phone", () => {
  test.skip(({ page }) => !isPhone(page), "phone only");

  test("shows the card list, with filters and sort in a sheet", async ({ page }) => {
    await page.goto("/roster/table");
    await expect(table(page)).toBeHidden();
    const rows = page.getByRole("main").getByRole("link", { name: /Ves Doombringer/ });
    await expect(rows).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await page.getByRole("button", { name: "Filters & sort" }).click();
    const sheet = page.getByRole("dialog", { name: "Filters & sort" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("group", { name: "Sort" }).getByRole("button", { name: "Level" }).click();
    await expect(page).toHaveURL(/\/roster\/table\?sort=level$/);
    await sheet.getByRole("button", { name: "Ascending" }).click();
    await expect(page).toHaveURL(/sort=level&dir=asc$/);
    await sheet.getByRole("group", { name: "Class" }).getByRole("button", { name: "Warlock" }).click();
    await expect(page).toHaveURL(/class=warlock&sort=level&dir=asc$/);
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters & sort · 1" })).toBeVisible();
    const names = await page.getByRole("main").locator("a span[class*=name]:visible").allInnerTexts();
    expect(names).toEqual(["Zul Kazrek", "Ves Doombringer"]);

    await page.getByRole("button", { name: "Filters & sort · 1" }).click();
    await sheet.getByRole("button", { name: "Group by friend" }).click();
    await expect(page).toHaveURL(/group=friend$/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Femke", exact: true })).toBeVisible();
  });
});
