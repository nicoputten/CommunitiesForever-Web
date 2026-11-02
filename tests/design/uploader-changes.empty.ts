import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import { expectAccessible, expectScreenshot, expectStyles, openScreen } from "./checks";
import { ADMIN } from "./sample";

// WEB-73: "What's new" before the first release (board `uploader-changes-states`); runs before `seed` publishes one.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

test("uploader changes, no versions yet: design values", async ({ page }) => {
  await openScreen(page, "/uploader/changes");
  await expect(page.getByText("No versions yet")).toBeVisible();
  await expectStyles(page.getByText("No versions yet"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-name-card)",
    color: "var(--text-strong)",
  });
  await expectStyles(page.getByRole("link", { name: "Back to the app" }), {
    "border-top-color": "var(--line-chip-on)",
    color: "var(--gold-bright)",
    "min-height": "var(--size-touch)",
  });
  await expectAccessible(page);
});

test("uploader changes, no versions yet: screenshot", async ({ page }) => {
  await openScreen(page, "/uploader/changes");
  await expectScreenshot(page, "uploader-changes-empty");
});
