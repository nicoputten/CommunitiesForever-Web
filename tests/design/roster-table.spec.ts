import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE_MODAL,
  TYPE,
  characterName,
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

// WEB-22: design checks of the roster table (board roster-table) on the sample data; on a phone the card list and
// the filter sheet.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("roster table: design values", async ({ page }) => {
  test.skip(isPhone(page), "desktop only: the phone shows the card list");
  await openScreen(page, "/roster/table");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByText("10 characters · sorted by last played"), {
    ...TYPE.bodySm,
    color: "var(--text-dim)",
  });
  const table = page.getByRole("table");
  await expectStyles(table, { ...DATA, "font-size": "var(--fs-body-sm)" });
  const level = table.getByRole("columnheader", { name: "Level" });
  await expectStyles(level, {
    ...TYPE.overline,
    "letter-spacing": "var(--ls-th)",
    color: "var(--text-faint)",
    "background-color": "var(--surface-thead)",
    position: "sticky",
  });
  await expectStyles(table.getByRole("columnheader", { name: /Last played/ }).getByRole("link"), {
    color: "var(--gold-bright)",
  });
  await expectStyles(table.getByRole("link", { name: "Ves Doombringer" }), {
    ...characterName("WARLOCK"),
    "font-size": "var(--fs-name-sm)",
  });
  const ves = table.getByRole("row", { name: /Ves Doombringer/ });
  await expectStyles(ves.getByRole("cell").first(), { "background-color": "var(--tint-row)" });
  await expectStyles(ves.getByRole("img", { name: "Warlock, level 39" }), {
    width: "var(--size-disc-xs)",
    "background-color": "var(--warlock)",
  });
  await expectStyles(ves.getByText("Tailoring 187"), {
    "font-size": "var(--fs-meta-sm)",
    "background-color": "var(--surface-pill)",
    "border-radius": "var(--r-pill-sm)",
  });
  const ruk = table.getByRole("row", { name: /Ruk Bloodhoof/ });
  await expectStyles(ruk.getByText("· 9 d old"), { color: "var(--stale-note)" });
  await expectStyles(ruk.getByRole("img"), { opacity: "var(--opacity-old)" });
  await expectStyles(table.getByText("Location unknown"), { color: "var(--text-faint)" });
});

test("roster table: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/roster/table");
  await expectTouchTargets(page);
});

test("roster table: accessibility", async ({ page }) => {
  await openScreen(page, "/roster/table");
  await expectAccessible(page);
});

test("roster table: reduced motion", async ({ page }) => {
  await openScreen(page, "/roster/table");
  await expectNoMotion(page);
});

test("roster table: screenshot", async ({ page }) => {
  await openScreen(page, "/roster/table");
  await expectScreenshot(page, "roster-table");
});

test("roster table: grouped by friend", async ({ page }) => {
  await openScreen(page, "/roster/table?sort=level&group=friend");
  await expectAccessible(page);
  await expectScreenshot(page, "roster-table-grouped");
});

test("roster table: phone filter sheet", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/roster/table");
  await page.getByRole("button", { name: "Filters & sort" }).click();
  const sheet = page.getByRole("dialog", { name: "Filters & sort" });
  await expect(sheet).toBeVisible();
  await expectStyles(sheet, {
    ...SURFACE_MODAL,
    "border-top-left-radius": "var(--r-sheet)",
    "box-shadow": "var(--shadow-sheet)",
  });
  await expectStyles(sheet.getByRole("heading", { name: "Filters & sort" }), {
    ...TYPE.title,
    color: "var(--gold-bright)",
  });
  await expectTouchTargets(page);
  await expectAccessible(page);
  await expectScreenshot(page, "roster-table-sheet");
});
