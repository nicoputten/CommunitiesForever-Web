import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  TYPE,
  characterName,
  expectAccessible,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-28: design checks of the phone map (boards phone-map, phone-character and phone-roll-call) on the sample data.

test.beforeEach(async ({ context, baseURL, page }) => {
  test.skip(!isPhone(page), "phone only: the desktop has the roll call panel (WEB-27)");
  await signInAs(context, baseURL!, ADMIN);
});

/** Local look (Windows has no baselines): `PHONE_SHOTS=<dir>` saves each state as a PNG there. */
async function shot(page: Page, name: string) {
  const dir = process.env.PHONE_SHOTS;
  if (dir !== undefined) await page.screenshot({ path: `${dir}/${name}.png` });
}

/** The zoom's transform holds still for longer than the map's settle (MapStage SETTLE_MS, 120 ms). */
async function mapSettled(page: Page) {
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

const sheet = (page: Page) => page.locator("[data-snap]");

// On a phone neighbouring markers overlap until zoom (approved for WEB-25, proposal 9); each has its 44 px target.
const OVERLAP = ["target-size"];

test("phone map: peek, design values", async ({ page }) => {
  await openScreen(page, "/?continent=eastern-kingdoms");
  await mapSettled(page);
  await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
  // WEB-65 (board live-test-phone): the map's app bar shows the shield only; the link keeps the site's name.
  const brand = page.getByRole("banner").getByRole("link", { name: "Doombringers" });
  await expect(brand).toBeVisible();
  expect((await brand.boundingBox())!.width).toBeLessThanOrEqual(48);
  await expectStyles(sheet(page), {
    "background-color": "var(--surface-sheet-peek)",
    "border-top-left-radius": "var(--r-sheet)",
    "box-shadow": "var(--shadow-sheet)",
  });
  await expectStyles(sheet(page).getByRole("heading", { name: "Roll call" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-sheet-title)",
    color: "var(--gold-bright)",
  });
  await expectStyles(page.getByRole("button", { name: /^Ves Doombringer · 2 h/ }), {
    "min-height": "var(--size-touch)",
    "border-radius": "var(--r-card)",
    "background-color": "var(--chip-peek-bg)",
  });
  await expectStyles(page.getByRole("button", { name: /^\d+ in Kalimdor$/ }), {
    ...DATA,
    "font-size": "var(--fs-meta-sm)",
    "background-color": "var(--surface-hint)",
  });
  await shot(page, "peek");
  await expectTouchTargets(page);
  await expectAccessible(page, OVERLAP);
  await expectNoMotion(page);
  await expectScreenshot(page, "phone-map");
});

test("phone map: the tapped character in the half sheet", async ({ page }) => {
  await openScreen(page, "/?continent=eastern-kingdoms");
  await mapSettled(page);
  await page.getByRole("button", { name: /^Ves Doombringer · 2 h/ }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "half");
  await mapSettled(page);
  const half = page.getByRole("region", { name: "Ves Doombringer" });
  await expectStyles(half.getByRole("heading", { name: "Ves Doombringer" }), {
    ...characterName("WARLOCK"),
    "font-size": "var(--fs-name-lg)",
  });
  await expect(half.getByText("Level 39 Undead Warlock · Horde")).toBeVisible();
  await expect(half.getByText("21 to go")).toBeVisible();
  await expect(half.getByText("10 / 0 / 20")).toBeVisible();
  await expect(half.getByText("187 / 225")).toBeVisible();
  await expectStyles(half.getByRole("link", { name: "Open character" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(page.locator("[data-map-phone-title] > span").first(), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-brand-phone)",
  });
  await expect(page.getByText("2 here")).toBeVisible();
  await shot(page, "half");
  await expectTouchTargets(page);
  await expectAccessible(page, OVERLAP);
  await expectNoMotion(page);
  await expectScreenshot(page, "phone-character");
});

test("phone map: the full roll call with its filters", async ({ page }) => {
  await openScreen(page, "/?continent=eastern-kingdoms");
  await mapSettled(page);
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(sheet(page)).toHaveAttribute("data-snap", "full");
  await expectStyles(sheet(page), { "background-color": "var(--surface-sheet-full)" });
  await expect(sheet(page).getByRole("heading", { name: "Roll call" })).toHaveCSS("font-size", "22px");
  await expectStyles(sheet(page).getByRole("heading", { name: "Roll call" }), TYPE.titleLg);
  await expect(sheet(page).getByRole("button", { name: "All", pressed: true })).toBeVisible();
  await expect(sheet(page).getByText("1 not sighted yet")).toBeVisible();
  await shot(page, "full");
  await expectTouchTargets(page);
  await expectAccessible(page, OVERLAP);
  await expectNoMotion(page);
  await expectScreenshot(page, "phone-roll-call");
});
