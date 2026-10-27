import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-28: the phone map on the sample data: the roll call sheet (peek, half, full), a tapped character in the half
// sheet with Back, the edge hint, and a continent that stays framed (the spring-back bug).

test.beforeEach(async ({ context, baseURL, page }) => {
  test.skip(!isPhone(page), "phone only: the desktop has the roll call panel (WEB-27)");
  await signInAs(context, baseURL!, E2E.admin);
});

const sheet = (page: Page) => page.locator("[data-snap]");
const stage = (page: Page) => page.locator("[data-level]");

test("a continent stays framed: no spring-back to the whole world", async ({ page }) => {
  await page.goto("/?continent=eastern-kingdoms");
  await expect(stage(page)).toHaveAttribute("data-level", "continent");
  // Longer than the settle (MapStage SETTLE_MS, 120 ms) and the spring-back that used to follow it.
  await page.waitForTimeout(800);
  await expect(stage(page)).toHaveAttribute("data-level", "continent");
  await expect(page).toHaveURL(/\?continent=eastern-kingdoms$/);
});

test("the peek opens a character at half; next, Back and the edge hint", async ({ page }) => {
  await page.goto("/?continent=eastern-kingdoms");
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
  await expect(sheet(page).getByRole("heading", { name: "Roll call" })).toBeVisible();

  await page.getByRole("button", { name: /^Ves Doombringer · 2 h/ }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "half");
  await expect(page).toHaveURL(/character=/);
  await expect(stage(page)).toHaveAttribute("data-level", "zone");
  const half = page.getByRole("region", { name: "Ves Doombringer" });
  await expect(half.getByText("Level 39 Undead Warlock · Horde")).toBeVisible();
  await expect(half.getByRole("link", { name: "Open character" })).toHaveAttribute("href", /^\/character\//);
  await expect(page.getByRole("banner")).toContainText("Stranglethorn Vale");
  await expect(page.getByRole("banner")).toContainText("2 here");

  // The next character in the zone replaces it; Back closes the sheet in one step.
  await half.getByRole("button", { name: /^Lia Thornwhisper · 1 h/ }).click();
  await expect(page.getByRole("region", { name: "Lia Thornwhisper" })).toBeVisible();
  await page.goBack();
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
  await expect(page).not.toHaveURL(/character=/);

  // The edge hint flies to the other continent.
  await page.getByRole("button", { name: /^\d+ in Kalimdor$/ }).click();
  await expect(page).toHaveURL(/\?continent=kalimdor$/);
  await expect(page.getByRole("button", { name: /^\d+ in Eastern Kingdoms$/ })).toBeVisible();
});

test("a marker tap opens the sheet; the app bar's back arrow closes it", async ({ page }) => {
  await page.goto("/?continent=eastern-kingdoms");
  await page.getByRole("button", { name: /^Tok Ironhide,/ }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "half");
  await expect(page.getByRole("region", { name: "Tok Ironhide" })).toBeVisible();
  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
  await expect(page).not.toHaveURL(/character=/);
});

test("Filters opens the full roll call; its filters filter the map; the handle collapses it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "full");
  await sheet(page).getByRole("group", { name: "Friend" }).getByRole("button", { name: "Bob" }).click();
  await expect(page).toHaveURL(/friend=/);
  await expect(sheet(page)).toHaveAttribute("data-snap", "full");
  await expect(page.getByRole("button", { name: /^Tok Ironhide,/ })).toBeAttached();
  await expect(page.getByRole("button", { name: /^Ves Doombringer,/ })).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Collapse roll call" }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
});

test("dragging the sheet up snaps it to full, down back to peek", async ({ page }) => {
  await page.goto("/");
  const handle = page.getByRole("button", { name: "Open roll call" });
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, 150, { steps: 12 });
  await page.mouse.up();
  await expect(sheet(page)).toHaveAttribute("data-snap", "full");

  const back = (await sheet(page).getByRole("button", { name: "Collapse roll call" }).boundingBox())!;
  await page.mouse.move(x, back.y + back.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, 780, { steps: 12 });
  await page.mouse.up();
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
});
