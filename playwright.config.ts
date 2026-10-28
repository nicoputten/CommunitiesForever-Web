import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;

/**
 * The e2e server's auth settings. Battle.net is never called: tests sign in by setting a session cookie minted with
 * this secret (tests/e2e/session.ts). A test value, not a real secret.
 */
export const E2E = {
  secret: "e2e-only-secret-not-used-anywhere-else",
  admin: "Admin#1000",
  /** Publishes test releases of the uploader (WEB-35). */
  deploySecret: "e2e-deploy-secret-not-used-anywhere-else",
};

// A fresh database per run (WEB-21): the `empty` projects see the site before any upload, then `seed` uploads the
// sample data through the real upload route and the other tests run on it. Workers load this file again and
// inherit the environment, so the directory is made once.
process.env.E2E_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), "communitiesforever-e2e-"));

const desktop = { ...devices["Desktop Chrome"] };
// A touch phone at the narrowest width of the design (DESIGN.md §3: phone 375–390).
const phone = { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } };

/** Run by their own projects, in order: empty, seed, roster, professions and character. */
const OTHERS = /(\.empty|\.setup|(roster(-table)?|professions|character)\.spec)\.ts$/;

// Runs against the production build: `npm run build` first (CI does).
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Clock times are the viewer's local time (WEB-19): one zone, so they read the same on every machine.
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", timezoneId: "Europe/Amsterdam" },
  projects: [
    { name: "empty-desktop", testMatch: /\.empty\.ts$/, testIgnore: [], use: desktop },
    { name: "empty-phone", testMatch: /\.empty\.ts$/, testIgnore: [], use: phone },
    { name: "seed", testMatch: /seed\.setup\.ts$/, testIgnore: [], dependencies: ["empty-desktop", "empty-phone"] },
    // The roster, professions and character pages check the sample as seeded, before the upload tests (WEB-19) add members and characters.
    {
      name: "roster-desktop",
      testMatch: /(roster(-table)?|professions|character)\.spec\.ts$/,
      testIgnore: [],
      dependencies: ["seed"],
      use: desktop,
    },
    {
      name: "roster-phone",
      testMatch: /(roster(-table)?|professions|character)\.spec\.ts$/,
      testIgnore: [],
      dependencies: ["seed"],
      use: phone,
    },
    { name: "desktop", testIgnore: OTHERS, dependencies: ["roster-desktop", "roster-phone"], use: desktop },
    { name: "phone", testIgnore: OTHERS, dependencies: ["roster-desktop", "roster-phone"], use: phone },
  ],
  webServer: {
    command: "npm run start",
    env: {
      PORT: String(port),
      HOSTNAME: "localhost",
      DATA_DIR: process.env.E2E_DATA_DIR,
      AUTH_SECRET: E2E.secret,
      AUTH_URL: `http://localhost:${port}`,
      ADMIN_BATTLETAG: E2E.admin,
      AUTH_BATTLENET_ID: "e2e-client-id",
      AUTH_BATTLENET_SECRET: "e2e-client-secret",
      // Discord linking (WEB-39): made-up values; Discord itself is never called.
      DISCORD_CLIENT_ID: "e2e-discord-client-id",
      DISCORD_CLIENT_SECRET: "e2e-discord-secret",
      UPLOADER_DEPLOY_SECRET: E2E.deploySecret,
      // Doomsday before the engine (WEB-58): the made-up sample (src/server/doomsdaySample.ts).
      DOOMSDAY_SAMPLE: "1",
    },
    port,
    // Always a fresh server: a reused one would have another database.
    reuseExistingServer: false,
  },
});
