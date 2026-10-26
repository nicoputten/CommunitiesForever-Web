import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
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

// WEB-20: design checks of the session report (board upload-report). The seed uploads the day before (upload 1, the
// site's first) and then the design sample (upload 2): upload 2 has level ups, skill gains and sightings.

const REPORT = "/upload/2";
const FIRST = "/upload/1";

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("report: design values", async ({ page }) => {
  await openScreen(page, REPORT);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), {
    ...(isPhone(page) ? TYPE.display : TYPE.displayXl),
    color: "var(--gold-pale)",
    "text-shadow": "var(--text-glow-report)",
  });
  await expect(page.getByText(/^Uploaded today at 21:00 by Nico · new data from \d friends?$/)).toBeVisible();

  const counter = page.getByRole("list", { name: "Counts" }).getByRole("listitem").first();
  await expectStyles(counter, {
    "border-radius": "var(--r-panel)",
    "background-color": "var(--surface-aside)",
    "border-top-color": "var(--line-report)",
  });
  await expectStyles(counter.locator("span").first(), {
    ...TYPE.name,
    "font-size": "var(--fs-counter)",
    color: "var(--gold-pale)",
  });
  await expectStyles(counter.locator("span").last(), { ...TYPE.meta, color: "var(--text-muted)" });

  const levels = page.getByRole("region", { name: "Level ups" });
  await expectStyles(levels.getByRole("heading"), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  await expectStyles(levels.getByText("Ves Doombringer", { exact: true }), {
    ...characterName("WARLOCK"),
    "font-size": "var(--fs-section)",
  });
  await expectStyles(levels.getByText(/^LEVEL UP/).first(), {
    ...TYPE.name,
    "font-family": "var(--font-ui)",
    "font-size": "var(--fs-tiny)",
    "letter-spacing": "var(--ls-badge)",
    color: "var(--on-shine)",
  });
  await expectStyles(levels.getByRole("img", { name: /^Warlock/ }).first(), {
    width: "var(--size-report-disc)",
    "background-color": "var(--warlock)",
  });

  const skills = page.getByRole("region", { name: "Skill gains" });
  await expect(skills).toBeVisible();
  const senders = page.getByRole("region", { name: "Who sent data" });
  await expectStyles(senders.getByRole("listitem").first(), {
    ...TYPE.meta,
    "border-radius": "var(--r-pill)",
    color: "var(--text-chip)",
  });
  await expect(senders.getByText("Sanne · no addon")).toBeVisible();

  await expectStyles(page.getByRole("link", { name: "Open the map" }), {
    ...DATA,
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-btn)",
  });
  // Without motion there is nothing to replay.
  await expect(page.getByRole("button", { name: "Replay" })).toBeHidden();
});

test("report: with motion, it rises, the bars grow and Replay plays it again", async ({ page }) => {
  await openScreen(page, REPORT, { motion: true });
  const replay = page.getByRole("button", { name: "Replay" });
  await expect(replay).toBeVisible();
  await expect(page.locator("[data-report] h1")).toHaveCSS("animation-name", /rise$/);
  await replay.click();
  await expect(replay).toBeFocused();
});

test("report: the first upload", async ({ page }) => {
  await openScreen(page, FIRST);
  await expect(page.getByText(/^First upload by Nico · \d+ characters from \d+ friends$/)).toBeVisible();
  const faces = page.getByRole("region", { name: "New faces" });
  const more = faces.getByRole("button", { name: /^Show \d+ more$/ });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(faces.getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
  await expectAccessible(page);
  await expectScreenshot(page, "report-first");
});

test("report: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, REPORT);
  await expectTouchTargets(page);
});

test("report: accessibility", async ({ page }) => {
  await openScreen(page, REPORT);
  await expectAccessible(page);
});

test("report: reduced motion", async ({ page }) => {
  await openScreen(page, REPORT);
  await expectNoMotion(page);
});

test("report: screenshot", async ({ page }) => {
  await openScreen(page, REPORT);
  await expectScreenshot(page, "report");
});
