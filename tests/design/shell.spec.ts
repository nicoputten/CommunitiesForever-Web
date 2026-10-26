import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE,
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
  runningAnimations,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-30: design checks of the app shell, the screens that are placeholders until their story, and /dev/components
// (WEB-15). A screen story replaces its placeholder's entry with its own spec (README.md). Sign-in and "not on the
// list" are unstyled WEB-06 placeholders; WEB-17 designs them and adds their checks.

/** Signed-in screens with the shell. `map`: the page sits on --bg-abyss. */
const SHELL_SCREENS = [
  { name: "map", url: "/", map: true },
  { name: "components", url: "/dev/components", map: false },
];

test.describe("signed in", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
  });

  for (const screen of SHELL_SCREENS) {
    test.describe(screen.name, () => {
      test("background, shell type and data", async ({ page }) => {
        await openScreen(page, screen.url);
        await expectBackground(page, screen.map ? "map" : "data");
        await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
        const header = page.getByRole("banner");
        await expectStyles(header.getByRole("link").first(), {
          "font-family": "var(--font-display)",
          "font-size": isPhone(page) ? "var(--fs-brand-phone)" : "var(--fs-title)",
          color: "var(--gold-bright)",
        });
        await expectStyles(page.getByTestId("data-age"), {
          ...DATA,
          "font-size": isPhone(page) ? "var(--fs-meta-sm)" : "var(--fs-meta)",
          color: "var(--text-dim)",
        });
        await expectStyles(page.getByRole("navigation", { name: "Main" }).getByRole("link"), DATA);
        await expectStyles(page.getByRole("contentinfo"), { ...TYPE.metaSm, color: "var(--text-faint)" });
      });

      test("touch targets", async ({ page }) => {
        test.skip(!isPhone(page), "phone only");
        await openScreen(page, screen.url);
        await expectTouchTargets(page);
      });

      test("accessibility", async ({ page }) => {
        await openScreen(page, screen.url);
        await expectAccessible(page);
      });

      test("reduced motion", async ({ page }) => {
        await openScreen(page, screen.url);
        await expectNoMotion(page);
      });

      test("screenshot", async ({ page }) => {
        await openScreen(page, screen.url);
        await expectScreenshot(page, screen.name);
      });
    });
  }

  test("placeholder card: Marcellus title on the modal surface", async ({ page }) => {
    await openScreen(page, "/");
    const card = page.getByRole("main").getByText("Not built yet").locator("..");
    await expectStyles(card, SURFACE_MODAL);
    await expectStyles(page.getByText("Not built yet"), {
      ...TYPE.name,
      "font-size": "var(--fs-heading)",
      color: "var(--text-strong)",
    });
  });

  test("user menu: blurred surface, touch targets, accessible", async ({ page }) => {
    await openScreen(page, "/roster");
    const trigger = page.getByRole("button", { name: `Account ${ADMIN}` });
    await trigger.click();
    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    await expectStyles(panel, { ...SURFACE, "border-radius": "var(--r-panel)", "box-shadow": "var(--shadow-card)" });
    if (isPhone(page)) await expectTouchTargets(page);
    await expectAccessible(page);
  });

  test("components: the type scale, class colours and data", async ({ page }) => {
    await openScreen(page, "/dev/components");
    const type = page.getByRole("region", { name: "Type", exact: true });
    await expectStyles(type.getByText("Session report", { exact: true }), {
      ...TYPE.displayXl,
      "letter-spacing": "var(--ls-display-xl)",
    });
    await expectStyles(type.getByText("Roster", { exact: true }), TYPE.display);
    await expectStyles(type.getByText("Roll call", { exact: true }), TYPE.title);
    await expectStyles(type.getByText("Skill gains", { exact: true }), {
      ...TYPE.section,
      "letter-spacing": "var(--ls-section)",
    });
    await expectStyles(type.getByText("Ves Doombringer", { exact: true }), {
      ...characterName("WARLOCK"),
      "font-size": "var(--fs-name)",
    });
    await expectStyles(type.getByText(/^Level 39 Undead Warlock/), { ...DATA, ...TYPE.body });
    await expectStyles(type.getByText(/^Stranglethorn Vale/), { ...DATA, ...TYPE.meta });
    await expectStyles(type.getByText("New", { exact: true }), {
      ...TYPE.overline,
      "letter-spacing": "var(--ls-overline)",
    });
    // Section headings of the design-system board.
    const sections = /^(Type|Class disc|Data age badge|Faction tag|Filter chip|Segmented|Banner|Empty state|Skeleton|Shell)$/;
    await expectStyles(page.getByRole("heading", { level: 2, name: sections }), TYPE.titleLg);
    // Class discs: initials in Inter on the class fill.
    await expectStyles(page.getByRole("img", { name: "Warlock, level 39" }).first(), {
      ...DATA,
      "background-color": "var(--warlock)",
    });
    await expectStyles(page.getByRole("img", { name: "Shaman, level 33" }), {
      "background-color": "var(--shaman)",
      color: "var(--on-shaman)",
    });
  });

  test("with motion allowed, the reduced-motion check does see animations", async ({ page }) => {
    // Proves expectNoMotion would catch one: the skeletons shimmer on /dev/components.
    await openScreen(page, "/dev/components", { motion: true });
    await expect.poll(() => runningAnimations(page)).not.toEqual([]);
  });
});

