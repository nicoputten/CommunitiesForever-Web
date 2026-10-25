import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-15: the app shell and /dev/components at desktop and phone size (playwright.config.ts projects).
// Signed in as the e2e admin (tests/e2e/session.ts).

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const ACCOUNT = `Account ${E2E.admin}`;

const FOOTER =
  "Private fan site · not affiliated with Blizzard Entertainment · Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/** Every visible interactive element is at least 44 × 44 px (CLAUDE.md rule 11; WEB-30 checks every screen). */
async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")]
      .filter((el) => el.tabIndex >= 0 && el.checkVisibility())
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      // The skip link sits above the page until it has focus.
      .filter(({ r }) => r.bottom > 0 && (r.width < 44 || r.height < 44))
      .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
}

test.describe("app shell", () => {
  test("shows the brand, navigation, data age, footer and user", async ({ page }) => {
    await page.goto("/roster");
    const header = page.getByRole("banner");
    const brand = header.getByRole("link").first();
    // The site name comes from the data; the page title carries the same name.
    const name = (await brand.textContent())?.trim() ?? "";
    expect(name).not.toBe("");
    await expect(page).toHaveTitle(`Roster · ${name}`);
    // Desktop and phone wording are both in the DOM; innerText has only the visible one.
    await expect(page.getByTestId("data-age")).toHaveText(
      isPhone(page) ? /^(No data yet|Updated .+)$/ : /^(No data yet|Data uploaded .+)$/,
      { useInnerText: true },
    );
    await expect(page.getByRole("contentinfo")).toHaveText(FOOTER);
    await expect(page.getByRole("button", { name: ACCOUNT })).toBeVisible();

    // Top bar on desktop, tab bar on phone: the other one is hidden, so the role query finds one.
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Roster" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Map" })).not.toHaveAttribute("aria-current", "page");
    if (isPhone(page)) {
      await expect(header.getByRole("navigation")).toBeHidden();
      await expect(header.getByRole("link", { name: "Upload" })).toBeHidden();
    } else {
      await expect(header.getByRole("navigation")).toBeVisible();
      await expect(header.getByRole("link", { name: "Upload" })).toBeVisible();
    }
  });

  test("navigates between sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Professions" }).click();
    await expect(page).toHaveURL(/\/professions$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professions");
    await expect(nav.getByRole("link", { name: "Professions" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Map" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Map");
  });

  test("user menu opens, offers sign out, closes with Escape", async ({ page }) => {
    await page.goto("/roster");
    const trigger = page.getByRole("button", { name: ACCOUNT });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
    await expect(panel.getByText("Admin", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();
    // On phone, Upload moves from the bar into the menu.
    const menuUpload = panel.getByRole("link", { name: "Upload" });
    if (isPhone(page)) await expect(menuUpload).toBeVisible();
    else await expect(menuUpload).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("touch targets are 44 px on phone", async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await page.goto("/roster");
    await expectTouchTargets(page);
    await page.getByRole("button", { name: ACCOUNT }).click();
    await expectTouchTargets(page);
  });
});

test.describe("/dev/components", () => {
  test("shows every component and its states", async ({ page }) => {
    await page.goto("/dev/components");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Components");
    for (const section of [
      "Type",
      "Class disc",
      "Data age badge",
      "Faction tag",
      "Filter chip",
      "Segmented",
      "Banner",
      "Empty state",
      "Skeleton",
      "Shell",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "Warlock, level 39" }).first()).toBeVisible();
    await expect(page.getByText("Data 9 days old · via Mira")).toBeVisible();
    await expect(page.getByText("No addon", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText("Last upload was 9 days ago");
  });

  test("Segmented and FilterChip toggle aria-pressed", async ({ page }) => {
    await page.goto("/dev/components");
    const continent = page.getByRole("group", { name: "Continent" });
    await expect(continent.getByRole("button", { name: "Azeroth" })).toHaveAttribute("aria-pressed", "true");
    await continent.getByRole("button", { name: "Kalimdor" }).click();
    await expect(continent.getByRole("button", { name: "Kalimdor" })).toHaveAttribute("aria-pressed", "true");
    await expect(continent.getByRole("button", { name: "Azeroth" })).toHaveAttribute("aria-pressed", "false");

    const bob = page.getByRole("button", { name: "Bob", exact: true });
    await expect(bob).toHaveAttribute("aria-pressed", "false");
    await bob.click();
    await expect(bob).toHaveAttribute("aria-pressed", "true");

    const menuChip = page.getByRole("button", { name: "Class" });
    await expect(menuChip).toHaveAttribute("aria-haspopup", "menu");
    await expect(menuChip).toHaveAttribute("aria-expanded", "false");
  });

  test("touch targets are 44 px on phone", async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await page.goto("/dev/components");
    await expectTouchTargets(page);
  });
});
