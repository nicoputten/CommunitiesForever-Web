import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-59..61: the Doomsday page on what the engine (WEB-58) computes from the seeded sample (WEB-63), on the real
// clock: the day's draw and what's done today depend on the time, so these checks hold at any hour. The admin is the
// sample's uploader (Nico), Femke never killed anyone (a PvP Virgin), Sanne has no addon. They run before the upload
// tests add uploaders (playwright.config.ts).

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

test("Doomsday from the navigation: today, week and board", async ({ page }) => {
  await page.goto("/");
  const nav = isPhone(page) ? page.locator("[data-tabbar]") : page.getByRole("banner");
  await nav.getByRole("link", { name: "Doomsday" }).click();
  await expect(page).toHaveURL(/\/doomsday$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Doomsday");

  // Today: the viewer's points per track, the goals (3 PvE dailies and the Skirmish), the Duel slot, Today so far.
  await expect(
    page
      .getByText(/^PvE \d+$/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/^PvP \d+$/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Your goals · \w{3} \d+ \w{3}$/ })).toBeVisible();
  await expect(page.getByText(/^\d of 4 done$/)).toBeVisible();
  await expect(page.getByText(/^resets in \d+ (h|m)/).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId("goal")).toHaveCount(4);
  await expect(page.getByText("First duel with each friend")).toBeVisible();
  await expect(page.getByText(/Sanne has no addon/)).toBeVisible();
  // The explanation is in the ⓘ next to "Your goals" (WEB-65): it opens on a tap or a click.
  const tip = page.getByRole("tooltip").filter({ hasText: "Goals are suggestions with points." });
  await expect(tip).toBeHidden();
  await page
    .getByRole("region", { name: /^Your goals/ })
    .getByRole("button", { name: "More info" })
    .click();
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  // The board: Femke a PvP Virgin, Sanne without the addon (on the phone one card per friend, WEB-61).
  if (isPhone(page)) {
    const card = (name: string) => page.getByTestId("board-card").filter({ hasText: name });
    await expect(card("Femke").getByText("PvP Virgin")).toBeVisible();
    await expect(card("Sanne")).toContainText("No addon yet");
  } else {
    const board = page.getByRole("table");
    await expect(board.getByRole("row", { name: /Femke/ }).getByText("PvP Virgin")).toBeVisible();
    await expect(board.getByRole("row", { name: /Sanne/ })).toContainText("No addon yet");
  }

  // Week: the 3 weeklies and the bounty.
  await page.getByRole("navigation", { name: "Doomsday" }).getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/doomsday\/week$/);
  await expect(page.getByTestId("goal")).toHaveCount(4);
  await expect(page.getByText(/^resets Sunday \d\d:\d\d · in /)).toBeVisible();

  // Board: the table and the 12-week heatmap, one row per friend with Doomsday data.
  await page.getByRole("navigation", { name: "Doomsday" }).getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/\/doomsday\/board$/);
  for (const name of ["Nico", "Mira", "Bob", "Femke", "Jorrit"]) {
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
  await expect(pve.locator("summary").filter({ hasText: "Femke" })).toHaveCount(1);
  // The phone shows one track at a time (WEB-61).
  if (isPhone(page)) await page.goto("/doomsday/ladder?track=pvp");
  await expect(pvp.locator("summary").filter({ hasText: "Bob" })).toHaveCount(1);
  await expect(pvp.locator("summary").filter({ hasText: "Femke" })).toHaveCount(0);
  await expect(pvp.getByText("not ranked: no kills on any character, ever")).toBeVisible();

  // A row opens to the split per character; the viewer's is open.
  await expect(pvp.locator("details[open]").filter({ hasText: "Nico" })).toContainText("Ves Doombringer");
  const bob = pvp.locator("details").filter({ hasText: "Bob" }).first();
  await bob.locator("summary").click();
  await expect(bob.getByText("Bob Example")).toBeVisible();

  // All time: no movement.
  await page.getByRole("navigation", { name: "Ladder period" }).getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/scope=all/);
  await expect(page.getByRole("region", { name: /^PvP · all time/ }).locator("summary")).not.toHaveCount(0);
  await expect(page.getByText(/^[▲▼] \d/)).toHaveCount(0);

  // Bob's PvP details from the ladder (a fresh load: a row opened before stays open across client navigation), then
  // Mira's with the chips.
  await page.goto("/doomsday/ladder?track=pvp");
  const bobRow = page
    .getByRole("region", { name: /^PvP · this week/ })
    .locator("details")
    .filter({ hasText: "Bob" });
  await bobRow.locator("summary").click();
  await bobRow.getByRole("link", { name: "PvP details" }).click();
  await expect(page).toHaveURL(/\/doomsday\/pvp\?friend=/);
  await expect(page.getByRole("heading", { name: "PvP details · Bob" })).toBeVisible();
  await expect(page.getByText("Blood Guard · rank 7")).toBeVisible();
  await page.getByRole("navigation", { name: "Friend" }).getByRole("link", { name: "Mira" }).click();
  await expect(page.getByRole("heading", { name: "PvP details · Mira" })).toBeVisible();
  await expect(page.getByText("Senior Sergeant · rank 4")).toBeVisible();

  // Feats: the e2e seed is the site's first upload, so every feat is from before tracking (WEB-56): none in the
  // group's list, all in your own, with the next steps.
  await tabs.getByRole("link", { name: "Feats" }).click();
  await expect(page).toHaveURL(/\/doomsday\/feats$/);
  await expect(page.getByText("No feats yet. They appear as characters reach them.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your feats" })).toBeVisible();
  await expect(page.getByText("Ves Doombringer · before tracking").first()).toBeVisible();
  await expect(page.getByText("132 / 1,000")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Grass: Untouched" })).toBeVisible();
});

test("/doom is the short way to Doomsday", async ({ page }) => {
  await page.goto("/doom");
  await expect(page).toHaveURL(/\/doomsday$/);
});

// WEB-61: the phone ladder shows one track at a time; the roster cards carry each friend's Doomsday chip.
test("phone ladder switch and the roster chips", async ({ page }) => {
  await page.goto("/doomsday/ladder");
  if (isPhone(page)) {
    await expect(page.getByRole("region", { name: /^PvP · this week/ })).toBeHidden();
    await page.getByRole("navigation", { name: "Track" }).getByRole("link", { name: "PvP" }).click();
    await expect(page).toHaveURL(/track=pvp/);
    await expect(page.getByRole("region", { name: /^PvP · this week/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /^PvE · this week/ })).toBeHidden();
    // All time keeps the track.
    await page.getByRole("navigation", { name: "Ladder period" }).getByRole("link", { name: "All time" }).click();
    await expect(page).toHaveURL(/scope=all&track=pvp/);
  } else {
    await expect(page.getByRole("region", { name: /^PvP · this week/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /^PvE · this week/ })).toBeVisible();
  }

  await page.goto("/roster");
  const bob = page.getByRole("region", { name: "Bob" });
  await expect(bob.getByRole("link", { name: /^Doomsday this week: PvE \d+ PvP \d+ streak \d+$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Femke" }).getByText("PvP Virgin")).toBeVisible();
  await bob.getByRole("link", { name: /^Doomsday this week/ }).click();
  await expect(page).toHaveURL(/\/doomsday\/ladder$/);
});
