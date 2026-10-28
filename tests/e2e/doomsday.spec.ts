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

// WEB-60: the ladder (this week and all time), a friend's PvP details from the ladder and the chips, the feats.
test("Doomsday ladder, PvP details and feats", async ({ page }) => {
  await page.goto("/doomsday");
  const tabs = page.getByRole("navigation", { name: "Doomsday" });
  await tabs.getByRole("link", { name: "Ladder" }).click();
  await expect(page).toHaveURL(/\/doomsday\/ladder$/);

  // Two rankings, never added together; Femke is a PvP Virgin, shown and not ranked.
  const pve = page.getByRole("region", { name: /^PvE · this week/ });
  const pvp = page.getByRole("region", { name: /^PvP · this week/ });
  await expect(pve.locator("summary").first()).toContainText("Mira");
  await expect(pvp.locator("summary").first()).toContainText("Bob");
  await expect(pvp.locator("summary").filter({ hasText: "Femke" })).toHaveCount(0);
  await expect(pvp.getByText("not ranked: no kills on any character, ever")).toBeVisible();

  // A row opens to the split per character.
  const bob = pvp.locator("details").filter({ hasText: "Bob" }).first();
  await bob.locator("summary").click();
  await expect(bob.getByText("Bob Example")).toBeVisible();
  await expect(bob.getByText("Tok Ironhide")).toBeVisible();

  // All time: no movement.
  await page.getByRole("navigation", { name: "Ladder period" }).getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/scope=all$/);
  await expect(page.getByRole("region", { name: /^PvP · all time/ })).toContainText("1,540");
  await expect(page.getByText("▲ 1")).toHaveCount(0);

  // Bob's PvP details from the ladder, then Mira's with the chips.
  // A fresh load: a row opened before stays open across client navigation.
  await page.goto("/doomsday/ladder");
  const bobRow = page
    .getByRole("region", { name: /^PvP · this week/ })
    .locator("details")
    .filter({ hasText: "Bob" });
  await bobRow.locator("summary").click();
  await bobRow.getByRole("link", { name: "PvP details" }).click();
  await expect(page).toHaveURL(/\/doomsday\/pvp\?friend=/);
  await expect(page.getByRole("heading", { name: "PvP details · Bob" })).toBeVisible();
  await expect(page.getByText("Blood Guard · rank 7")).toBeVisible();
  await expect(page.getByText("1st", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Friend" }).getByRole("link", { name: "Mira" }).click();
  await expect(page.getByRole("heading", { name: "PvP details · Mira" })).toBeVisible();
  // Its place depends on how many uploaders the upload tests added (each gets the sample's rating).
  await expect(page.getByText(/^\d+(st|nd|rd|th) · Bob 1,112$/)).toBeVisible();

  // Feats: the group's newest first with First in the group; your own with the next steps.
  await tabs.getByRole("link", { name: "Feats" }).click();
  await expect(page).toHaveURL(/\/doomsday\/feats$/);
  await expect(page.getByTestId("feat").first()).toContainText("Stone Guard, a.k.a. Mailbox Menace");
  await expect(page.getByTestId("feat").filter({ hasText: "First epic" })).toContainText("First in the group");
  await expect(page.getByRole("heading", { name: "Your feats" })).toBeVisible();
  await expect(page.getByText("412 / 1,000")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Grass: Untouched" })).toBeVisible();
});

test("/doom is the short way to Doomsday", async ({ page }) => {
  await page.goto("/doom");
  await expect(page).toHaveURL(/\/doomsday$/);
});
