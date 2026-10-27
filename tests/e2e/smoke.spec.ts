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

// WEB-36: the icons and the manifest answer without a session (the sign-in page links them).
test("serves the tab icons and the web app manifest to everyone", async ({ page, request }) => {
  const types: Record<string, RegExp> = {
    "/favicon.ico": /image\/(x-icon|vnd\.microsoft\.icon)/,
    "/icon.svg": /image\/svg\+xml/,
    "/apple-icon.png": /image\/png/,
    "/icon-192.png": /image\/png/,
    "/icon-512.png": /image\/png/,
    "/icon-maskable-512.png": /image\/png/,
    "/manifest.webmanifest": /application\/manifest\+json/,
  };
  for (const [url, type] of Object.entries(types)) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toMatch(type);
  }
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { name: string; icons: unknown[] };
  expect(manifest.name).toBeTruthy();
  expect(manifest.icons).toHaveLength(3);

  await page.goto("/signin");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});
