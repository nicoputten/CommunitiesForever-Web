import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-59: the Doomsday page on the made-up Doomsday sample (DOOMSDAY_SAMPLE=1, src/server/doomsdaySample.ts) until
// the engine (WEB-58) computes it from the uploads: the admin is the sample's uploader, Femke a PvP Virgin, Mira
// swapped a goal and wears the crown, Sanne has no addon.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

test("Doomsday from the navigation: today, week and board", async ({ page }) => {
  await page.goto("/");
  const nav = isPhone(page) ? page.locator("[data-tabbar]") : page.getByRole("banner");
  await nav.getByRole("link", { name: "Doomsday" }).click();
  await expect(page).toHaveURL(/\/doomsday$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Doomsday");

  // Today: the viewer's points per track, the goals, the Duel slot and Today so far.
  await expect(page.getByText("PvE 10").first()).toBeVisible();
  await expect(page.getByText("PvP 9").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Your goals · \w{3} \d+ \w{3}$/ })).toBeVisible();
  await expect(page.getByText("3 of 5 done")).toBeVisible();
  await expect(page.getByText(/^resets in \d+ (h|m)/)).toBeVisible();
  await expect(page.getByTestId("goal")).toHaveCount(5);
  await expect(page.getByText("First duel with each friend")).toBeVisible();
  await expect(page.getByText(/Won vs Bob/)).toBeVisible();
  await expect(page.getByText(/^Mira finished all dailies first/)).toBeVisible();
  await expect(page.getByText(/Sanne has no addon/)).toBeVisible();
  await expect(page.getByText("Goals are suggestions with points. Skip any of them; nothing is locked.")).toBeVisible();

  // The board: Mira crossed out with the crown, the swap in a tooltip, Femke a PvP Virgin, Sanne without the addon.
  const board = page.getByRole("table");
  const mira = board.getByRole("row", { name: /Mira/ });
  await expect(mira.getByText(/first · \d\d:\d\d/)).toBeVisible();
  await expect(mira.getByText("(all PvE dailies done)")).toBeAttached();
  await expect(mira.locator("[title='Instead of: Raise Cooking, First Aid or Fishing']")).toHaveCount(1);
  await expect(board.getByRole("row", { name: /Femke/ }).getByText("PvP Virgin")).toBeVisible();
  await expect(board.getByRole("row", { name: /Sanne/ })).toContainText("No addon yet");

  // Week: the 3 weeklies and the bounty.
  await page.getByRole("navigation", { name: "Doomsday" }).getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/doomsday\/week$/);
  await expect(page.getByTestId("goal")).toHaveCount(4);
  await expect(page.getByText(/^resets Sunday \d\d:\d\d · in /)).toBeVisible();

  // Board: the table and the 12-week heatmap, one row per friend with data.
  await page.getByRole("navigation", { name: "Doomsday" }).getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/\/doomsday\/board$/);
  // (The upload tests may add uploaders, who get Doomsday data too, so only named friends are checked.)
  for (const name of ["Mira", "Bob", "Femke", "Jorrit"]) {
    await expect(page.getByRole("img", { name: `${name}: goals per day over 12 weeks` })).toBeVisible();
  }
  await expect(page.getByText("Sanne: no Doomsday data yet.")).toBeVisible();
});

test("/doom is the short way to Doomsday", async ({ page }) => {
  await page.goto("/doom");
  await expect(page).toHaveURL(/\/doomsday$/);
});
