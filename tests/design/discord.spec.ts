import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
  TYPE,
} from "./checks";
import { ADMIN } from "./sample";
import { pick } from "../e2e/dropdown";

// WEB-39: design checks of the Discord page (board `discord-settings-runs`) as the admin, before linking (Discord is
// never called here). The time zone is picked first, so the page is the same every run.

test.beforeEach(async ({ context, baseURL, page }) => {
  await signInAs(context, baseURL!, ADMIN);
  await page.goto("/discord");
  await pick(page, page.getByLabel("Time zone", { exact: true }), "Amsterdam");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Your time zone is saved.");
});

const open = (page: Page) => openScreen(page, "/discord");

test("discord: design values", async ({ page }) => {
  await open(page);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const link = page.getByRole("region", { name: "Link your Discord" });
  await expectStyles(link, { "border-radius": "var(--r-panel)", "border-top-color": "var(--line-link)" });
  await expectStyles(link.getByRole("heading"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-title)",
    color: "var(--text-strong)",
  });
  await expectStyles(link.getByRole("button", { name: "Link Discord" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-btn)",
    "min-height": "var(--size-touch)",
  });
  const posts = page.getByRole("region", { name: "What the bot posts" });
  await expectStyles(posts, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(posts.getByRole("heading"), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-name)",
    color: "var(--gold-bright)",
  });
  await expectStyles(posts.getByText("Milestones", { exact: true }), {
    "font-size": "var(--fs-body)",
    color: "var(--text)",
  });
  await expectStyles(posts.getByRole("switch", { name: "Milestones" }), { "min-height": "var(--size-touch)" });
  await expectStyles(posts.getByText("Recap time"), {
    "font-size": "var(--fs-overline)",
    "letter-spacing": "var(--ls-overline)",
    color: "var(--text-faint)",
  });
  await expectStyles(posts.getByLabel("Recap time"), {
    "background-color": "var(--input-bg)",
    "border-radius": "var(--r-nav)",
  });
  const friends = page.getByRole("region", { name: "Linked friends" });
  await expectStyles(friends.getByText("Not linked").first(), {
    color: "var(--text-dim)",
    "background-color": "var(--mute-tint)",
  });
  await expectStyles(page.getByRole("region", { name: "Runs" }), { "border-top-color": "var(--line-link)" });
  await expectStyles(page.getByText("Always on"), {
    color: "var(--fresh-text)",
    "background-color": "var(--done-tint)",
  });
});

test("discord: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await open(page);
  await expectTouchTargets(page);
});

test("discord: accessibility", async ({ page }) => {
  await open(page);
  await expectAccessible(page);
});

test("discord: reduced motion", async ({ page }) => {
  await open(page);
  await expectNoMotion(page);
});

test("discord: screenshot", async ({ page }) => {
  await open(page);
  await expectScreenshot(page, "discord");
});
