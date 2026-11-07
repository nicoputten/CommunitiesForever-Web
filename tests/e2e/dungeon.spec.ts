import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { planRun } from "./runs";
import { signInAs } from "./session";

// WEB-42: a planned run shows on the map's dungeon entrance; its popover (desktop) or sheet (phone) leads to the
// dungeon page, which lists who fits and the run, and plans a run with the dungeon filled in. Desktop and phone plan
// in different dungeons (the admin plays Ves Doombringer 39, who fits both), so each finds its own run.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

test("from the map's dungeon entrance to the dungeon page and Plan a run", async ({ page }) => {
  test.setTimeout(90_000);
  const phone = isPhone(page);
  const at = phone
    ? { id: "rfd", entrance: "Razorfen Downs", continent: "kalimdor", title: "Razorfen Downs" }
    : { id: "sm-library", entrance: "Scarlet Monastery", continent: "eastern-kingdoms", title: "Library" };
  const runId = await planRun(page, { dungeon: at.id, day: 1, time: "20:30", lead: "Ves Doombringer" });

  // With planned runs the entrance shows on its continent.
  await page.goto(`/?continent=${at.continent}`);
  const entrance = page.getByRole("button", { name: new RegExp(`^${at.entrance}, \\d+ planned$`) });
  await entrance.click();
  await expect(entrance).toHaveAttribute("aria-expanded", "true");
  const popover = page.getByTestId("dungeon-popover");
  await expect(popover.getByRole("heading", { name: at.entrance })).toBeVisible();
  await expect(popover.getByRole("link", { name: "Plan a run" })).toBeVisible();

  if (phone) {
    // Below 1024 px the popover is the bottom sheet's; Close returns to the roll call.
    await expect(page.locator("[data-snap]")).toHaveAttribute("data-snap", "half");
    await popover.getByRole("button", { name: "Close" }).click();
    await expect(popover).toBeHidden();
    await entrance.click();
    await popover.getByRole("link", { name: "Dungeon page" }).click();
  } else {
    // Scarlet Monastery lists its wings; Escape closes the popover.
    await expect(popover.getByRole("link", { name: /^Graveyard 26–36/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await entrance.click();
    await popover.getByRole("link", { name: /^Library 29–39/ }).click();
  }

  await expect(page).toHaveURL(new RegExp(`/dungeons/${at.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(at.title);
  const fits = page.getByRole("region", { name: "Who fits" });
  await expect(fits.getByText("Ves Doombringer", { exact: true })).toBeVisible();
  const planned = page.getByRole("region", { name: "Planned here" });
  await expect(planned.locator(`a[href="/runs/${runId}"]`)).toContainText("Ves Doombringer");
  // The Map tab stays current on a dungeon page.
  const nav = phone ? page.locator("[data-tabbar]") : page.getByRole("banner");
  await expect(nav.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");

  if (!phone) {
    const wings = page.getByRole("navigation", { name: "Scarlet Monastery wings" });
    await expect(wings.getByRole("link", { name: /^Library 29–39/ })).toHaveAttribute("aria-current", "page");
    await wings.getByRole("link", { name: /^Armory 32–42/ }).click();
    await expect(page).toHaveURL(/\/dungeons\/sm-armory$/);
    await expect(page.getByRole("region", { name: "Planned here" })).toContainText(/Other wings.*Library on/);
    await page.goto(`/dungeons/${at.id}`);
  }

  await page.getByRole("region", { name: at.title }).getByRole("link", { name: "Plan a run" }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/new\\?dungeon=${at.id}$`));

  // Clean up: the run goes, so the other tests' counts stay their own.
  await page.goto(`/runs/${runId}`);
  await page.getByRole("button", { name: "Delete run" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Cancelled by Nico")).toBeVisible();
});

test("Scarlet Monastery goes to its first wing; a raid or an unknown dungeon has no page", async ({ page }) => {
  await page.goto("/dungeons/sm");
  await expect(page).toHaveURL(/\/dungeons\/sm-graveyard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Graveyard");
  await expect(page.getByText("Levels 26–36 (typical)", { exact: true })).toBeVisible();
  for (const id of ["ony", "nope"]) {
    const res = await page.goto(`/dungeons/${id}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dungeon not found");
  }
});

// WEB-102 (board DL04): The Deadmines' bosses and loot from the sample item database (tests/design/sampleItems.ts),
// "Usable by" with the admin's most recently played character (Ves, a warlock), remembered; Show more; a recipe drop
// opens its recipe. WEB-97: Ran here says when VanCleef last died (the sample's kills).
test("the dungeon page's bosses and loot", async ({ page }) => {
  const phone = isPhone(page);
  await page.goto("/dungeons/dm");
  const loot = page.getByRole("region", { name: "Bosses & loot" });
  await expect(loot.getByRole("heading", { level: 3 })).toHaveText([
    /1\s*Rhahk’Zor/,
    /2\s*Sneed/,
    /3\s*Gilnid/,
    /4\s*Mr\. Smite/,
    /5\s*Captain Greenskin/,
    /6\s*Edwin VanCleef/,
    /7\s*Cookie\s*optional/,
  ]);
  await expect(page.getByRole("region", { name: "Ran here" }).getByText(/^Last cleared /)).toBeVisible();

  const vancleef = loot.getByRole("region", { name: /Edwin VanCleef/ });
  await expect(vancleef.getByRole("listitem")).toHaveCount(6);
  await vancleef.getByRole("button", { name: "Show 2 more ▾" }).click();
  await expect(vancleef.getByRole("listitem")).toHaveCount(8);

  const hide = loot.getByRole("switch", { name: "Hide what Ves Doombringer can't use" });
  await hide.click();
  await expect(vancleef.getByRole("listitem")).toHaveCount(3);
  // Another character: Grom the warrior can use all eight of VanCleef's (Show more stays open).
  await loot.getByRole("combobox", { name: "Usable by" }).click();
  await page.getByRole("option", { name: "Grom Ashfeller" }).click();
  await expect(loot.getByRole("switch", { name: "Hide what Grom Ashfeller can't use" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(vancleef.getByRole("listitem")).toHaveCount(8);
  await page.reload();
  await expect(loot.getByRole("switch", { name: "Hide what Grom Ashfeller can't use" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // The recipe nobody knows: its drawer.
  const cookie = loot.getByRole("region", { name: /Cookie/ });
  await expect(cookie.getByText("Nobody knows it")).toBeVisible();
  if (phone) {
    await cookie.getByRole("button", { name: "Recipe: Roast Raptor, item details" }).click();
    await page.getByRole("link", { name: "Open recipe" }).click();
  } else {
    await cookie.getByRole("link", { name: "Recipe: Roast Raptor" }).click();
  }
  await expect(page).toHaveURL(/\/professions\/cooking\?recipe=93002/);
  await expect(page.getByRole("dialog", { name: "Roast Raptor" })).toBeVisible();
});
