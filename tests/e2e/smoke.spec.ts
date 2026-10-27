import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

test("sends a visitor without a session to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page).toHaveTitle(/^Sign in · .+/);
  await expect(page.getByRole("button", { name: "Sign in with Battle.net" })).toBeVisible();
});

test("shows the home page to the admin", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Map");
  await expect(page.getByRole("region", { name: "World map" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Account ${E2E.admin}` })).toBeVisible();
});

test("tells someone not on the list", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "Stranger#9999");
  await page.goto("/");
  await expect(page).toHaveURL(/\/not-on-list$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The gate stays closed");
  await expect(page.getByText("Stranger#9999", { exact: true })).toBeVisible();
});

test("answers the API without a session with 401", async ({ request }) => {
  expect((await request.get("/api/admin/guests")).status()).toBe(401);
});

test("starts the Battle.net sign-in", async ({ page }) => {
  // Stop at Battle.net's door: the authorize URL shows the client, scope and callback the site asks for.
  let authorize: URL | undefined;
  await page.route("https://eu.battle.net/**", async (route) => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "Battle.net" });
  });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign in with Battle.net" }).click();
  await expect.poll(() => authorize?.pathname).toBe("/oauth/authorize");
  expect(authorize?.searchParams.get("client_id")).toBe("e2e-client-id");
  expect(authorize?.searchParams.get("scope")).toBe("openid");
  expect(authorize?.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/battlenet$/);
});
