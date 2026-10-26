import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-16: the atmosphere on the map, sign-in and data pages, the Motion switch and reduced motion.

const ACCOUNT = `Account ${E2E.admin}`;

/** Ambient animations ([data-ambient] layers) by play state. */
function ambient(page: Page) {
  return page.evaluate(() => {
    const states = document
      .getAnimations()
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.closest("[data-ambient]") !== null;
      })
      .map((a) => a.playState);
    return {
      running: states.filter((s) => s === "running").length,
      paused: states.filter((s) => s === "paused").length,
    };
  });
}

/** Any CSS animation (keyframes) still running on the page. Transitions don't count: reduced motion keeps them as an
 * 80 ms fade (DESIGN.md §6). */
function running(page: Page) {
  return page.evaluate(
    () => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.playState === "running").length,
  );
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: ACCOUNT }).click();
  return page.getByRole("switch", { name: "Motion" });
}

test.describe("signed in", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL!, E2E.admin);
  });

  test("the map page is alive, data pages are calm", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-atmosphere="map"]')).toHaveCount(1);
    expect((await ambient(page)).running).toBeGreaterThan(0);

    await page.goto("/roster");
    await expect(page.locator('[data-atmosphere="calm"]')).toHaveCount(1);
    await expect(page.locator('[data-atmosphere="map"]')).toHaveCount(0);
    expect(await running(page)).toBe(0);
  });

  test("the Motion switch stops everything and persists across a reload", async ({ page }) => {
    await page.goto("/");
    const motion = await openMenu(page);
    await expect(motion).toHaveAttribute("aria-checked", "true");
    await motion.click();
    await expect(motion).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    expect(await running(page)).toBe(0);

    // Applied by the head script before first paint: off already at DOMContentLoaded, before hydration.
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("off");
    expect((await ambient(page)).running).toBe(0);
    await page.waitForLoadState("load");
    await expect(await openMenu(page)).toHaveAttribute("aria-checked", "false");
    expect(await running(page)).toBe(0);

    // And back on.
    await page.getByRole("switch", { name: "Motion" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    expect((await ambient(page)).running).toBeGreaterThan(0);
  });

  test("reduced motion: no animations, until the switch overrides it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await running(page)).toBe(0);
    const motion = await openMenu(page);
    await expect(motion).toHaveAttribute("aria-checked", "false");
    await motion.click();
    await expect(motion).toHaveAttribute("aria-checked", "true");
    expect((await ambient(page)).running).toBeGreaterThan(0);
  });

  test("animations pause while the tab is hidden", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-tab", "hidden");
    const hidden = await ambient(page);
    expect(hidden.running).toBe(0);
    expect(hidden.paused).toBeGreaterThan(0);

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("html")).not.toHaveAttribute("data-tab", "hidden");
    expect((await ambient(page)).running).toBeGreaterThan(0);
  });

  test("the sea preview on /dev/components animates", async ({ page }) => {
    await page.goto("/dev/components");
    await expect(page.getByRole("img", { name: "Animated sea preview" })).toBeVisible();
    expect((await ambient(page)).running).toBeGreaterThan(0);
  });
});

test.describe("signed out", () => {
  test("sign-in is alive with embers; reduced motion leaves still fog and no embers", async ({ page }) => {
    await page.goto("/signin");
    const layer = page.locator('[data-atmosphere="signin"]');
    await expect(layer).toHaveCount(1);
    expect((await ambient(page)).running).toBeGreaterThan(0);
    await expect(layer.locator("span").first()).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await running(page)).toBe(0);
    await expect(layer.locator("span").first()).toBeHidden();
  });

  test("the layers are hidden from assistive tech and never take pointer or focus", async ({ page }) => {
    await page.goto("/signin");
    const layers = page.locator("[data-atmosphere], [data-ambient]");
    expect(await layers.count()).toBeGreaterThan(0);
    const report = await layers.evaluateAll((els) =>
      els.map((el) => ({
        hidden: el.closest('[aria-hidden="true"]') !== null,
        pointer: getComputedStyle(el).pointerEvents,
        focusable: el.querySelectorAll("a, button, input, [tabindex]").length,
      })),
    );
    for (const r of report) expect(r).toEqual({ hidden: true, pointer: "none", focusable: 0 });
    // Nothing of the atmosphere reaches the accessibility tree: the page reads as just the sign-in.
    const tree = await page.locator("body").ariaSnapshot();
    expect(tree).not.toMatch(/img|svg|fog|ember/i);
  });
});
