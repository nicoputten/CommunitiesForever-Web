import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-29: the map before the first upload (runs before `seed` uploads the sample; playwright.config.ts).
test("the map is empty before the first upload: the way to upload and the guest list", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The map is still empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload the first file" })).toHaveAttribute("href", "/upload");
  const rollCall = page.getByRole("complementary", { name: "Roll call" });
  await expect(rollCall.getByText("0 located")).toBeVisible();
  await expect(rollCall.getByRole("listitem")).toContainText([E2E.admin]);
});

test("a guest waits for the admin's first upload", async ({ page, context, baseURL }, testInfo) => {
  // One guest per project: both projects run at once on the same database.
  const guest = testInfo.project.name.endsWith("phone") ? "Femke#3307" : "Mira#1188";
  await signInAs(context, baseURL!, E2E.admin);
  const put = await page.request.put("/api/admin/guests", { data: { battleTag: guest, mayUpload: true } });
  expect(put.ok()).toBe(true);
  try {
    await context.clearCookies();
    await signInAs(context, baseURL!, guest);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The map is still empty" })).toBeVisible();
    await expect(
      page.getByText("Admin hasn't uploaded any data yet. Check back after the next session."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Upload the first file" })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Roll call" }).getByRole("listitem")).toContainText([
      E2E.admin,
      guest,
    ]);
  } finally {
    await context.clearCookies();
    await signInAs(context, baseURL!, E2E.admin);
    await page.request.delete("/api/admin/guests", { data: { battleTag: guest } });
  }
});
