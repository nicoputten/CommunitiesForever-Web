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

// WEB-73: design checks of the uploader's "What's new" (board `uploader-changes`), opened as the app opens it: at the
// newest version, which glows (with reduced motion the glow stays). The seed publishes the board's four versions.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

const open = (page: Parameters<typeof openScreen>[0]) => openScreen(page, "/uploader/changes#0.3.1");

test("uploader changes: design values", async ({ page }) => {
  await open(page);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const tabs = page.getByRole("navigation", { name: "Uploader" });
  await expectStyles(tabs, { "border-bottom-color": "var(--line-bar-phone)" });
  await expectStyles(tabs.getByRole("link", { name: "What’s new" }), {
    "font-size": "var(--fs-body)",
    "font-weight": "var(--fw-semibold)",
    color: "var(--text-strong)",
    "box-shadow": "var(--shadow-current)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(tabs.getByRole("link", { name: "The app" }), { color: "var(--text-muted)" });
  const latest = page.getByRole("region", { name: "v0.3.1" });
  await expectStyles(latest, {
    "background-color": "var(--surface-box)",
    "border-top-color": "var(--line-box)",
    "border-radius": "var(--r-panel)",
  });
  await expectStyles(latest.getByRole("heading"), { ...TYPE.titleLg, color: "var(--gold-pale)" });
  await expectStyles(latest.getByText("Latest"), { "background-color": "var(--gold)", color: "var(--on-gold)" });
  await expectStyles(latest.getByText("19 Nov 2026"), { "font-size": "var(--fs-body-sm)", color: "var(--text-dim)" });
  await expectStyles(latest.getByRole("listitem").first(), { "font-size": "var(--fs-body)", color: "var(--text-chip)" });
  if (!isPhone(page)) {
    await expectStyles(page.getByRole("link", { name: "Link to v0.3.0" }), { color: "var(--text-faint)" });
  }
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
