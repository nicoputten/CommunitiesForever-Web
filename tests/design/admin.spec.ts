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

// WEB-18: design checks of the admin page (WEB-64: the owner's view, boards `admin-coadmins`, `admin-coadmin-states`,
// `admin-phone`) (no board; layout decided with Nico, DESIGN.md §11) on the sample data,
// with one guest and one block. Both are idempotent, so the desktop and phone projects can each set them.

test.beforeEach(async ({ context, baseURL, page, browser }) => {
  // WEB-64: Bob has signed in, so the Admins box offers "Make admin" for him.
  const bob = await browser.newContext();
  await signInAs(bob, baseURL!, "Bob#2002");
  await (await bob.newPage()).goto("/");
  await bob.close();
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

// WEB-64: the Admins box, the rank badges, the log and the Make admin dialog (a bottom sheet on a phone).
test("admin: co-admins", async ({ page }, info) => {
  await openScreen(page, "/admin");
  const admins = page.getByRole("region", { name: "Admins", exact: true });
  await expectStyles(admins, { "border-top-color": "var(--line-admins-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(admins.getByText("Owner", { exact: true }).first(), {
    color: "var(--on-gold)",
    "border-radius": "var(--r-pill)",
    "font-size": "var(--fs-tiny)",
  });
  await expectStyles(page.getByRole("region", { name: "Members", exact: true }).getByText("Owner & admins"), {
    color: "var(--gold)",
    "font-size": "var(--fs-meta-sm)",
  });
  await expect(page.getByRole("region", { name: "Uploader devices" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Admin changes" })).toBeVisible();
  const out = process.env.SCREENSHOT_OUT;
  if (out) await page.screenshot({ path: `${out}/coadmins-${info.project.name}.png`, fullPage: true });
  const make = admins.getByRole("button", { name: "Make admin Bob#2002", exact: true });
  await expectStyles(make, { color: "var(--gold-bright)", "min-height": "var(--size-touch)" });
  await make.click();
  const dialog = page.getByRole("dialog", { name: "Make Bob an admin?" });
  await expect(dialog).toBeVisible();
  await expectStyles(dialog, {
    "background-color": "var(--surface-menu)",
    "border-top-left-radius": isPhone(page) ? "var(--r-sheet)" : "var(--r-panel)",
  });
  await expectStyles(dialog.getByRole("button", { name: "Make admin", exact: true }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "min-height": "var(--size-touch)",
  });
  if (out) await page.screenshot({ path: `${out}/make-admin-${info.project.name}.png` });
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
