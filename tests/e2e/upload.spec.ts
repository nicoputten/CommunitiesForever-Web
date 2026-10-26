import { readFileSync } from "node:fs";
import { expect, type Page, test, type TestInfo } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { expectTouchTargets, isPhone } from "../design/checks";
import { signInAs } from "./session";

// WEB-19: the upload page against the real server, at desktop and phone size. The e2e database lives on between
// runs and both projects share it, so every file that should be new is made unique per run, and each project
// uploads as its own member: the admin's own newest record is the truth for the admin's characters (merge rule), so
// two projects uploading admin files at once would hide each other's characters.

const LEDGER = "CommunitiesForever.lua";
const zone = (page: Page) => page.locator("[data-state]");
/** The zone's visible text, without the status region that reads the same words out. */
const shown = (page: Page) => zone(page).locator(":scope > p:not([role=status])");

const MEMBERS: Record<string, string> = { desktop: "Desktop#4101", phone: "Phone#4102" };
const memberOf = (info: TestInfo) => MEMBERS[info.project.name] ?? "Desktop#4101";

/** The admin's file that names the members, in the e2e community (the same bytes every run: a no-op again). */
const ADMIN_FILE = Buffer.from(`CommunitiesForeverDB = { global = { schemaVersion = 1,
  settings = { clubId = 77, clubName = "E2E Club" },
  self = { battleTag = "${E2E.admin}", version = 1000, chars = {} },
  people = { ["Desktop#4101"] = { version = 1 }, ["Phone#4102"] = { version = 1 } } } }`);

let version = Date.now();

/** A member's own file with one new character, so the upload changes something. Versions only go up. */
function ownFile(battleTag: string): Buffer {
  version = Math.max(version + 1, Date.now());
  const id = `${version}${Math.floor(Math.random() * 1e6)}`;
  return Buffer.from(`CommunitiesForeverDB = { global = { schemaVersion = 1,
    settings = { clubId = 77, clubName = "E2E Club" },
    self = { battleTag = "${battleTag}", version = ${version}, chars = {
      ["Player-1-${id}"] = { name = "E2E Character", level = 12, classFile = "MAGE", updatedAt = ${version} } } } } }`);
}

async function choose(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer });
}

test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await signInAs(context, baseURL!, E2E.admin);
  const res = await context.request.post("/api/uploads", {
    multipart: { file: { name: LEDGER, mimeType: "text/plain", buffer: ADMIN_FILE } },
  });
  expect(await res.json()).toMatchObject({ status: "ok" });
  await context.close();
});

