import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-18: the admin page on the seeded sample data. Desktop and phone share the database and run at the same time,
// so each project blocks its own member and adds its own guest, and leaves things as it found them.

const PER_PROJECT: Record<string, { member: string; guest: string }> = {
  desktop: { member: "Jorrit#4410", guest: "Guest#5101" },
  phone: { member: "Mira#1188", guest: "Guest#5102" },
};
const mine = (info: TestInfo) => PER_PROJECT[info.project.name] ?? PER_PROJECT.desktop!;
const panel = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("the admin blocks and unblocks a member", async ({ page, context, baseURL, browser }, info) => {
  const { member } = mine(info);
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/");
  await page.getByRole("button", { name: `Account ${E2E.admin}` }).click();
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();

  const members = panel(page, "Members");
  await expect(members.getByTestId("member").first()).toContainText("Admin");
  await expect(members).toContainText("Bob#2002");
  await expect(members).toContainText("Added by");

  await members.getByRole("button", { name: `Block ${member}`, exact: true }).click();
  await expect(panel(page, "Blocked")).toContainText(member);
  await expect(members.getByRole("button", { name: `Unblock ${member}`, exact: true })).toBeVisible();

  // The block takes effect at once.
  const other = await browser.newContext();
  await signInAs(other, baseURL!, member);
  const theirs = await other.newPage();
  await theirs.goto("/");
  await expect(theirs).toHaveURL(/\/not-on-list/);

  await panel(page, "Blocked")
    .getByRole("button", { name: `Unblock ${member}`, exact: true })
    .click();
  await expect(members.getByRole("button", { name: `Block ${member}`, exact: true })).toBeVisible();
  await theirs.goto("/");
  await expect(theirs).not.toHaveURL(/\/not-on-list/);
  await other.close();
});

test("the admin adds, changes and removes a guest", async ({ page, context, baseURL }, info) => {
  const { guest } = mine(info);
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/admin");
  const guests = panel(page, "Guests");
  const field = guests.getByLabel("BattleTag");
  const add = guests.getByRole("button", { name: "Add guest" });

  await field.fill("nope");
  await add.click();
  await expect(guests.getByText("That's not a BattleTag (Name#1234).")).toBeVisible();
  await field.fill("bob#2002");
  await add.click();
  await expect(guests.getByText("Bob#2002 is already a member.")).toBeVisible();

  await field.fill(guest);
  await guests.getByRole("button", { name: "May upload", exact: true }).click();
  await add.click();
  await expect(guests.getByText(`${guest} is on the guest list.`)).toBeVisible();
  await expect(field).toHaveValue("");
  const chip = guests.getByRole("button", { name: `May upload: ${guest}` });
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");

  await guests.getByRole("button", { name: `Remove ${guest}` }).click();
  await expect(guests.getByRole("button", { name: `Remove ${guest}` })).toHaveCount(0);
});

test("only the admin sees the admin page", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "Bob#2002");
  expect((await page.goto("/admin"))?.status()).toBe(404);
  await page.goto("/roster");
  await page.getByRole("button", { name: "Account Bob#2002" }).click();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
});

// WEB-62: the Danger zone asks before starting fresh. Confirming would change the shared database under the other
// tests, so this stops at the dialog; the cut-off itself is tested in tests/server/cutoff.test.ts.
test("Start fresh from launch asks first, and needs `delete all` typed", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/admin");
  const zone = panel(page, "Danger zone");
  await expect(zone).toContainText("Hidden, not deleted");
  await zone.getByRole("button", { name: "Start fresh from launch…" }).click();
  const dialog = page.getByRole("dialog", { name: "Are you sure? This is destructive" });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Start fresh from launch" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/to confirm/).fill("delete");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/to confirm/).fill("delete all");
  await expect(confirm).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(zone.getByRole("button", { name: "Start fresh from launch…" })).toBeVisible();
});
