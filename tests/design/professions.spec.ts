import { test } from "@playwright/test";
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

// WEB-24: design checks of the professions page (board professions) on the sample data.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("professions: design values", async ({ page }) => {
  await openScreen(page, "/professions");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByRole("heading", { name: "By profession" }), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  await expectStyles(page.getByText("4 covered"), {
    ...TYPE.name,
    "font-size": "var(--fs-summary)",
    color: "var(--fresh-text)",
  });
  await expectStyles(page.getByText("5 gaps"), { color: "var(--stale-text)" });

  const tailoring = page.getByRole("region", { name: "Tailoring", exact: true });
  await expectStyles(tailoring, { "border-radius": "var(--r-card)", "background-color": "var(--surface)" });
  await expectStyles(tailoring.getByRole("link", { name: "Tailoring" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-profession)",
    color: "var(--text-strong)",
  });
  await expectStyles(tailoring.getByText("Covered"), {
    "font-size": "var(--fs-tiny)",
    color: "var(--fresh-text)",
    "background-color": "var(--covered-badge)",
  });
  // Names in the bars are data (Inter, board), in the class text colour.
  await expectStyles(tailoring.getByRole("link", { name: /Mira Sunstrider/ }), {
    ...DATA,
    color: characterName("MAGE").color!,
  });
  await expectStyles(tailoring.getByText("300 / 300"), { ...DATA, color: "var(--text-muted)" });
  await expectStyles(page.getByRole("region", { name: "Alchemy", exact: true }), {
    "border-top-color": "var(--gap-card-line)",
  });
  const ruk = page.getByRole("region", { name: "Mining", exact: true }).getByRole("listitem").nth(1);
  await expectStyles(ruk.locator("[aria-hidden=true]").last(), { opacity: "var(--opacity-old)" });

  const matrix = page.getByRole("region", { name: "Professions by character" });
  await expectStyles(matrix, { "border-radius": "var(--r-card)", "background-color": "var(--surface)" });
  await expectStyles(matrix.getByRole("table"), { ...DATA, "font-size": "var(--fs-meta)" });
  await expectStyles(matrix.getByText("No professions yet"), { color: "var(--text-faint)" });
});

test("professions: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/professions");
  await expectTouchTargets(page);
});

test("professions: accessibility", async ({ page }) => {
  await openScreen(page, "/professions");
  await expectAccessible(page);
});

test("professions: reduced motion", async ({ page }) => {
  await openScreen(page, "/professions");
  await expectNoMotion(page);
});

test("professions: screenshot", async ({ page }) => {
  await openScreen(page, "/professions");
  await expectScreenshot(page, "professions");
});
