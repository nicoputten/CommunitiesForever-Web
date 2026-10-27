import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import { pollToken, startPairing } from "../e2e/uploaderApi";
import {
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
  TYPE,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-34: design checks of the uploader page (board `uploader-page`): two uploaders (connecting a device name again
// replaces its token, so this is the same every run) and a waiting pairing request. Its code is random: masked.

/** Connects `deviceName` for the signed-in viewer through the page, as a friend would; returns the token. */
async function connect(page: Page, deviceName: string): Promise<string> {
  const started = await startPairing(page.request, deviceName);
  await page.goto(`/uploader?code=${started.user_code}`);
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page).toHaveURL(/notice=allowed/);
  return (await pollToken(page.request, started.device_code)).access_token!;
}

let code = "";

test.beforeEach(async ({ context, baseURL, page }) => {
  await signInAs(context, baseURL!, ADMIN);
  await connect(page, "NICO-LAPTOP");
  const token = await connect(page, "DESKTOP-NICO");
  // Used now: "● active".
  await page.request.get("/api/uploader/v1/me", { headers: { authorization: `Bearer ${token}` } });
  code = (await startPairing(page.request, "DESKTOP-NICO")).user_code;
});

const open = (page: Page) => openScreen(page, `/uploader?code=${code}`);

test("uploader: design values", async ({ page }) => {
  await open(page);
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  const pair = page.getByRole("region", { name: "Connect an uploader?" });
  await expectStyles(pair, { "border-radius": "var(--r-panel)", "border-top-color": "var(--gold)" });
  await expectStyles(pair.getByRole("heading"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-title-lg)",
    color: "var(--text-strong)",
  });
  await expectStyles(pair.getByTestId("pairing-code"), {
    "font-size": "var(--fs-code)",
    "letter-spacing": "var(--ls-code)",
    color: "var(--code-text)",
  });
  await expectStyles(pair.getByRole("button", { name: "Allow" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-btn)",
    "min-height": "var(--size-touch)",
  });
  const yours = page.getByRole("region", { name: "Your uploaders" });
  await expectStyles(yours, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(yours.getByRole("heading", { name: "Your uploaders" }), {
    "font-family": "var(--font-display)",
    "font-size": "var(--fs-name)",
    color: "var(--gold-bright)",
  });
  await expectStyles(yours.getByText("● active"), { color: "var(--fresh-text)" });
  await expectStyles(yours.getByRole("button", { name: "Revoke DESKTOP-NICO" }), {
    color: "var(--stale-text)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(page.getByText("Create a token by hand"), { color: "var(--gold)" });
  const history = page.getByRole("region", { name: "Upload history" });
  await expectStyles(history, { "background-color": "var(--surface-box)", "border-radius": "var(--r-panel)" });
  await expectStyles(history.getByRole("heading", { level: 3 }).first(), {
    "font-size": "var(--fs-meta-sm)",
    color: "var(--text-faint)",
  });
  const row = history.getByTestId("own-upload").first();
  await expectStyles(row, { "border-radius": "var(--r-btn)", "min-height": "var(--size-touch)" });
  await expectStyles(row.getByText("Done"), { color: "var(--fresh-text)", "background-color": "var(--done-tint)" });
  await expectStyles(history.getByRole("button", { name: "All" }), {
    "border-color": "var(--gold)",
    "background-color": "var(--tint-pressed)",
  });
});

test("uploader: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await open(page);
  await expectTouchTargets(page);
});

test("uploader: accessibility", async ({ page }) => {
  await open(page);
  await expectAccessible(page);
});

test("uploader: reduced motion", async ({ page }) => {
  await open(page);
  await expectNoMotion(page);
});

test("uploader: screenshot", async ({ page }) => {
  await open(page);
  await expectScreenshot(page, "uploader", [page.getByTestId("pairing-code")]);
});
