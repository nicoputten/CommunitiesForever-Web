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
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start",
    env: { PORT: String(port), HOSTNAME: "localhost" },
    port,
    reuseExistingServer: !process.env.CI,
  },
});
