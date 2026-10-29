import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE,
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

// WEB-25: design checks of the world map (boards map and map-states) on the sample data.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

/** The zoom's transform holds still for longer than the map's settle (MapStage SETTLE_MS, 120 ms). */
async function mapSettled(page: import("@playwright/test").Page) {
  const content = page.getByRole("group", { name: /^Map\./ }).locator(":scope > div");
  const read = () => content.evaluate((el) => (el as HTMLElement).style.transform);
  let last = "";
  await expect
    .poll(
      async () => {
        const now = await read();
        const still = now !== "" && now === last;
        last = now;
        return still;
      },
      { intervals: [300] },
    )
    .toBe(true);
}

const marker = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });

test("map: design values", async ({ page }) => {
  await openScreen(page, "/");
  await expectBackground(page, "map");
  // DESIGN.md §4: new = class fill; days = dark fill, class ring, 70%; week+ = dashed ring, 50%.
  await expectStyles(marker(page, "Tok Ironhide").locator("span").first(), {
    ...DATA,
    "font-size": "var(--fs-meta-sm)",
    "background-color": "var(--shaman)",
    color: "var(--on-shaman)",
    width: "var(--size-marker)",
  });
  await expectStyles(marker(page, "Grom Ashfeller").locator("span").first(), {
    "background-color": "var(--marker-ring-bg)",
    "border-top-color": "var(--warrior)",
    opacity: "var(--opacity-days)",
  });
  await expectStyles(marker(page, "Ruk Bloodhoof").locator("span").first(), {
    "border-top-style": "dashed",
    "border-top-color": "var(--hunter)",
    opacity: "var(--opacity-week)",
  });
  await expectStyles(page.getByText("9d", { exact: true }), { "font-size": "var(--fs-tiny)", color: "var(--stale-note)" });
  await expectStyles(page.getByRole("button", { name: /^2 characters in Westfall/ }).locator('[class*="count"]'), {
    ...DATA,
    "font-size": "var(--fs-body-sm)",
    "background-color": "var(--cluster-core)",
  });
});

test("map: hover card", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the card beside the marker");
  await openScreen(page, "/");
  await marker(page, "Tok Ironhide").hover();
  const card = page.getByTestId("character-card");
  await expect(card).toBeVisible();
  await expectStyles(card, {
    ...SURFACE,
    "background-color": "var(--surface-strong)",
    "border-radius": "var(--r-card)",
    "box-shadow": "var(--shadow-card)",
    width: "var(--size-card-map)",
  });
  await expectStyles(card.getByRole("heading", { name: "Tok Ironhide" }), {
    ...characterName("SHAMAN"),
    "font-size": "var(--fs-name-card)",
  });
  await expectStyles(card.getByText(/^Level 33/), { ...DATA, "font-size": "var(--fs-meta)", color: "var(--text-muted)" });
  await expectAccessible(page);
});

test("map: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/");
  await expectTouchTargets(page);
});

// On a phone the whole world is 375 px wide, so neighbouring markers overlap until zoom (WEB-26) and the phone map
// (WEB-28): approved by Nico for WEB-25 (proposal 9). Each marker still has its 44 px target.
const OVERLAP = ["target-size"];

test("map: accessibility", async ({ page }) => {
  await openScreen(page, "/");
  await expectAccessible(page, isPhone(page) ? OVERLAP : []);
});

test("map: reduced motion", async ({ page }) => {
  await openScreen(page, "/");
  await expectNoMotion(page);
});

test("map: screenshot", async ({ page }) => {
  await openScreen(page, "/");
  await expectScreenshot(page, "map");
});

test("map: screenshot with a selected character in an open fan", async ({ page }) => {
  test.skip(isPhone(page), "desktop: a phone opens the character in its sheet (phone-map.spec.ts, WEB-28)");
  await openScreen(page, "/");
  await page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ }).click();
  await marker(page, "Ves Doombringer").click();
  await expect(page.getByTestId("character-card")).toBeVisible();
  await page.mouse.move(0, 0);
  // The pinned card is masked: its text rasterises a little differently per run inside the zoomed layer (see
  // "map-zone"); its look is checked by the hover card's style checks.
  await expectScreenshot(page, "map-selected", [page.getByTestId("character-card")]);
});

