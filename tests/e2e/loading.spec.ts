import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-29: a slow page change shows the thin gold line under the top bar, only after 300 ms.

test("a slow page change shows the gold line after 300 ms", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/roster");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  // Hold the professions page's server render (the RSC request of the client navigation).
  await page.route(/\/professions\?_rsc=/, async (route) => {
    await held;
    await route.continue();
  });
  const line = page.getByRole("status").filter({ hasText: "Loading" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Professions" }).first().click();
  await expect(line).toBeAttached();
  await expect(line).toHaveCSS("opacity", "1");
  release();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professions");
  await expect(line).toHaveCount(0);
});
