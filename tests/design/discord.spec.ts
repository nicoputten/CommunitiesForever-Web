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

// WEB-39, reorganised in WEB-58: design checks of the Discord page (boards `discord-page`, `discord-page-phone`) as the
// admin, before linking (Discord is never called here). The time zone is picked first, so the page is the same every
// run. SCREENSHOT_OUT=<dir> also writes the page out to look at next to the board (any platform).

test.beforeEach(async ({ context, baseURL, page }) => {
  await signInAs(context, baseURL!, ADMIN);
  await page.goto("/discord");
  const zone = page.getByRole("region", { name: "Your time zone" });
  await pick(page, zone.getByLabel("Your time zone", { exact: true }), "Amsterdam");
  await zone.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Your time zone is saved.");
});

const open = (page: Page) => openScreen(page, "/discord");

test("discord: design values", async ({ page }) => {
  await open(page);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const jump = page.getByRole("navigation", { name: "On this page" });
  await expectStyles(jump, { position: "sticky", "background-color": "var(--surface-jump)" });
  await expectStyles(jump.getByRole("link").first(), { "min-height": "var(--size-touch)" });
  await expectStyles(page.getByRole("heading", { name: "For you" }), { ...TYPE.titleLg, color: "var(--gold-bright)" });

  const link = page.getByRole("region", { name: "Your Discord" });
  await expectStyles(link, { "border-radius": "var(--r-panel)", "border-top-color": "var(--line-link)" });
  await expectStyles(link.getByRole("heading"), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-name)",
    color: "var(--gold-bright)",
  });
  await expectStyles(link.getByRole("button", { name: "Link your Discord" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-btn)",
    "min-height": "var(--size-touch)",
  });

  const feats = page.getByRole("region", { name: "Feats" });
  await expectStyles(feats, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(feats.getByText("Admin only"), { color: "var(--gold)", "font-size": "var(--fs-meta-sm)" });
  await expectStyles(feats.getByText("Post feats", { exact: true }), { "font-size": "var(--fs-body)", color: "var(--text)" });
  await expectStyles(feats.getByRole("switch", { name: "Post feats" }), { "min-height": "var(--size-touch)" });
  await expectStyles(feats.getByText("Feats channel"), {
    "font-size": "var(--fs-overline)",
    "letter-spacing": "var(--ls-overline)",
    color: "var(--text-faint)",
  });
  const recap = page.getByRole("region", { name: "Weekly recap" });
  await expectStyles(recap.getByLabel("Day and time"), {
    "background-color": "var(--input-bg)",
    "border-radius": "var(--r-nav)",
  });

  const doomsday = page.getByRole("region", { name: /^Doomsday/ });
  await expectStyles(doomsday, { "border-top-color": "var(--line-doomsday-box)" });
  await expectStyles(doomsday.getByText("new", { exact: true }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
  });
  await expectStyles(doomsday.getByLabel("Reset hour, realm time"), {
    width: "var(--size-time-segment)",
    "min-height": "var(--size-touch)",
    "font-size": "var(--fs-time-segment)",
    "background-color": "var(--input-bg)",
  });

  const friends = page.getByRole("region", { name: "Linked friends" });
  await expectStyles(friends.getByText("Not linked").first(), {
    color: "var(--text-dim)",
    "background-color": "var(--mute-tint)",
  });
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

test("discord: screenshot", async ({ page }, info) => {
  await open(page);
  if (process.env.SCREENSHOT_OUT) {
    await page.screenshot({ path: `${process.env.SCREENSHOT_OUT}/discord-${info.project.name}.png`, fullPage: true });
  }
  await expectScreenshot(page, "discord");
});
