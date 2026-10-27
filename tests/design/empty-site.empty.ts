import { test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  SURFACE,
  SURFACE_MODAL,
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

// WEB-29: design checks of the site before the first upload (board empty-site); runs before `seed`.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("empty map: design values", async ({ page }) => {
  await openScreen(page, "/");
  await expectBackground(page, "map");
  const card = page.getByRole("region", { name: "The map is still empty" });
  await expectStyles(card, { ...SURFACE_MODAL, "border-top-color": "var(--line-modal)" });
  await expectStyles(card.getByRole("heading"), { "font-family": "var(--font-name)", "font-size": "var(--fs-heading)" });
  await expectStyles(card.getByRole("link", { name: "Upload the first file" }), {
    "background-color": "var(--gold)",
    "min-height": "var(--size-cta)",
  });
  const rollCall = page.getByRole("complementary", { name: "Roll call" });
  await expectStyles(rollCall, { ...SURFACE, "background-color": "var(--surface-aside)" });
  await expectStyles(rollCall.getByRole("heading"), { ...TYPE.title, color: "var(--gold-bright)" });
  if (!isPhone(page)) {
    await expectStyles(card, { width: "var(--size-empty)" });
    await expectStyles(rollCall, { width: "var(--size-roll-call)" });
  }
});

test("empty map: touch targets", async ({ page }) => {
  test.skip(!isPhone(page));
  await openScreen(page, "/");
  await expectTouchTargets(page);
});

test("empty map: accessibility", async ({ page }) => {
  await openScreen(page, "/");
  await expectAccessible(page);
});

test("empty map: reduced motion", async ({ page }) => {
  await openScreen(page, "/");
  await expectNoMotion(page);
});

test("empty map: screenshot", async ({ page }) => {
  await openScreen(page, "/");
  await expectScreenshot(page, "empty-map");
});
