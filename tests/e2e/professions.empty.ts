import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-24: professions before the first upload (runs before `seed` uploads the sample; playwright.config.ts).
test("professions are empty before the first upload, with the way to upload", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/professions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professions");
  await expect(page.getByRole("heading", { name: "No professions yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload the first file" })).toHaveAttribute("href", "/upload");
});