test.describe("upload page, as a member", () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    await signInAs(context, baseURL!, memberOf(info));
  });

  test("uploads a file, shows its report and the history line", async ({ page }, info) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload the ledger");
    await expect(page.getByText("WTF › Account › [ACCOUNT] › SavedVariables")).toBeVisible();
    await expect(page.getByText(/type \/reload\. Upload after that/)).toBeVisible();

    await choose(page, LEDGER, ownFile(memberOf(info)));
    await expect(page).toHaveURL(/\/upload\/\d+$/);
    const id = page.url().split("/").pop();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Session report");
    await expect(page.getByRole("listitem").filter({ hasText: /^1 new character$/ })).toBeVisible();

    await page.getByRole("link", { name: "Upload another" }).click();
    // Both projects upload at once, so the line is found by its report link.
    const line = page.locator(`[data-testid="history-line"][href="/upload/${id}"]`);
    await expect(line).toContainText("Done");
    await expect(line).toContainText(/Today \d\d:\d\d/);
    await expect(line).toContainText(memberOf(info).split("#")[0]!);
    await expect(line).toContainText("1 new character");
  });

  test("the Choose file button opens the file picker, from the keyboard too", async ({ page }) => {
    await page.goto("/upload");
    const button = page.getByRole("button", { name: "Choose file" });
    await button.focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    await chooser;
  });

  test("wrong file: names the other addon's file and changes nothing", async ({ page }, info) => {
    await page.goto("/upload");
    await choose(page, "Questie.lua", Buffer.from(`QuestieConfig = { global = { version = ${Date.now()} } }`));
    await expect(zone(page)).toHaveAttribute("data-state", "wrong-file");
    await expect(zone(page).getByText("That's not our ledger", { exact: true })).toBeVisible();
    await expect(
      shown(page).getByText(/another addon \(Questie\.lua\)\. Pick the file named CommunitiesForever\.lua\./),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText("That's not our ledger");
    // Focus moves to the result's action, which replaced the button that was used.
    await expect(page.getByRole("button", { name: "Choose another file" })).toBeFocused();
    // The refused file is in the history, under its uploader.
    const refused = page
      .getByTestId("history-line")
      .filter({ hasText: "Wrong file: another addon's data" })
      .filter({ hasText: memberOf(info).split("#")[0]! });
    await expect(refused.first()).toContainText("Rejected");
  });

  test("nothing new: the same file again says when it came before", async ({ page }, info) => {
    const file = ownFile(memberOf(info));
    await page.goto("/upload");
    await choose(page, LEDGER, file);
    await expect(page).toHaveURL(/\/upload\/\d+$/);
    await page.goto("/upload");
    await choose(page, LEDGER, file);
    await expect(zone(page)).toHaveAttribute("data-state", "nothing-new");
    await expect(zone(page).getByText("The ledger hasn't changed", { exact: true })).toBeVisible();
    await expect(
      shown(page).getByText(/same data as your upload of today \d\d:\d\d\. Did the game save yet\?/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("not your file: names whose ledger it is", async ({ page }) => {
    await page.goto("/upload");
    // The addon's golden fixture belongs to Ada#1001.
    await choose(page, LEDGER, readFileSync(new URL("../fixtures/addon/v0.4/savedvariables.lua", import.meta.url)));
    await expect(zone(page)).toHaveAttribute("data-state", "not-your-file");
    await expect(zone(page).getByText("This is someone else's ledger", { exact: true })).toBeVisible();
    await expect(
      shown(page).getByText("It belongs to Ada#1001. Sign in as Ada#1001 to upload it. Nothing was changed."),
    ).toBeVisible();
  });

  test("a file over 25 MiB is refused in the browser", async ({ page }) => {
    await page.goto("/upload");
    let sent = false;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/uploads")) sent = true;
    });
    await choose(page, LEDGER, Buffer.alloc(25 * 1024 * 1024 + 1, 32));
    await expect(zone(page).getByText("That file is too big", { exact: true })).toBeVisible();
    expect(sent).toBe(false);
  });

  test("the whole page takes a dropped file", async ({ page }) => {
    test.skip(isPhone(page), "phones don't drag files");
    await page.goto("/upload");
    const data = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["QuestieConfig = {}"], "Questie.lua", { type: "text/plain" }));
      return dt;
    });
    await page.dispatchEvent("footer", "dragenter", { dataTransfer: data });
    await expect(zone(page)).toHaveAttribute("data-state", "dragging");
    await expect(zone(page).getByText("Let go to upload", { exact: true })).toBeVisible();
    await page.dispatchEvent("footer", "drop", { dataTransfer: data });
    await expect(zone(page)).toHaveAttribute("data-state", "wrong-file");
  });

  test("touch targets are 44 px on phone", async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await page.goto("/upload");
    await expectTouchTargets(page);
  });
});

test.describe("who may upload", () => {
  test("a guest without 'may upload' gets no upload page and no upload", async ({ context, baseURL, page }) => {
    await signInAs(context, baseURL!, E2E.admin);
    const guest = "Viewer#3003";
    expect((await page.request.put("/api/admin/guests", { data: { battleTag: guest, mayUpload: false } })).ok()).toBe(
      true,
    );
    await context.clearCookies();
    await signInAs(context, baseURL!, guest);
    expect((await page.goto("/upload"))?.status()).toBe(404);
    // Anyone signed in may read a session report (WEB-20), but only someone who may upload gets "Upload another".
    expect((await page.goto("/upload/1"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Session report");
    await expect(page.getByRole("link", { name: "Upload another" })).toHaveCount(0);
    const res = await page.request.post("/api/uploads", {
      multipart: { file: { name: LEDGER, mimeType: "text/plain", buffer: Buffer.from("return {}") } },
    });
    expect(res.status()).toBe(403);
  });
});
