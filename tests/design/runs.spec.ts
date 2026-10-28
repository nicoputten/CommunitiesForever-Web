import { expect, test, type Page } from "@playwright/test";
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

// WEB-40: design checks of the Runs pages (boards runs, run-detail, run-create, runs-phone) on the sample runs
// (seed.setup.ts "plan the sample runs").

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

/** The sample's SM Armory run (planned first). */
async function armory(page: Page): Promise<string> {
  await openScreen(page, "/runs?show=all");
  const href = await page
    .getByRole("article", { name: "Scarlet Monastery: Armory" })
    .first()
    .getByRole("link", { name: "Scarlet Monastery: Armory" })
    .getAttribute("href");
  return href!;
}

test("runs: design values", async ({ page }) => {
  await openScreen(page, "/runs");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByRole("heading", { name: "This week" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-name)",
    color: "var(--gold-bright)",
  });
  const card = page.getByRole("article", { name: "Scarlet Monastery: Armory" }).first();
  await expectStyles(card, { "border-radius": "var(--r-card)", "border-color": "var(--line-link)" });
  await expectStyles(card.getByRole("link", { name: "Scarlet Monastery: Armory" }), {
    ...TYPE.name,
    "font-size": "var(--fs-name-card)",
    color: "var(--text-strong)",
  });
  await expectStyles(card.getByText("Open", { exact: true }), {
    "font-size": "var(--fs-meta-sm)",
    "background-color": "var(--pill-open-tint)",
    color: "var(--gold-pale)",
  });
  await expectStyles(page.getByRole("link", { name: "Plan a run" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "min-height": "var(--size-touch)",
  });
  if (!isPhone(page)) {
    const runs = page.getByRole("banner").getByRole("link", { name: /^Runs/ });
    await expectStyles(runs, { "font-size": "var(--fs-body)" });
    await expectStyles(runs.locator("span").first(), { "background-color": "var(--gold)", color: "var(--on-gold)" });
  }
});

test("run detail: design values", async ({ page }) => {
  await openScreen(page, await armory(page));
  await expectStyles(page.getByRole("heading", { level: 1 }), {
    "font-family": "var(--font-display)",
    "font-size": isPhone(page) ? "var(--fs-run-time)" : "var(--fs-run-title)",
    color: "var(--gold-pale)",
  });
  await expectStyles(page.getByRole("heading", { name: "Answers" }), { color: "var(--gold-bright)" });
  await expectStyles(page.getByRole("cell", { name: "Organiser" }), { color: "var(--fresh-text)" });
});

test("plan a run: design values", async ({ page }) => {
  await openScreen(page, "/runs/new?dungeon=sm-armory");
  await expectStyles(page.getByRole("heading", { level: 1 }), TYPE.display);
  await expectStyles(page.getByLabel("Time"), {
    "background-color": "var(--input-bg)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(page.getByText("Preview in Discord"), { color: "var(--gold-bright)" });
});

for (const [name, url] of [
  ["runs", "/runs"],
  ["runs all", "/runs?show=all"],
  ["plan a run", "/runs/new?dungeon=sm-armory"],
] as const) {
  test(`${name}: touch targets`, async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await openScreen(page, url);
    await expectTouchTargets(page);
  });

  test(`${name}: accessibility`, async ({ page }) => {
    await openScreen(page, url);
    await expectAccessible(page);
  });

  test(`${name}: reduced motion`, async ({ page }) => {
    await openScreen(page, url);
    await expectNoMotion(page);
  });
}

test("run detail: touch targets, accessibility", async ({ page }) => {
  await openScreen(page, await armory(page));
  if (isPhone(page)) await expectTouchTargets(page);
  await expectAccessible(page);
});

test("runs: screenshot", async ({ page }) => {
  await openScreen(page, "/runs");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expectScreenshot(page, "runs");
});

test("run detail: screenshot", async ({ page }) => {
  await openScreen(page, await armory(page));
  await expectScreenshot(page, "run-detail");
});

test("plan a run: screenshot", async ({ page }) => {
  await openScreen(page, "/runs/new?dungeon=sm-armory");
  await expectScreenshot(page, "run-create");
});

// WEB-49 (boards runs-v2-run-detail, runs-v2-picker): the organiser's bar and ⋯ menu, a friend's picker.

test("run detail v2: design values, organiser", async ({ page }) => {
  await openScreen(page, await armory(page));
  await expectStyles(page.locator("p").filter({ hasText: /^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ }).first().locator("span").first(), {
    // As large as the title (its phone size on a phone).
    "font-size": isPhone(page) ? "var(--fs-run-time)" : "var(--fs-run-title)",
  });
  await expect(page.getByRole("region", { name: "You lead" })).toBeVisible();
  await expectStyles(page.getByRole("region", { name: "Group" }).getByText("fits").first(), {
    color: "var(--fresh-text)",
  });
  await page.getByRole("button", { name: "Change your place" }).click();
  await expectStyles(page.getByRole("menu"), {
    "background-color": "var(--surface-menu)",
    "border-radius": "var(--r-menu)",
  });
  await expectStyles(page.getByRole("menuitem", { name: "Leave the group" }), { color: "var(--danger-text)" });
});

test("run detail v2: the ⋯ menu open", async ({ page }) => {
  await openScreen(page, await armory(page));
  await page.getByRole("button", { name: "Change your place" }).click();
  await expect(page.getByRole("menuitem", { name: "Bench yourself" })).toBeFocused();
  await expectAccessible(page);
  if (isPhone(page)) await expectTouchTargets(page);
  await expectScreenshot(page, "run-detail-menu");
});

test.describe("a friend", () => {
  test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, "Femke#3307"));

  test("run detail v2: the picker", async ({ page }) => {
    await openScreen(page, await armory(page));
    const opener = page.getByRole("region", { name: "Your answer" }).getByRole("button", { name: /^(Answer|Change)$/ });
    await opener.click();
    const picker = page.getByRole("dialog", { name: "Join Scarlet Monastery: Armory" });
    await expect(picker).toBeVisible();
    await expectStyles(picker, { "background-color": "var(--surface-menu)" });
    await expect(picker.getByRole("listbox", { name: "1 · Character" }).getByRole("option").first()).toBeFocused();
    await expectStyles(picker.getByRole("option", { selected: true }), { "border-color": "var(--gold)" });
    await expectAccessible(page);
    if (isPhone(page)) await expectTouchTargets(page);
    await expectNoMotion(page);
    await expectScreenshot(page, "run-picker");
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
