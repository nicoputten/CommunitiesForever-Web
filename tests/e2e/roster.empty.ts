import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-21: the roster before the first upload (runs before `seed` uploads the sample; playwright.config.ts).
test("the roster is empty before the first upload, with the way to upload", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/roster");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roster");
  await expect(page.getByRole("heading", { name: "The roster is still empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload the first file" })).toHaveAttribute("href", "/upload");
});