test("map: screenshot of Kalimdor", async ({ page }) => {
  await openScreen(page, "/?continent=kalimdor");
  await expectScreenshot(page, "map-kalimdor");
});

// WEB-26: zoom levels (map-states board), the zoom buttons and the zone name in the top bar.

test("map: zoom buttons", async ({ page }) => {
  test.skip(isPhone(page), "desktop: a phone pinches");
  await openScreen(page, "/");
  await expectStyles(page.getByRole("button", { name: "Zoom in" }), {
    width: "var(--size-touch)",
    height: "var(--size-touch)",
    "border-radius": "var(--r-btn)",
    "background-color": "var(--control-map)",
    color: "var(--gold-bright)",
    "font-size": "var(--fs-zoom)",
  });
});

test("map: screenshot at continent zoom (2×)", async ({ page }) => {
  await openScreen(page, "/?continent=eastern-kingdoms");
  // Zoom from the settled first view. The desktop frames the continent at about 1.4× and zooms in to 2×; the
  // full-screen phone map (WEB-28) frames it past 2× already, and it stays framed (no spring-back to the world).
  await mapSettled(page);
  if (!isPhone(page)) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator('[data-level="continent"]')).toBeVisible();
  await mapSettled(page);
  await expectStyles(page.getByText("Booty Bay", { exact: true }), { "font-family": "var(--font-name)" });
  await expectAccessible(page, isPhone(page) ? OVERLAP : []);
  await expectScreenshot(page, "map-continent");
});

test("map: zone zoom (4×): name tags, dungeons, zone in the top bar", async ({ page }) => {
  await openScreen(page, "/?character=Player-1-0000A001");
  await expect(page.locator('[data-level="zone"]')).toBeVisible();
  // Settled: the zone in the centre is marked.
  await expect(page.locator("[data-label][data-focus]")).toBeAttached();
  if (!isPhone(page))
    await expectStyles(page.locator("[data-map-zone]"), {
      "font-family": "var(--font-display)",
      "font-size": "var(--fs-section)",
      color: "var(--gold-bright)",
    });
  await expectStyles(page.getByText("Ves Doombringer", { exact: true }).first(), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-meta-sm)",
  });
  await expect(page.getByText("The Deadmines", { exact: true }).last()).toBeVisible();
  await expectAccessible(page);
  await expectNoMotion(page);
  await page.mouse.move(0, 0);
  // Flaky before (PR #34, develop, main): the map was identical, but the pinned card's text rasterised a little
  // differently from run to run. The card is counter-scaled inside the 4× zoomed layer, and Chromium doesn't always
  // pick the same raster scale for it. This screenshot is about the zone level (name tags, dungeons, the zone in the top
  // bar), so the card is masked; its look is checked in "map-selected" and by the hover card's style checks.
  await mapSettled(page);
  await expectScreenshot(page, "map-zone", [page.getByTestId("character-card")]);
});

test("map: zone zoom touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/?character=Player-1-0000A001");
  await expect(page.locator('[data-level="zone"]')).toBeVisible();
  // Settled: the zone in the centre is marked.
  await expect(page.locator("[data-label][data-focus]")).toBeAttached();
  await expectTouchTargets(page);
});

// WEB-27: the roll call panel (map board), desktop only.

const rollCall = (page: import("@playwright/test").Page) => page.getByRole("complementary", { name: "Roll call" });

