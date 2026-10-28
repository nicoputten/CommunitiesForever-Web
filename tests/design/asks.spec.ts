import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  expectAccessible,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-51 (boards asks-now, asks-now-phone, asks-now-states): Asking now's states on /dev/asks, fixed (no countdown):
// design values, "and 2 more", an answer that didn't go through, axe, touch targets, motion, screenshots.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

const card = (page: import("@playwright/test").Page, nth: number) =>
  page.getByRole("region", { name: "Asking now" }).getByRole("article").nth(nth);

test("asking now: design values", async ({ page }) => {
  await openScreen(page, "/dev/asks");
  await expectStyles(page.getByRole("heading", { name: "Asking now" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-bright)",
  });
  const first = card(page, 0);
  await expectStyles(first, { "border-color": "var(--fresh-line)", "border-radius": "var(--r-card)" });
  await expectStyles(first.getByText("7 min"), { color: "var(--fresh-text)", "font-size": "var(--fs-run-time)" });
  await expectStyles(first.getByRole("button", { name: "I'm in" }), {
    color: "var(--fresh-text)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(first.getByText("2 below"), { color: "var(--stale-text)" });
  // The last minute: amber.
  const last = card(page, 2);
  await expectStyles(last, { "border-color": "var(--stale-line)" });
  await expectStyles(last.getByText("40 s"), { color: "var(--stale-text)" });
  await expectStyles(card(page, 1).getByText(/You answered/), { color: "var(--fresh-text)" });
});

test("asking now: three, then and 2 more; none fit and your own ask", async ({ page }) => {
  await openScreen(page, "/dev/asks");
  await expect(page.getByRole("region", { name: "Asking now" }).getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "and 2 more ▾" }).click();
  await expect(page.getByRole("region", { name: "Asking now" }).getByRole("article")).toHaveCount(5);
  await expect(card(page, 3).getByRole("button", { name: "I'm in" })).toBeDisabled();
  await expect(card(page, 3).getByText(/None of your characters fit Zul'Farrak \(44–54\)\. Maybe or Can't still go\./)).toBeVisible();
  await expect(card(page, 4).getByText("Your ask")).toBeVisible();
  await expect(card(page, 4).getByRole("button")).toHaveCount(0);
});

test("asking now: an answer that didn't go through, and the picker", async ({ page }) => {
  await openScreen(page, "/dev/asks");
  await card(page, 0).getByRole("button", { name: "I'm in" }).click();
  await expect(card(page, 0).getByRole("alert")).toHaveText(/Your answer didn't go through\.\s*Retry/);
  await card(page, 0).getByRole("button", { name: "change ▾" }).click();
  await expect(page.getByRole("dialog", { name: "Join The Deadmines" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card(page, 0).getByRole("button", { name: "change ▾" })).toBeFocused();
});

test("asking now: accessibility, touch targets, motion", async ({ page }) => {
  await openScreen(page, "/dev/asks");
  await page.getByRole("button", { name: "and 2 more ▾" }).click();
  await expectAccessible(page);
  if (isPhone(page)) await expectTouchTargets(page);
  await expectNoMotion(page);
});

test("asking now: screenshot", async ({ page }) => {
  await openScreen(page, "/dev/asks");
  await page.getByRole("button", { name: "and 2 more ▾" }).click();
  await card(page, 0).getByRole("button", { name: "I'm in" }).click();
  await expect(card(page, 0).getByRole("alert")).toBeVisible();
  await expectScreenshot(page, "asks-now");
});
