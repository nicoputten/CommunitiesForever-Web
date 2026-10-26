import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { expectTouchTargets, isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-20: the session report of the seeded sample upload (seed.setup.ts, the site's first upload: id 1), at desktop
// and phone size. The upload tests run at the same time and change the admin's characters, so this checks what the
// stored summary says (names, levels, places), not the admin's current classes.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
});

test("the first upload's report: header, counters, new faces, and the ways on", async ({ page }) => {
  await page.goto("/upload/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Session report");
  await expect(page.getByText(/^First upload by \S+ · 10 characters from 5 friends$/)).toBeVisible();
  const counts = page.getByRole("list", { name: "Counts" });
  await expect(counts.getByRole("listitem")).toHaveText([
    "0 levels gained",
    "0 skill gains",
    "11 new characters",
    "9 new sightings",
  ]);

  const faces = page.getByRole("region", { name: "New faces" });
  await expect(faces.getByText("Bob's new Troll Rogue · level 41 · The Deadmines, Westfall")).toBeVisible();
  await expect(faces.getByText("Sanne's character", { exact: true })).toBeHidden();
  await faces.getByRole("button", { name: "Show 5 more" }).click();
  await expect(faces.getByText("Sanne's character", { exact: true })).toBeVisible();
  await expect(faces.getByText("Sanne's new character · Location unknown")).toBeVisible();

  const senders = page.getByRole("region", { name: "Who sent data" });
  await expect(senders.getByText("Sanne · no addon")).toBeVisible();
  await expect(senders.getByText(/^Mira · \d+ days?, via Bob$/)).toBeVisible();

  await expect(page.getByRole("link", { name: "Upload another" })).toHaveAttribute("href", "/upload");
  await faces.getByRole("link", { name: /^Roster →.*Bob Example$/ }).click();
  await expect(page).toHaveURL(/\/character\//);
  await page.goBack();
  await page.getByRole("link", { name: "Open the map" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("a report that isn't there is not found", async ({ page }) => {
  // The loading skeleton streams first, so the status is already sent: the page says it instead.
  for (const url of ["/upload/999999", "/upload/abc"]) {
    await page.goto(url);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});

test("touch targets are 44 px on phone", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await page.goto("/upload/1");
  await expectTouchTargets(page);
});
