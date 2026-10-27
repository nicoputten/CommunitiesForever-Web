import { createHash } from "node:crypto";
import { expect, test, type TestInfo } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";
import { pollToken, startPairing } from "./uploaderApi";

// WEB-34: the uploader page against the real server, at desktop and phone size. Each project signs in as its own
// guest with "may upload", so the two don't see each other's uploaders.

const GUESTS: Record<string, string> = { desktop: "Uploader#4201", phone: "Uploader#4202" };
const guestOf = (info: TestInfo) => GUESTS[info.project.name] ?? "Uploader#4201";
const device = (info: TestInfo, what: string) => `E2E-${info.project.name}-${what}-${Date.now()}`;

test.beforeEach(async ({ context, baseURL, page }, info) => {
  await signInAs(context, baseURL!, E2E.admin);
  const put = await page.request.put("/api/admin/guests", { data: { battleTag: guestOf(info), mayUpload: true } });
  expect(put.ok()).toBe(true);
  await context.clearCookies();
  await signInAs(context, baseURL!, guestOf(info));
});

test("the top bar's Uploader opens the page, which links to the manual upload", async ({ page }) => {
  await page.goto("/roster");
  const header = page.getByRole("banner");
  const uploader = header.getByRole("link", { name: "Uploader" });
  if (await uploader.isVisible()) await uploader.click();
  else {
    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("link", { name: "Uploader" }).click();
  }
  await expect(page).toHaveURL(/\/uploader$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Automatic uploader");
  await page.getByRole("link", { name: "Upload manually" }).click();
  await expect(page).toHaveURL(/\/upload$/);
});

test("your upload history filters by source and opens a report", async ({ context, baseURL, page }) => {
  // The admin has the seed's manual uploads.
  await context.clearCookies();
  await signInAs(context, baseURL!, E2E.admin);
  await page.goto("/uploader");
  const history = page.getByRole("region", { name: "Upload history" });
  const rows = history.getByTestId("own-upload");
  await expect(rows.first()).toContainText("Manual upload");
  await expect(history.getByRole("heading", { level: 3 }).first()).toHaveText(/Today|This week|Earlier/);

  await history.getByRole("button", { name: "Problems" }).click();
  await expect(page).toHaveURL(/show=problems/);
  await history.getByRole("button", { name: "Manual" }).click();
  await expect(page).toHaveURL(/show=manual/);
  await page.goBack();
  await expect(page).toHaveURL(/show=problems/);
  await history.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\/uploader$/);

  await rows.first().click();
  await expect(page).toHaveURL(/\/upload\/\d+$/);
});

test("allowing a connection gives the app its token", async ({ page }, info) => {
  const name = device(info, "allow");
  const started = await startPairing(page.request, name);
  await page.goto(`/uploader?code=${started.user_code}`);
  const request = page.getByRole("region", { name: "Connect an uploader?" });
  await expect(request).toContainText(name);
  await expect(request.getByTestId("pairing-code")).toHaveText(started.user_code);
  await request.getByRole("button", { name: "Allow" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Connected." })).toBeVisible();
  await expect(page).toHaveURL(/\/uploader\?notice=allowed$/);
  const token = await pollToken(page.request, started.device_code);
  expect(token.access_token).toMatch(/^cfu_/);
  const me = await page.request.get("/api/uploader/v1/me", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  expect(await me.json()).toMatchObject({ battleTag: guestOf(info), deviceName: name });

  await page.reload();
  const row = page.getByTestId("uploader").filter({ hasText: name });
  await expect(row).toContainText("Connected today");
  await expect(row).toContainText("● active");
});

test("denying tells the app, and a wrong code says so", async ({ page }, info) => {
  const started = await startPairing(page.request, device(info, "deny"));
  await page.goto(`/uploader?code=${started.user_code}`);
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Denied." })).toBeVisible();
  expect((await pollToken(page.request, started.device_code)).error).toBe("access_denied");

  await page.goto(`/uploader?code=${started.user_code}`);
  await expect(page.getByRole("status").filter({ hasText: "This code doesn't work anymore." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Connect an uploader?" })).toHaveCount(0);
});

test("a token by hand is shown once and can be revoked", async ({ page }, info) => {
  const name = device(info, "hand");
  await page.goto("/uploader");
  await page.getByText("Create a token by hand").click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create token" }).click();
  const token = page.getByLabel(/Copy it now/);
  await expect(token).toHaveValue(/^cfu_[A-Za-z0-9_-]{43}$/);
  const secret = await token.inputValue();

  const row = page.getByTestId("uploader").filter({ hasText: name });
  await expect(row).toContainText("no uploads yet");
  await row.getByRole("button", { name: `Revoke ${name}` }).click();
  await row.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(page.getByTestId("uploader").filter({ hasText: name })).toHaveCount(0);

  const me = await page.request.get("/api/uploader/v1/me", { headers: { authorization: `Bearer ${secret}` } });
  expect(me.status()).toBe(401);
  await page.reload();
  await expect(page.getByLabel(/Copy it now/)).toHaveCount(0);
});

test("a published release turns on Download for Windows", async ({ page }) => {
  // Each run and project publishes a newer version: the site refuses an older one.
  const version = `1.0.${Date.now()}${Math.floor(Math.random() * 10)}`;
  const id = "CommunitiesForever.Upload";
  const pkg = Buffer.from(`package ${version}`);
  const feed = JSON.stringify({
    Assets: [
      {
        PackageId: id,
        Version: version,
        Type: "Full",
        FileName: `${id}-${version}-full.nupkg`,
        SHA256: createHash("sha256").update(pkg).digest("hex"),
        Size: pkg.length,
      },
    ],
  });
  const published = await page.request.post("/api/uploader/v1/releases", {
    headers: { authorization: `Bearer ${E2E.deploySecret}` },
    multipart: {
      setup: { name: `${id}-win-Setup.exe`, mimeType: "application/octet-stream", buffer: Buffer.from("setup") },
      full: { name: `${id}-${version}-full.nupkg`, mimeType: "application/octet-stream", buffer: pkg },
      feed: { name: "releases.win.json", mimeType: "application/json", buffer: Buffer.from(feed) },
    },
  });
  // The other project may have published a newer one at the same moment (409): either way there is a release.
  expect([201, 409]).toContain(published.status());

  await page.goto("/uploader");
  const button = page.getByRole("link", { name: "Download for Windows" });
  await expect(button).toHaveAttribute("href", "/uploader/download");
  await expect(page.getByText(/· Windows 10 and 11 · about 1 MB$/)).toBeVisible();
  const download = page.waitForEvent("download");
  await button.click();
  expect((await download).suggestedFilename()).toBe("CommunitiesForever-Uploader-Setup.exe");
});
