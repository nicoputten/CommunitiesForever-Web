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

// WEB-73: design checks of the uploader's "What's new" (no board: the uploader page's boxes). The seed publishes three
// versions: one without notes, one with a paragraph and nested bullets.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

const open = (page: Parameters<typeof openScreen>[0]) => openScreen(page, "/uploader/changes");

test("uploader changes: design values", async ({ page }) => {
  await open(page);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const box = page.getByRole("region", { name: "0.3.1" });
  await expectStyles(box, { "border-radius": "var(--r-panel)", "background-color": "var(--surface-box)" });
  await expectStyles(box.getByRole("heading", { name: "0.3.1" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-name)",
    color: "var(--gold-bright)",
  });
  await expectStyles(box.getByText("the tray icon after a restart"), {
    "font-size": "var(--fs-body-sm)",
    color: "var(--text-muted)",
  });
});

test("uploader changes: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await open(page);
  await expectTouchTargets(page);
});

test("uploader changes: accessibility", async ({ page }) => {
  await open(page);
  await expectAccessible(page);
});

test("uploader changes: reduced motion", async ({ page }) => {
  await open(page);
  await expectNoMotion(page);
});

test("uploader changes: screenshot", async ({ page }) => {
  await open(page);
  await expectScreenshot(page, "uploader-changes");
});
