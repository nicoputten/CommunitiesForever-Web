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
 * page fully streamed, the web fonts loaded. `motion: false` (the default) also emulates prefers-reduced-motion.
 */
export async function openScreen(page: Page, url: string, { motion = false } = {}): Promise<void> {
  await page.clock.setFixedTime(NOW * 1000);
  await page.emulateMedia({ reducedMotion: motion ? "no-preference" : "reduce" });
  await page.goto(url);
  await pageStreamed(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await mapSettled(page);
}

/**
 * On a map page: waits until the map has stopped moving. After load it can still jump (the continent framed, the
 * ResizeObserver re-centring once the page's scrollbar appears, MapStage's settle 120 ms after the last transform), and
 * a check that clicks before that (a dungeon entrance's popover, placed by measuring) sees a map that moves on after
 * it. Settled: the stage's box unchanged for 400 ms. Other pages return at once.
 */
export async function mapSettled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const stage = document.querySelector("[data-map-frame] [data-level]");
        if (stage === null) return resolve();
        const QUIET_MS = 400;
        const started = performance.now();
        let last = "";
        let since = started;
        const tick = (now: number) => {
          const r = stage.getBoundingClientRect();
          const box = `${r.x},${r.y},${r.width},${r.height}`;
          if (box !== last) {
            last = box;
            since = now;
          }
          if (now - since >= QUIET_MS) resolve();
          else if (now - started > 10_000) reject(new Error(`the map kept moving: ${box}`));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/**
 * Waits until React has revealed every streamed Suspense boundary and the title is set (WEB-63). `goto` returns at
 * the load event, but on a slow machine (CI) a page's loading.tsx can still be showing then, with the real page in a
 * hidden `S:` segment: a check read the skeleton's heading just before it was swapped out (roster-table "design
 * values"), or ran before the title arrived (upload "nothing new").
 */
export async function pageStreamed(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.querySelector('[hidden][id^="S:"], template[id^="B:"]') === null &&
      document.title !== "" &&
      document.readyState === "complete",
  );
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
      // Radix's focus guards (an open dialog's invisible 0 × 0 spans that keep Tab inside it) are no targets (WEB-92).
      .filter((el) => el.tabIndex >= 0 && el.checkVisibility() && !el.hasAttribute("data-radix-focus-guard"))
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
 * says why and needs Nico's OK (the phone map, WEB-25: markers may overlap until zoom, WEB-26 and WEB-28). `exclude`
 * leaves elements out of the check, the same way: each use names Nico's decision.
 */
export async function expectAccessible(
  page: Page,
  disable: readonly string[] = [],
  exclude: readonly string[] = [],
): Promise<void> {
  let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  for (const selector of exclude) axe = axe.exclude(selector);
  const { violations } = await axe.disableRules([...disable]).analyze();
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
/**
 * `mask`: parts that differ per run (a random pairing code, WEB-34; the pinned card's raster at 4×, map-zone).
 * `reopen`: opens the screen again as the test did (`openScreen`), for a screen whose text the capture can disturb
 * (see `warmUpCapture`).
 */
export async function expectScreenshot(
  page: Page,
  name: string,
  mask: Locator[] = [],
  reopen?: () => Promise<void>,
): Promise<void> {
  test.skip(process.platform !== "linux", "screenshot baselines are Linux only: CI checks them");
  if (reopen !== undefined) await warmUpCapture(page, reopen);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask });
}

/**
 * Chromium captures a page taller than the viewport by enlarging the view for the capture (`captureBeyondViewport`,
 * every full-page screenshot), and now and then the page sees a resize to 1 × 1 and back while it does. Mostly on a
 * page's first capture, and a glyph can then stay rasterized differently: the "m" of the admin page's "Admins" heading
 * (126 px, the flaky admin-desktop baseline), until the page is loaded again. So a throwaway capture first, and when it
 * saw that resize the screen is opened anew (at most three times). CI runs with `--update-snapshots=changed`, which
 * writes a differing screenshot instead of failing, so this has to happen before `toHaveScreenshot`, not as a retry.
 */
async function warmUpCapture(page: Page, reopen: () => Promise<void>): Promise<void> {
  type Watched = { __cfTinyResize?: boolean };
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const w = window as unknown as Watched;
      if (w.__cfTinyResize !== undefined) return void (w.__cfTinyResize = false);
      w.__cfTinyResize = false;
      addEventListener("resize", () => {
        if (innerWidth < 100 || innerHeight < 100) w.__cfTinyResize = true;
      });
    });
    await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", scale: "device" });
    if (!(await page.evaluate(() => (window as unknown as Watched).__cfTinyResize))) return;
    await reopen();
  }
}
