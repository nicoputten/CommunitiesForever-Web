import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-25: the world map on the sample data (seed.setup.ts): markers per zone, clusters, the hover card, the
// selection in the URL and the continent switch. WEB-26: zoom levels, the switch as a fly, fly-to and the drop.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

const marker = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name},`) });
const card = (page: Page) => page.getByTestId("character-card");

test("shows every located character at its zone", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "World map" });
  await expect(map.getByRole("img", { name: "Map of Kalimdor and the Eastern Kingdoms" })).toBeVisible();
  await expect(marker(page, "Tok Ironhide")).toHaveAccessibleName(/Hillsbrad Foothills, seen/);
  await expect(marker(page, "Ruk Bloodhoof")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2 characters in Westfall, including 1 in The Deadmines" }),
  ).toBeVisible();
  // Characters in a cluster appear when it opens.
  await expect(marker(page, "Ves Doombringer")).toHaveCount(0);
});

test("opens a cluster, selects a character and keeps it in the URL", async ({ page }) => {
  await page.goto("/");
  const stv = page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ });
  await stv.click();
  await expect(stv).toHaveAttribute("aria-expanded", "true");
  await marker(page, "Ves Doombringer").click();
  await expect(marker(page, "Ves Doombringer")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?character=/);
  await expect(card(page).getByRole("heading", { name: "Ves Doombringer" })).toBeVisible();
  await expect(card(page)).toContainText("Stranglethorn Vale");
  await expect(card(page).getByRole("link", { name: "Open character →" })).toHaveAttribute("href", /^\/character\//);

  // A reload keeps the selection (and opens its fan); Escape clears it.
  await page.reload();
  await expect(marker(page, "Ves Doombringer")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/character=/);
  await expect(card(page)).toHaveCount(0);
});

test("shows the card on hover or focus", async ({ page }) => {
  test.skip(isPhone(page), "desktop: hover");
  await page.goto("/");
  await marker(page, "Tok Ironhide").hover();
  await expect(card(page)).toContainText("Hillsbrad Foothills");
  await expect(card(page)).toContainText("Player");
  await page.mouse.move(5, 300);
  await expect(card(page)).toHaveCount(0);
  await marker(page, "Grom Ashfeller").focus();
  await expect(card(page).getByRole("heading", { name: "Grom Ashfeller" })).toBeVisible();
});

test("switches continents in the top bar, and Back returns", async ({ page }) => {
  test.skip(isPhone(page), "the switch is in the desktop top bar (the phone map is WEB-28)");
  await page.goto("/");
  const switcher = page.getByRole("navigation", { name: "Continent" });
  await expect(switcher.getByRole("link", { name: "Azeroth" })).toHaveAttribute("aria-current", "page");
  await switcher.getByRole("link", { name: "Kalimdor" }).click();
  await expect(page).toHaveURL(/\?continent=kalimdor$/);
  await expect(switcher.getByRole("link", { name: "Kalimdor" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "World map" })).toHaveAttribute("data-continent", "kalimdor");
  await page.goBack();
  await expect(page.getByRole("region", { name: "World map" })).toHaveAttribute("data-continent", "azeroth");
});

const stage = (page: Page) => page.locator("[data-level]");
/** The zoom's transform of the map: 1× and centred is "translate(0px, 0px) scale(1)". */
const transform = (page: Page) =>
  page
    .getByRole("group", { name: /^Map\./ })
    .locator(":scope > div")
    .evaluate((el) => (el as HTMLElement).style.transform);

test("zooms through world, continent and zone with the buttons and the keyboard", async ({ page }) => {
  test.skip(isPhone(page), "the buttons are desktop; a phone pinches");
  await page.goto("/");
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  await expect(stage(page)).toHaveAttribute("data-level", "world");
  await expect(zoomOut).toBeDisabled();
  await expect(page.getByText("Crossroads", { exact: true })).toBeHidden();

  await zoomIn.click();
  await expect(stage(page)).toHaveAttribute("data-level", "continent");
  await expect(page.getByText("Crossroads", { exact: true })).toBeVisible();
  // Clusters of 2–5 open as a fan by default.
  await expect(page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await zoomIn.click();
  await expect(stage(page)).toHaveAttribute("data-level", "zone");
  await expect(zoomIn).toBeDisabled();

  // 0 on the focused map: the whole world again, centred.
  await page.getByRole("group", { name: /^Map\./ }).press("0");
  await expect(stage(page)).toHaveAttribute("data-level", "world");
  await expect.poll(() => transform(page)).toBe("translate(0px, 0px) scale(1)");
  await page.getByRole("group", { name: /^Map\./ }).press("+");
  await expect(stage(page)).toHaveAttribute("data-level", "continent");
});

test("flies to a character from a link, at zone zoom with the zone in the top bar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^2 characters in Stranglethorn Vale/ }).click();
  await marker(page, "Ves Doombringer").click();
  const url = page.url();
  await page.goto(url);
  await expect(stage(page)).toHaveAttribute("data-level", "zone");
  await expect(marker(page, "Ves Doombringer")).toHaveAttribute("aria-pressed", "true");
  if (!isPhone(page)) await expect(page.locator("[data-map-zone]")).toHaveText("Stranglethorn Vale");
});

test("the continent switch flies, follows a pan, and Azeroth centres the whole world again", async ({ page }) => {
  test.skip(isPhone(page), "the switch is in the desktop top bar (the phone map is WEB-28)");
  await page.goto("/");
  const switcher = page.getByRole("navigation", { name: "Continent" });
  await switcher.getByRole("link", { name: "Eastern Kingdoms" }).click();
  await expect(page).toHaveURL(/\?continent=eastern-kingdoms$/);
  await expect.poll(() => transform(page)).not.toBe("translate(0px, 0px) scale(1)");

  await switcher.getByRole("link", { name: "Azeroth" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => transform(page)).toBe("translate(0px, 0px) scale(1)");

  // Zoomed in over Kalimdor, the switch follows.
  await page.getByRole("group", { name: /^Map\./ }).press("+");
  for (let i = 0; i < 4; i++) await page.getByRole("group", { name: /^Map\./ }).press("ArrowLeft");
  await expect(page).toHaveURL(/\?continent=kalimdor$/);
  await expect(switcher.getByRole("link", { name: "Kalimdor" })).toHaveAttribute("aria-current", "page");
});

test("the session report's link drops the new sightings in, once", async ({ page }) => {
  await page.goto("/upload/1");
  await page.getByRole("link", { name: "See them drop in on the map →" }).click();
  // A place is a point (0 × 0), so it is attached rather than visible; its marker drops in.
  await expect(page.locator("[data-drop]").first()).toBeAttached();
  // The drop plays once: the parameter is gone, so a reload shows the map as usual.
  await expect(page).not.toHaveURL(/drop=/);
  await page.reload();
  await expect(page.locator("[data-drop]")).toHaveCount(0);
});

test("dragged past the edge, the map gives way only partly and springs back to the land", async ({ page }) => {
  test.skip(isPhone(page), "desktop: a mouse drag");
  await page.goto("/");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(stage(page)).toHaveAttribute("data-level", "continent");
  const before = await transform(page);
  await page.mouse.move(600, 400);
  await page.mouse.down();
  for (let x = 700; x <= 2600; x += 100) await page.mouse.move(x, 400);
  // Far past the west edge, the map moved less than the pointer.
  const dragged = Number(/translate\((-?[\d.]+)px/.exec(await transform(page))?.[1]);
  expect(dragged - Number(/translate\((-?[\d.]+)px/.exec(before)?.[1])).toBeLessThan(2000);
  await page.mouse.up();
  await expect(marker(page, "Ruk Bloodhoof")).toBeInViewport();
});
