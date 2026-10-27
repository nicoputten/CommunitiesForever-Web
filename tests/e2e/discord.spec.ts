import { expect, type Page, test, type TestInfo } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";

// WEB-39: the Discord page against the real server, at desktop and phone size. Each project signs in as its own guest
// for the link and time zone; the admin's settings are changed on desktop only (one settings row for the site).
// Discord is never called: its consent page is answered by the test.

const GUESTS: Record<string, string> = { desktop: "Linker#4301", phone: "Linker#4302" };
const guestOf = (info: TestInfo) => GUESTS[info.project.name] ?? "Linker#4301";

async function openFromBar(page: Page) {
  await page.goto("/roster");
  const discord = page.getByRole("banner").getByRole("link", { name: "Discord" });
  if (await discord.isVisible()) await discord.click();
  else {
    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("link", { name: "Discord" }).click();
  }
  await expect(page).toHaveURL(/\/discord$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Discord");
}

test.describe("a friend", () => {
  test.beforeEach(async ({ context, baseURL, page }, info) => {
    await signInAs(context, baseURL!, E2E.admin);
    const put = await page.request.put("/api/admin/guests", { data: { battleTag: guestOf(info), mayUpload: false } });
    expect(put.ok()).toBe(true);
    await context.clearCookies();
    await signInAs(context, baseURL!, guestOf(info));
  });

  test("opens the Discord page from the top bar or menu, without the admin's settings", async ({ page }) => {
    await openFromBar(page);
    await expect(page.getByRole("heading", { name: "Link your Discord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What the bot posts" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Linked friends" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Bot token" })).toHaveCount(0);
    expect((await page.goto("/discord/recap"))?.status()).toBe(404);
  });

  test("Link Discord asks Discord for identify only, and a forged callback changes nothing", async ({ page }) => {
    let authorize: URL | undefined;
    await page.route("https://discord.com/**", async (route) => {
      authorize = new URL(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Discord</title>" });
    });
    await page.goto("/discord");
    await page.getByRole("button", { name: "Link Discord" }).click();
    await page.waitForURL(/^https:\/\/discord\.com\//);
    await expect.poll(() => authorize?.pathname).toBe("/oauth2/authorize");
    expect(authorize!.searchParams.get("scope")).toBe("identify");
    expect(authorize!.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize!.searchParams.get("redirect_uri")).toMatch(/\/api\/discord\/callback$/);

    // Someone else's state (or none): refused before Discord is asked anything.
    await page.goto("/api/discord/callback?code=abc&state=not-ours");
    await expect(page).toHaveURL(/\/discord\?notice=expired$/);
    await expect(page.getByRole("status")).toContainText("took too long");
    await expect(page.getByRole("heading", { name: "Link your Discord" })).toBeVisible();
  });

  test("says cancelled when the friend says no on Discord", async ({ page }) => {
    let state = "";
    await page.route("https://discord.com/**", async (route) => {
      state = new URL(route.request().url()).searchParams.get("state") ?? "";
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Discord</title>" });
    });
    await page.goto("/discord");
    await page.getByRole("button", { name: "Link Discord" }).click();
    // Wait for the navigation to Discord to finish, so it doesn't interrupt the next one.
    await page.waitForURL(/^https:\/\/discord\.com\//);
    await expect.poll(() => state).not.toBe("");
    await page.goto(`/api/discord/callback?error=access_denied&state=${state}`);
    await expect(page.getByRole("status")).toHaveText("Linking was cancelled. Nothing changed.");
  });

  test("picks a time zone", async ({ page }) => {
    await page.goto("/discord");
    await page.getByLabel("Time zone", { exact: true }).selectOption("Asia/Tokyo");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Your time zone is saved.");
    await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("Asia/Tokyo");
  });

  test("the callback needs a session", async ({ context, page }) => {
    await context.clearCookies();
    const res = await page.request.get("/api/discord/callback?code=abc&state=x", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });
});

test.describe("the admin", () => {
  test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, E2E.admin));

  test("sees the linked friends and changes what the bot posts", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one settings row for the site");
    await page.goto("/discord");
    const friends = page.getByRole("region", { name: "Linked friends" });
    await expect(friends.getByTestId("linked-friend").first()).toBeVisible();
    await expect(friends).toContainText(/\d+ of \d+/);

    const posts = page.getByRole("region", { name: "What the bot posts" });
    const milestones = posts.getByRole("switch", { name: "Milestones" });
    const before = await milestones.getAttribute("aria-checked");
    await milestones.click();
    const after = before === "true" ? "false" : "true";
    await expect(milestones).toHaveAttribute("aria-checked", after);
    await expect(posts.getByLabel("Channel for posts")).toBeDisabled();

    const runs = page.getByRole("region", { name: "Runs" });
    await runs.getByLabel("Reminder time (default for new runs)").selectOption("60");
    await posts.getByLabel("Recap time").selectOption("5|20:00");
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByRole("switch", { name: "Milestones" })).toHaveAttribute("aria-checked", after);
    await expect(page.getByLabel("Reminder time (default for new runs)")).toHaveValue("60");
    await expect(page.getByLabel("Recap time")).toHaveValue("5|20:00");
  });

  test("makes the bot token once, sends a test post the bot gets, and revokes it", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one bot token for the site");
    await page.goto("/discord");
    const card = page.getByRole("region", { name: "Bot token" });
    const make = card.getByRole("button", { name: /^(Create|Replace) token$/ });
    await make.click();
    const shown = card.getByLabel(/won't be shown again/);
    await expect(shown).toHaveValue(/^cfb_/);
    const token = await shown.inputValue();
    await expect(page.getByTestId("bot-status")).toHaveText("Bot not connected");

    // The bot calls with it: online.
    const settings = await page.request.get("/api/bot/v1/settings", { headers: { authorization: `Bearer ${token}` } });
    expect(settings.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId("bot-status")).toHaveText("● Bot online");
    await expect(card.getByLabel(/won't be shown again/)).toHaveCount(0);

    await page.getByRole("button", { name: "Send a test post" }).click();
    await expect(page.getByRole("status")).toContainText("Test post sent");
    const feed = await page.request.get("/api/bot/v1/events?after=0", {
      headers: { authorization: `Bearer ${token}` },
    });
    const { events } = (await feed.json()) as { events: { type: string }[] };
    expect(events.some((e) => e.type === "test")).toBe(true);

    await card.getByRole("button", { name: "Revoke" }).click();
    await card.getByRole("button", { name: "Revoke token" }).click();
    await expect(page.getByRole("status")).toContainText("bot token is revoked");
    await expect(page.getByTestId("bot-status")).toHaveText("Bot not connected");
    const after = await page.request.get("/api/bot/v1/settings", { headers: { authorization: `Bearer ${token}` } });
    expect(after.status()).toBe(401);
  });

  test("picks a channel and a role once the bot reported them (WEB-46)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one bot token and one settings row for the site");
    await page.goto("/discord");
    const card = page.getByRole("region", { name: "Bot token" });
    await card.getByRole("button", { name: /^(Create|Replace) token$/ }).click();
    const token = await card.getByLabel(/won't be shown again/).inputValue();
    const sent = await page.request.post("/api/bot/v1/guild", {
      headers: { authorization: `Bearer ${token}` },
      data: {
        channels: [
          { id: "80351110224678912", name: "general" },
          { id: "80351110224678913", name: "runs" },
        ],
        roles: [{ id: "80351110224678920", name: "Raiders" }],
      },
    });
    expect(sent.ok()).toBe(true);

    await page.reload();
    const posts = page.getByLabel("Channel for posts");
    await expect(posts).toBeEnabled();
    await expect(page.getByText(/^From the bot, /)).toBeVisible();
    await posts.selectOption({ label: "# general" });
    await page.getByLabel("Mention on new runs").selectOption({ label: "@Raiders" });
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByLabel("Channel for posts")).toHaveValue("80351110224678912");
    await expect(page.getByLabel("Mention on new runs")).toHaveValue("80351110224678920");

    // The channel goes away on Discord: the pick stays, marked removed.
    await page.request.post("/api/bot/v1/guild", {
      headers: { authorization: `Bearer ${token}` },
      data: { channels: [{ id: "80351110224678913", name: "runs" }], roles: [] },
    });
    await page.reload();
    await expect(page.getByLabel("Channel for posts").locator("option:checked")).toHaveText("(removed: # general)");
  });

  test("previews the coming weekly recap (WEB-41c)", async ({ page }) => {
    await page.goto("/discord");
    await page.getByRole("link", { name: "Preview next recap" }).click();
    await expect(page).toHaveURL(/\/discord\/recap$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Next recap");
    await expect(page.getByText(/^Week \d+ · /)).toBeVisible();
    await expect(page.getByRole("region", { name: "This week's challenge" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Discord" }).click();
    await expect(page).toHaveURL(/\/discord$/);
  });
});
