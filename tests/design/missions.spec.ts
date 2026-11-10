import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
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

// WEB-79: design checks of the owner's Mission pool (boards `mission-pool`, `mission-pool-steering`,
// `mission-pool-states`) on the sample data: the page, a free day's editor and a locked day. Read only, so the
// desktop and phone projects can run side by side.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

/** The fourth day shown: free (today and tomorrow are locked). */
async function freeDay(page: import("@playwright/test").Page): Promise<string> {
  await openScreen(page, "/admin/missions");
  const href = await page.getByTestId("mission-day").nth(3).getAttribute("href");
  return `/admin/missions${href!.replace(/#.*$/, "")}`;
}

test("missions: design values", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const days = page.getByRole("region", { name: "Next 14 days" });
  await expectStyles(days, { "border-radius": "var(--r-panel)", "background-color": "var(--surface-box)" });
  await expectStyles(days.getByRole("heading", { name: "Next 14 days" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  await expectStyles(page.getByTestId("mission-day").first(), {
    "background-color": "var(--surface-day-locked)",
    opacity: "var(--opacity-locked)",
    "border-radius": "var(--r-btn)",
  });
  await expectStyles(page.getByTestId("mission-day").nth(3), { "background-color": "var(--surface-goal)" });
  const pool = page.getByRole("region", { name: "The pool" });
  if (!isPhone(page)) {
    await expectStyles(pool.getByRole("columnheader", { name: "Mission" }), {
      "font-size": "var(--fs-meta-sm)",
      color: "var(--text-faint)",
    });
    await expectStyles(pool.getByRole("switch").first().locator("span"), { "background-color": "var(--gold)" });
  }
  await expectStyles(pool.getByRole("button", { name: "Normal", pressed: true }).locator("visible=true").first(), {
    "background-color": "var(--tint-selected)",
    color: "var(--text-strong)",
  });
});

test("missions: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, await freeDay(page));
  await expectTouchTargets(page);
});

test("missions: accessibility", async ({ page }) => {
  await openScreen(page, await freeDay(page));
  await expectAccessible(page);
});

test("missions: reduced motion", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectNoMotion(page);
});

test("missions: screenshot", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  await expectScreenshot(page, "missions");
});

test("missions: a free day's editor", async ({ page }) => {
  await openScreen(page, await freeDay(page));
  const editor = page.locator("#editor");
  await expect(editor.getByRole("button", { name: "Reroll day" })).toBeVisible();
  await expectStyles(editor, { "border-color": "var(--gold)" });
  await expectScreenshot(page, "missions-day");
});

/** WEB-107: the Hunt's group, after the dailies; on a phone behind "Show all". */
async function huntGroup(page: import("@playwright/test").Page) {
  await openScreen(page, "/admin/missions");
  const pool = page.getByRole("region", { name: "The pool" });
  if (isPhone(page)) await pool.getByRole("button", { name: /^Show all/ }).click();
  return pool.getByTestId(isPhone(page) ? "hunt-lines" : "hunt-group");
}

test("missions: the Hunt's group", async ({ page }) => {
  const hunt = await huntGroup(page);
  await expect(hunt).toBeVisible();
  await expect(hunt).toContainText("The Hunt · PvP");
  await expect(hunt).toContainText("Kill an enemy player of the day’s race and class");
  await expect(hunt).toContainText("Every day");
  await expect(hunt).toContainText("Pool version 5 draws from 23 combinations per faction.");
  await expect(hunt.getByRole("list", { name: "Today’s Hunt" }).getByRole("listitem")).toHaveCount(2);
  if (isPhone(page)) {
    await expectStyles(hunt.getByRole("heading", { name: "The Hunt · PvP" }), {
      "font-size": "var(--fs-meta-sm)",
      color: "var(--text-faint)",
    });
  } else {
    await expectStyles(hunt.getByRole("columnheader", { name: "The Hunt · PvP" }), {
      "font-family": "var(--font-display)",
      "font-size": "var(--fs-section)",
      color: "var(--gold-bright)",
    });
  }
  await expectStyles(hunt.getByRole("listitem").first(), { "font-size": "var(--fs-meta)", color: "var(--pvp-soft)" });
  await expectStyles(hunt.getByText("Horde hunts · 23"), {
    "font-size": "var(--fs-meta-sm)",
    color: "var(--text-faint)",
  });
  await expectStyles(hunt.locator("dt").first(), { "font-size": "var(--fs-meta)", color: "var(--text-strong)" });
  await expectStyles(hunt.locator("dd").first(), { color: "var(--text-dim)" });
  await expectAccessible(page);
  if (isPhone(page)) await expectTouchTargets(page);
});

test("missions: the Hunt's group, screenshot", async ({ page }) => {
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  const hunt = await huntGroup(page);
  await expect(hunt).toHaveScreenshot("missions-hunt.png");
});

test("missions: a locked day", async ({ page }) => {
  await openScreen(page, "/admin/missions");
  const href = await page.getByTestId("mission-day").first().getAttribute("href");
  await openScreen(page, `/admin/missions${href!.replace(/#.*$/, "")}`);
  await expect(page.locator("#editor")).toContainText("Locked");
  await expect(page.locator("#editor").getByRole("button")).toHaveCount(0);
});