test("map: roll call design values", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the phone has its sheet (WEB-28)");
  await openScreen(page, "/");
  const panel = rollCall(page);
  await expectStyles(panel, {
    ...SURFACE,
    width: "var(--size-roll-call)",
    "background-color": "var(--surface-aside)",
    "border-top-color": "var(--line-panel)",
    "border-radius": "var(--r-panel)",
    "padding-top": "var(--s-4)",
  });
  await expectStyles(panel.getByRole("heading", { name: "Roll call" }), { ...TYPE.title, color: "var(--gold-bright)" });
  await expectStyles(panel.getByText("9 of 10 located"), { ...TYPE.meta, color: "var(--text-dim)" });
  await expectStyles(panel.getByRole("heading", { name: "Earlier" }), {
    "font-size": "var(--fs-overline)",
    "letter-spacing": "var(--ls-overline)",
    "text-transform": "uppercase",
    color: "var(--text-faint)",
  });
  const tok = panel.getByRole("button", { name: /^Tok Ironhide/ });
  await expectStyles(tok, { "min-height": "var(--size-touch)", "border-radius": "var(--r-nav)" });
  await expectStyles(tok.getByText("Tok Ironhide"), {
    ...TYPE.bodySm,
    "font-weight": "var(--fw-medium)",
    color: "var(--shaman-text)",
  });
  await expectStyles(tok.locator("[data-age]"), { "background-color": "var(--shaman)", width: "var(--size-dot-row)" });
  await expectStyles(panel.getByRole("button", { name: /^Ruk Bloodhoof/ }).locator("[data-age]"), {
    "border-top-style": "dashed",
    opacity: "var(--opacity-week)",
  });
  await expectStyles(panel.getByText(/Jorrit's data is 9 days old/), { ...TYPE.metaSm, color: "var(--stale-note)" });
  await expectStyles(panel.getByText("1 d", { exact: true }), { ...DATA, color: "var(--text-muted)" });
  await expectStyles(panel.getByText("Sanne has no addon data yet."), { ...TYPE.meta, color: "var(--text-dim)" });
  // WEB-65: one scroll area for the panel, and the never-sighted characters folded into one 44 px row.
  // Closed menus scroll too, so only what is shown counts.
  const scrollers = await panel.evaluate(
    (el) =>
      [el, ...el.querySelectorAll("*")].filter(
        (e) => e.checkVisibility() && /auto|scroll/.test(getComputedStyle(e).overflowY),
      ).length,
  );
  expect(scrollers).toBe(1);
  await expectStyles(panel.getByText("1 not sighted yet"), { "min-height": "var(--size-touch)", color: "var(--text-dim)" });
  // Zoom buttons left of the panel (board: right 352px).
  const zoomBox = await page.getByRole("button", { name: "Zoom in" }).boundingBox();
  const panelBox = await panel.boundingBox();
  expect(zoomBox!.x + zoomBox!.width).toBeLessThanOrEqual(panelBox!.x - 16);
});

test("map: roll call menus and picked row", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the phone has its sheet (WEB-28)");
  await openScreen(page, "/");
  await rollCall(page).getByRole("button", { name: /^Tok Ironhide/ }).click();
  await expect(rollCall(page).getByRole("button", { name: /^Tok Ironhide/ })).toHaveAttribute("aria-current", "true");
  // Past the 80 ms colour transition (globals.css), off the row.
  await page.mouse.move(0, 0);
  await expect(rollCall(page).getByRole("button", { name: /^Tok Ironhide/ })).toHaveCSS(
    "background-color",
    "rgba(212, 175, 106, 0.1)",
  );
  await expectStyles(rollCall(page).getByRole("button", { name: /^Tok Ironhide/ }), {
    "background-color": "var(--tint-row-selected)",
  });
  await rollCall(page).getByRole("button", { name: "Level 1–60" }).click();
  await expect(page.getByRole("menu", { name: "Level" })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  // The pinned card is masked: its text rasterises a little differently per run inside the zoomed layer (see
  // "map-zone"); its look is checked by the hover card's style checks.
  await expectScreenshot(page, "map-roll-call-picked", [page.getByTestId("character-card")]);
});

test("map: roll call with no match", async ({ page }) => {
  test.skip(isPhone(page), "desktop: the phone has its sheet (WEB-28)");
  await openScreen(page, "/?friend=Bob%232002&faction=alliance");
  await expect(rollCall(page).getByRole("heading", { name: "No characters match" })).toBeVisible();
  await expectAccessible(page);
  await expectScreenshot(page, "map-roll-call-empty");
});
