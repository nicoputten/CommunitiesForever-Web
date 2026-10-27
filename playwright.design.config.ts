import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./playwright.config";
import { ADMIN, NOW } from "./tests/design/sample";

// The design checks (WEB-30; tests/design/README.md): `npm run test:design`, against the production build
// (`npm run build` first). Its own server on a fresh database, seeded with the sample data (tests/design/sample.ts)
// and a fixed "now", so screenshots stay the same from run to run.

const port = 3200;

// A fresh database per run. Workers load this file again and inherit the environment, so the directory is made once.
process.env.DESIGN_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), "communitiesforever-design-"));

// The desktop canvas of the boards (DESIGN.md §3).
const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
// A touch phone at the narrowest width of the design (DESIGN.md §3: phone 375–390).
const phone = { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 };

export default defineConfig({
  testDir: "tests/design",
  testMatch: /\.(spec|setup)\.ts$/,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Screenshot baselines are made on Linux in the Playwright image (CI); see tests/design/README.md.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}-{projectName}{ext}",
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "device" } },
  // Clock times are the viewer's local time (WEB-19): one zone, so they read the same on every machine.
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", timezoneId: "Europe/Amsterdam" },
  projects: [
    // The site before the first upload (WEB-29): before `seed` uploads the sample.
    { name: "empty-desktop", testMatch: /\.empty\.ts$/, use: desktop },
    { name: "empty-phone", testMatch: /\.empty\.ts$/, use: phone },
    { name: "seed", testMatch: /seed\.setup\.ts$/, dependencies: ["empty-desktop", "empty-phone"] },
    { name: "desktop", dependencies: ["seed"], use: desktop },
    { name: "phone", dependencies: ["seed"], use: phone },
  ],
  webServer: {
    command: "npm run start",
    env: {
      PORT: String(port),
      HOSTNAME: "localhost",
      DATA_DIR: process.env.DESIGN_DATA_DIR,
      FIXED_NOW: String(NOW),
      AUTH_SECRET: E2E.secret,
      AUTH_URL: `http://localhost:${port}`,
      ADMIN_BATTLETAG: ADMIN,
      AUTH_BATTLENET_ID: "e2e-client-id",
      AUTH_BATTLENET_SECRET: "e2e-client-secret",
    },
    port,
    // Always a fresh server: a reused one would have another database and clock.
    reuseExistingServer: false,
  },
});
