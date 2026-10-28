import { test } from "@playwright/test";
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

// WEB-41c: the coming weekly recap (/discord/recap, admin only), the bot-recap board's example embed in the site's
// style. The design sample has no feed history, so it shows a quiet first week.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

test("discord recap: design values", async ({ page }) => {
  await openScreen(page, "/discord/recap");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByRole("heading", { level: 2 }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-heading)",
    color: "var(--gold-pale)",
  });
  await expectStyles(page.getByRole("region", { name: "This week's challenge" }), {
    "border-top-style": "dashed",
    "border-radius": "var(--r-nav)",
  });
});

test("discord recap: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/discord/recap");
  await expectTouchTargets(page);
});

test("discord recap: accessibility", async ({ page }) => {
  await openScreen(page, "/discord/recap");
  await expectAccessible(page);
});

test("discord recap: reduced motion", async ({ page }) => {
  await openScreen(page, "/discord/recap");
  await expectNoMotion(page);
});

test("discord recap: screenshot", async ({ page }) => {
  await openScreen(page, "/discord/recap");
  await expectScreenshot(page, "discord-recap");
});
