import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLASSES, type ClassFile } from "@/core/gamedata/classes";
import { NOW } from "./sample";

// The design checks every screen runs (WEB-30; how to add a screen: tests/design/README.md). Expected values are
// always written as tokens (var(--…)); the browser resolves them, so a check never repeats a raw value.

/** CSS property → expected value with tokens, e.g. `{ "font-size": "var(--fs-display)" }`. */
export type Styles = Record<string, string>;

/** DESIGN.md §3 type scale. */
export const TYPE = {
  displayXl: { "font-family": "var(--font-display)", "font-size": "var(--fs-display-xl)" },
  display: { "font-family": "var(--font-display)", "font-size": "var(--fs-display)" },
  titleLg: { "font-family": "var(--font-display)", "font-size": "var(--fs-title-lg)" },
  title: { "font-family": "var(--font-display)", "font-size": "var(--fs-title)" },
  section: { "font-family": "var(--font-display)", "font-size": "var(--fs-section)" },
  /** Character names and big numbers: Marcellus; the size is the screen's (15–21). */
  name: { "font-family": "var(--font-name)" },
  body: { "font-family": "var(--font-ui)", "font-size": "var(--fs-body)" },
  bodySm: { "font-family": "var(--font-ui)", "font-size": "var(--fs-body-sm)" },
  meta: { "font-family": "var(--font-ui)", "font-size": "var(--fs-meta)" },
  metaSm: { "font-family": "var(--font-ui)", "font-size": "var(--fs-meta-sm)" },
  overline: {
    "font-family": "var(--font-ui)",
    "font-size": "var(--fs-overline)",
    "font-weight": "var(--fw-medium)",
    "text-transform": "uppercase",
  },
} satisfies Record<string, Styles>;

/** Data: Inter with tabular numbers. */
export const DATA: Styles = { "font-family": "var(--font-ui)", "font-variant-numeric": "tabular-nums" };

/** A blurred surface (panels, menus, cards over the map). */
export const SURFACE: Styles = { "backdrop-filter": "blur(var(--blur-surface))" };
/** The centre card and modals. */
export const SURFACE_MODAL: Styles = { "backdrop-filter": "blur(var(--blur-modal))" };

/** A character name: Marcellus in the class's `-text` colour. */
export function characterName(classFile: ClassFile): Styles {
  return { ...TYPE.name, color: `var(${CLASSES[classFile].textToken})` };
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/**
 * Opens a screen the way the checks see it: the browser clock at the sample's "now" (the server has FIXED_NOW), the
 * web fonts loaded. `motion: false` (the default) also emulates prefers-reduced-motion.
 */
export async function openScreen(page: Page, url: string, { motion = false } = {}): Promise<void> {
  await page.clock.setFixedTime(NOW * 1000);
  await page.emulateMedia({ reducedMotion: motion ? "no-preference" : "reduce" });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Every element of `target` has the expected computed styles. A `font-family` also has to be loaded, so a
 * missing web font doesn't pass on its fallback.
 */
export async function expectStyles(target: Locator, expected: Styles): Promise<void> {
  await expect(target.first()).toBeAttached();
  const wrong = await target.evaluateAll((els, want) => {
    const probe = document.createElement("div");
    probe.style.display = "none";
    document.body.append(probe);
    const out: string[] = [];
    for (const el of els) {
      const got = getComputedStyle(el);
      const label = `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
      for (const [prop, value] of Object.entries(want)) {
        probe.style.setProperty(prop, value);
        const expected = getComputedStyle(probe).getPropertyValue(prop);
        const actual = got.getPropertyValue(prop);
        if (expected === "") out.push(`${prop}: ${value} does not resolve (unknown token?)`);
        else if (actual !== expected) out.push(`${label} ${prop}: ${actual}, expected ${expected} (${value})`);
        if (prop === "font-family") {
          const first = actual.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
          const loaded = [...document.fonts].some((f) => f.family.replace(/["']/g, "") === first && f.status === "loaded");
          if (!loaded) out.push(`${label} font ${first} is not loaded`);
        }
      }
    }
    probe.remove();
    return out;
  }, expected);
  expect(wrong).toEqual([]);
}

/** The page background: --bg-abyss on map pages, --bg-night on data pages (DESIGN.md §3). */
export async function expectBackground(page: Page, kind: "map" | "data"): Promise<void> {
  await expectStyles(page.locator("body"), {
    "background-color": kind === "map" ? "var(--bg-abyss)" : "var(--bg-night)",
  });
}

/** Every visible interactive element is at least 44 × 44 px (CLAUDE.md rule 11). Run it at phone size. */
export async function expectTouchTargets(page: Page): Promise<void> {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, summary, [tabindex]")]
      .filter((el) => el.tabIndex >= 0 && el.checkVisibility())
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      // The skip link sits above the page until it has focus. A hundredth of a pixel is rounding: the map's markers
      // keep their size under any zoom by scaling back (1 / zoom × zoom).
      .filter(({ r }) => r.bottom > 0 && (r.width < 43.99 || r.height < 43.99))
      .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
}

/**
 * axe-core finds no serious or critical WCAG 2.2 AA violation. `disable` turns off named rules for one check; each use
 * says why and needs Nico's OK (the phone map, WEB-25: markers may overlap until zoom, WEB-26 and WEB-28).
 */
export async function expectAccessible(page: Page, disable: readonly string[] = []): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .disableRules([...disable])
    .analyze();
  const bad = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
  expect(bad).toEqual([]);
}

/** The running animations and transitions on the page (CSS and Web Animations). */
export async function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        const name = "animationName" in a ? (a as CSSAnimation).animationName : a.constructor.name;
        return `${target?.tagName.toLowerCase() ?? "?"}.${target?.className ?? ""} ${name}`;
      }),
  );
}

/**
 * With prefers-reduced-motion, nothing animates (DESIGN.md §6). Generic: it covers every CSS animation,
 * transition and Web Animation, whoever adds it. Open the screen with `openScreen` (reduced motion is its default).
 */
export async function expectNoMotion(page: Page): Promise<void> {
  // Give load-time animations a moment to start (and, at 0s, to finish).
  await page.waitForTimeout(300);
  expect(await runningAnimations(page)).toEqual([]);
}

/**
 * The screen matches its screenshot baseline. Baselines are made on Linux in the Playwright image (CI), since fonts
 * render differently on other systems; elsewhere this check is skipped. Open the screen with `openScreen` first.
 */
export async function expectScreenshot(page: Page, name: string): Promise<void> {
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}
