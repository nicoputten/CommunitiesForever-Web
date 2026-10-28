import { expect, test, type Page } from "@playwright/test";
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

// WEB-48: the dropdown, date and time components (board `runs-v2-plan`, "Dropdown component") in every state, on the
// /dev/components gallery: design values, keyboard use (open, search, pick, Esc), axe and touch targets with the menu
// or the sheet open, and screenshots of the open states.

test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

const open = async (page: Page) => {
  await openScreen(page, "/dev/components");
  await page.getByRole("region", { name: "Dropdown, date and time" }).scrollIntoViewIfNeeded();
};
const dungeon = (page: Page) => page.getByRole("combobox", { name: "Dungeon", exact: true });
const lead = (page: Page) => page.getByRole("combobox", { name: "Lead as" });

test("dropdown: design values", async ({ page }) => {
  await open(page);
  await expectStyles(dungeon(page), {
    "background-color": "var(--input-bg)",
    "min-height": "var(--size-touch)",
    "border-radius": "var(--r-btn)",
    "font-size": "var(--fs-body)",
  });
  await expectStyles(page.getByRole("combobox", { name: "Dungeon, none picked" }).getByText("Pick a dungeon"), {
    color: "var(--text-dim)",
  });
  await dungeon(page).click();
  const surface = isPhone(page) ? page.getByRole("dialog") : page.getByRole("listbox").locator("..");
  await expectStyles(surface, { "background-color": "var(--surface-menu)" });
  await expectStyles(page.getByRole("option", { name: /^Scarlet Monastery: Graveyard/ }), {
    "background-color": "var(--tint-option)",
  });
  await expectStyles(page.getByText("Fits your characters"), {
    "text-transform": "uppercase",
    "font-size": "var(--fs-overline)",
    color: "var(--text-faint)",
  });
  await expectStyles(page.getByText("No character within 10 levels"), { color: "var(--text-disabled)" });
});

test("dropdown: keyboard (open, search, pick, Esc)", async ({ page }) => {
  test.skip(isPhone(page), "keyboard on desktop; the sheet has its own test");
  await open(page);
  await dungeon(page).focus();
  await page.keyboard.press("Enter");
  await expect(dungeon(page)).toHaveAttribute("aria-expanded", "true");
  const search = page.getByRole("combobox", { name: "Search" });
  await expect(search).toBeFocused();
  await page.keyboard.type("lib");
  await expect(page.getByText("1 of 9")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(dungeon(page)).toHaveAttribute("aria-expanded", "false");
  await expect(dungeon(page)).toBeFocused();
  await expect(dungeon(page)).toContainText("Scarlet Monastery: Library");

  // Esc closes without changing the value.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(dungeon(page)).toHaveAttribute("aria-expanded", "false");
  await expect(dungeon(page)).toContainText("Scarlet Monastery: Library");

  // A disabled option stays visible with its reason and can't be picked.
  await page.keyboard.press("Enter");
  await page.keyboard.type("cath");
  await page.keyboard.press("Enter");
  await expect(dungeon(page)).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");

  // Without a search field: type-to-jump.
  await lead(page).focus();
  await page.keyboard.press("t");
  await expect(lead(page)).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(lead(page)).toContainText("Twinkle 21");
});

test("dropdown: a bottom sheet on phones", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await open(page);
  await dungeon(page).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  // The search field waits for a tap, so the keyboard doesn't cover the list.
  await expect(page.getByRole("combobox", { name: "Search" })).not.toBeFocused();
  await expectTouchTargets(page);
  await page.getByRole("option", { name: /^Shadowfang Keep/ }).click();
  await expect(sheet).toBeHidden();
  await expect(dungeon(page)).toContainText("Shadowfang Keep");
});

test("date: the month popover", async ({ page }) => {
  await open(page);
  const button = page.getByRole("button", { name: /^Day: Friday 30 October 2026/ });
  await button.click();
  const popover = page.getByRole("dialog", { name: "October 2026" });
  await expect(popover).toBeVisible();
  await expect(page.getByRole("button", { name: "Friday 30 October 2026", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Tuesday 27 October 2026", exact: true })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(popover).toBeHidden();
  await expect(page.getByText("Sat 31 Oct")).toBeVisible();
  await page.getByRole("button", { name: /^Day: Saturday 31 October 2026/ }).click();
  await page.keyboard.press("PageDown");
  await expect(page.getByRole("dialog", { name: "November 2026" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("time: typed, stepped and wrong", async ({ page }) => {
  await open(page);
  const time = page.getByRole("textbox", { name: "Time" });
  await time.fill("2030");
  await time.blur();
  await expect(time).toHaveValue("20:30");
  await time.press("ArrowUp");
  await expect(time).toHaveValue("20:45");
  await time.fill("99");
  await time.blur();
  await expect(page.getByRole("region", { name: "Dropdown, date and time" }).getByRole("alert")).toHaveText(
    "Use a time like 20:30",
  );
  await expect(time).toHaveAttribute("aria-invalid", "true");
});

test("controls: accessibility, closed and open", async ({ page }) => {
  await open(page);
  await expectAccessible(page);
  await dungeon(page).click();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Day: / }).click();
  await expectAccessible(page);
});

test("controls: reduced motion", async ({ page }) => {
  await open(page);
  await dungeon(page).click();
  await expectNoMotion(page);
});

test("controls: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await open(page);
  await expectTouchTargets(page);
  await page.getByRole("button", { name: /^Day: / }).click();
  await expectTouchTargets(page);
});

test("controls: screenshots", async ({ page }) => {
  await open(page);
  await dungeon(page).click();
  await page.getByRole("combobox", { name: "Search" }).fill("scar");
  await expectScreenshot(page, "controls-dropdown-search");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Day: / }).click();
  await expectScreenshot(page, "controls-date");
});
