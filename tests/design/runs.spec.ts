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
