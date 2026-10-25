import { defineConfig, devices } from "@playwright/test";

const port = 3100;

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
    // DEV_VIEWER: the signed-in admin until WEB-06 replaces the stub (src/app/viewer.ts).
    env: { PORT: String(port), HOSTNAME: "localhost", DEV_VIEWER: "Nico#2201:admin" },
    port,
    reuseExistingServer: !process.env.CI,
  },
});
