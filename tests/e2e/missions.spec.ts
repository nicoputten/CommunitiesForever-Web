import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-79: the owner's Mission pool. Desktop and phone share the database and run at the same time, so each project
// steers its own day and switches its own mission, and puts things back as it found them.

const PER_PROJECT: Record<string, { day: number; mission: string }> = {
  desktop: { day: 4, mission: "Finish 20 quests" },
  phone: { day: 6, mission: "Hand in quests in 3 zones" },
};

const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("the owner opens the pool from the Admin page, steers a day and switches a mission off and on", async ({
  page,
  context,
  baseURL,
}, info) => {
  const mine = PER_PROJECT[info.project.name] ?? PER_PROJECT.desktop!;
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/admin");
  const box = region(page, "Doomsday missions");
  await expect(box).toContainText("missions");
  await box.getByRole("link", { name: "Open mission pool" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mission pool" })).toBeVisible();

  // The next 14 days: today and tomorrow locked.
  const days = page.getByTestId("mission-day");
  await expect(days).toHaveCount(14);
  await expect(days.nth(0)).toContainText("today");
  await expect(days.nth(1)).toContainText("tomorrow");
  await expect(page.getByTestId("mission-week")).toHaveCount(2);

  // A locked day shows its set without buttons.
  await days.nth(0).click();
  const editor = page.getByRole("region").filter({ has: page.locator("#mission-editor") });
  await expect(editor).toContainText("Locked");
  await expect(editor.getByRole("button", { name: /^Reroll/ })).toHaveCount(0);

  // A free day: pin a mission in Daily 1, then back to the normal draw.
  await days.nth(mine.day).click();
  await expect(editor.getByRole("button", { name: "Reroll day" })).toBeVisible();
  await expect(editor).toContainText("First duel with each friend");
  await editor.getByRole("button", { name: "Pick… Daily 1" }).click();
  const list = editor.getByText("Pick for Daily 1").locator("..");
  await expect(list).toBeVisible();
  const first = list.getByRole("button").first();
  // The mission's name, without "also Wed 5".
  const picked = (await first.evaluate((b) => b.firstChild?.textContent ?? "")).trim();
  await first.click();
  await expect(editor.getByRole("listitem").filter({ hasText: "Daily 1" })).toContainText(picked);
  await expect(editor.getByRole("listitem").filter({ hasText: "Daily 1" })).toContainText("pinned");
  await expect(days.nth(mine.day)).toContainText("changed");
  await editor.getByRole("button", { name: "Back to normal draw" }).click();
  await expect(editor.getByRole("button", { name: "Back to normal draw" })).toHaveCount(0);
  await expect(editor).not.toContainText("pinned");

  // Switching off asks first; switching on doesn't.
  const pool = region(page, "The pool");
  const toggle = pool.getByRole("switch", { name: mine.mission, exact: true }).locator("visible=true");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  const ask = page.getByRole("dialog", { name: `Switch off “${mine.mission}”?` });
  await expect(ask).toContainText("Won’t come up from");
  await ask.getByRole("button", { name: "Switch off" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // Every change is in Admin changes.
  await page.goto("/admin");
  const log = region(page, "Admin changes");
  await expect(log).toContainText(`switched on ${mine.mission}`);
  await expect(log).toContainText(`switched off ${mine.mission}`);
  await expect(log).toContainText("back to the normal draw");
  await expect(log).toContainText(`pinned ${picked}`);
});

test("the recipe bar, today's quarry, the Hunt targets and a theme (WEB-109)", async ({
  page,
  context,
  baseURL,
}, info) => {
  // Each project switches its own target, and puts it back.
  const target = info.project.name === "phone" ? "Dwarf Hunter" : "Human Rogue";
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/admin/missions");
  const tiles = page.getByRole("list", { name: "Missions" }).getByRole("listitem");
  await expect(tiles).toHaveCount(6);
  await expect(tiles.nth(1)).toContainText("The Hunt");
  await expect(tiles.nth(1)).toContainText("targets · weighted");
  const quarry = page.getByTestId("quarry");
  await expect(quarry).toContainText("Today’s quarry");
  await expect(quarry).toContainText("Alliance hunts");
  // Today's tile carries today's quarry.
  const name = (await quarry.locator("p").first().textContent())!;
  await expect(page.getByTestId("mission-day").first()).toContainText(name);

  // The pool: Questing open; another card opens below, one at a time.
  const pool = region(page, "The pool");
  const cards = pool.getByTestId("theme-card");
  await expect(cards).toHaveCount(9);
  await expect(cards.first()).toHaveAttribute("aria-expanded", "true");
  await cards.filter({ hasText: "Weekly" }).first().click();
  await expect(cards.first()).toHaveAttribute("aria-expanded", "false");
  await expect(pool.getByTestId("theme-list").getByRole("heading", { level: 3 })).toHaveText(/^Weekly · \d+$/);
  // A filter lists the matches of every card.
  await pool.getByRole("button", { name: /^Never came up/ }).click();
  await expect(pool.getByTestId("theme-list").getByRole("heading", { level: 3 })).toHaveText(/^Never came up · \d+$/);
  await pool.getByRole("button", { name: /^All/ }).click();
  await pool.getByRole("searchbox", { name: "Search missions" }).fill("quests");
  await expect(pool.getByTestId("theme-list")).toContainText("Finish 10 quests");

  // The Hunt targets: a click switches a target off, and back on.
  await quarry.getByRole("link", { name: "Hunt targets ›" }).click();
  const box = region(page, "Hunt targets");
  await expect(box.getByRole("button", { name: /^Horde hunts · Alliance targets/, pressed: true })).toBeVisible();
  const cell = box.getByRole("switch", { name: target, exact: true }).locator("visible=true");
  await expect(cell).toHaveAttribute("aria-checked", "true");
  await cell.click();
  await expect(cell).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(cell).toHaveAttribute("aria-checked", "false");
  await cell.click();
  await expect(cell).toHaveAttribute("aria-checked", "true");
  await box.getByRole("button", { name: "Alliance hunts · Horde targets" }).click();
  await expect(box.getByRole("switch", { name: "Undead Rogue", exact: true }).locator("visible=true")).toBeVisible();

  await page.goto("/admin");
  const log = region(page, "Admin changes");
  await expect(log).toContainText(`switched off ${target}`);
  await expect(log).toContainText(`switched on ${target}`);
});
