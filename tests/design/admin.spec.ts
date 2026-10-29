import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  SURFACE,
  TYPE,
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
  runningAnimations,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-18: design checks of the admin page (no board; layout decided with Nico, DESIGN.md §11) on the sample data,
// with one guest and one block. Both are idempotent, so the desktop and phone projects can each set them.

test.beforeEach(async ({ context, baseURL, page }) => {
  await signInAs(context, baseURL!, ADMIN);
  expect((await page.request.put("/api/admin/guests", { data: { battleTag: "Wim#7070", mayUpload: true } })).ok()).toBe(true);
  expect((await page.request.put("/api/admin/blocks", { data: { battleTag: "Jorrit#4410" } })).ok()).toBe(true);
});

test("admin: design values", async ({ page }) => {
  await openScreen(page, "/admin");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const members = page.getByRole("region", { name: "Members", exact: true });
  await expectStyles(members, { ...SURFACE, "border-radius": "var(--r-panel)", "background-color": "var(--surface)" });
  await expectStyles(members.getByRole("heading", { name: "Members" }), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  await expectStyles(members.getByText("Bob", { exact: true }), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-name-sm)",
    color: "var(--text-strong)",
  });
  await expectStyles(members.getByText("Bob#2002", { exact: true }).first(), { ...TYPE.meta, color: "var(--text-dim)" });
  await expectStyles(members.getByRole("button", { name: "Block Bob#2002" }), {
    "border-radius": "var(--r-btn)",
    color: "var(--stale-text)",
    "min-height": "var(--size-touch)",
  });
  const guests = page.getByRole("region", { name: "Guests", exact: true });
  await expectStyles(guests.getByRole("button", { name: "Add guest" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-card)",
  });
  await expectStyles(guests.getByRole("button", { name: "May upload: Wim#7070" }), {
    "border-color": "var(--gold)",
    "background-color": "var(--tint-pressed)",
  });
  await expectStyles(page.getByRole("region", { name: "Blocked", exact: true }).getByRole("button", { name: "Unblock Jorrit#4410" }), {
    color: "var(--text)",
  });
});

test("admin: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/admin");
  await expectTouchTargets(page);
});

test("admin: accessibility", async ({ page }) => {
  await openScreen(page, "/admin");
  await expectAccessible(page);
});

test("admin: reduced motion", async ({ page }) => {
  await openScreen(page, "/admin");
  await expectNoMotion(page);
});

test("admin: screenshot", async ({ page }) => {
  await openScreen(page, "/admin");
  await expectScreenshot(page, "admin");
});

test("admin: add-guest error", async ({ page }) => {
  await openScreen(page, "/admin");
  const guests = page.getByRole("region", { name: "Guests", exact: true });
  await guests.getByLabel("BattleTag").fill("Bob#2002");
  await guests.getByRole("button", { name: "Add guest" }).click();
  const error = guests.getByText("Bob#2002 is already a member.");
  await expect(error).toBeVisible();
  await expect.poll(() => runningAnimations(page)).toEqual([]);
  await expectStyles(error, { ...TYPE.meta, color: "var(--stale-text)" });
  await expectAccessible(page);
});

// WEB-62: the Danger zone and its dialog (no board; the design system's danger line and the menu's dialog look).
test("admin: danger zone", async ({ page }, info) => {
  await openScreen(page, "/admin");
  const zone = page.getByRole("region", { name: "Danger zone" });
  const out = process.env.SCREENSHOT_OUT;
  if (out) await zone.screenshot({ path: `${out}/danger-zone-${info.project.name}.png` });
  await expectStyles(zone, { "border-top-color": "var(--danger-line)", "border-radius": "var(--r-panel)" });
  await expectStyles(zone.getByRole("heading"), { ...TYPE.section, color: "var(--danger-text)" });
  const open = zone.getByRole("button", { name: "Start fresh from launch…" });
  await expectStyles(open, { color: "var(--danger-text)", "min-height": "var(--size-touch)" });
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectStyles(dialog, { "background-color": "var(--surface-menu)", "border-radius": "var(--r-menu)" });
  if (out) await page.screenshot({ path: `${out}/danger-dialog-${info.project.name}.png` });
  await expectStyles(dialog.getByRole("textbox"), {
    "background-color": "var(--input-bg)",
    "min-height": "var(--size-touch)",
  });
  await expectAccessible(page);
});
