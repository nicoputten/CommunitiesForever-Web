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
};

// Runs against the production build: `npm run build` first (CI does).
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // A touch phone at the narrowest width of the design (DESIGN.md §3: phone 375–390).
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "npm run start",
    env: {
      PORT: String(port),
      HOSTNAME: "localhost",
      DATA_DIR: path.join(tmpdir(), "communitiesforever-e2e"),
      AUTH_SECRET: E2E.secret,
      AUTH_URL: `http://localhost:${port}`,
      ADMIN_BATTLETAG: E2E.admin,
      AUTH_BATTLENET_ID: "e2e-client-id",
      AUTH_BATTLENET_SECRET: "e2e-client-secret",
    },
    port,
    reuseExistingServer: !process.env.CI,
  },
});
