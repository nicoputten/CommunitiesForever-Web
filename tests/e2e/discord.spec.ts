import { expect, type Locator, type Page, test, type TestInfo } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { signInAs } from "./session";
import { pick } from "./dropdown";

// WEB-39, reorganised in WEB-58 (boards `discord-page*`): the Discord page against the real server, at desktop and
// phone size. Each project signs in as its own guest
// for the link and time zone; the admin's settings are changed on desktop only (one settings row for the site).
// Discord is never called: its consent page is answered by the test.

const GUESTS: Record<string, string> = { desktop: "Linker#4301", phone: "Linker#4302" };
const guestOf = (info: TestInfo) => GUESTS[info.project.name] ?? "Linker#4301";

/** Picks an option of a setting and waits until the site saved it (the server action's answer). */
async function pickSaved(page: Page, trigger: Locator, option: string): Promise<void> {
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/discord"));
  await pick(page, trigger, option);
  await saved;
}

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
    await expect(page.getByRole("heading", { name: "Your Discord" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Link your Discord" })).toBeVisible();
    for (const box of ["The bot", "Feats", "Weekly recap", "Runs", "Doomsday", "Linked friends"]) {
      await expect(page.getByRole("heading", { name: box, exact: true })).toHaveCount(0);
    }
    // The jump bar: only the friend's two sections.
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link")).toHaveCount(2);
    await expect(page.getByText(/is set by the admin/)).toBeVisible();
    expect((await page.goto("/discord/recap"))?.status()).toBe(404);
  });

  test("Link Discord asks Discord for identify only, and a forged callback changes nothing", async ({ page }) => {
    let authorize: URL | undefined;
    await page.route("https://discord.com/**", async (route) => {
      authorize = new URL(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Discord</title>" });
    });
    await page.goto("/discord");
    await page.getByRole("button", { name: "Link your Discord" }).click();
    await page.waitForURL(/^https:\/\/discord\.com\//);
    await expect.poll(() => authorize?.pathname).toBe("/oauth2/authorize");
    expect(authorize!.searchParams.get("scope")).toBe("identify");
    expect(authorize!.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize!.searchParams.get("redirect_uri")).toMatch(/\/api\/discord\/callback$/);

    // Someone else's state (or none): refused before Discord is asked anything.
    await page.goto("/api/discord/callback?code=abc&state=not-ours");
    await expect(page).toHaveURL(/\/discord\?notice=expired$/);
    await expect(page.getByRole("status")).toContainText("took too long");
    await expect(page.getByRole("button", { name: "Link your Discord" })).toBeVisible();
  });

  test("says cancelled when the friend says no on Discord", async ({ page }) => {
    let state = "";
    await page.route("https://discord.com/**", async (route) => {
      state = new URL(route.request().url()).searchParams.get("state") ?? "";
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Discord</title>" });
    });
    await page.goto("/discord");
    await page.getByRole("button", { name: "Link your Discord" }).click();
    // Wait for the navigation to Discord to finish, so it doesn't interrupt the next one.
    await page.waitForURL(/^https:\/\/discord\.com\//);
    await expect.poll(() => state).not.toBe("");
    await page.goto(`/api/discord/callback?error=access_denied&state=${state}`);
    await expect(page.getByRole("status")).toHaveText("Linking was cancelled. Nothing changed.");
  });

  test("picks a time zone", async ({ page }) => {
    await page.goto("/discord");
    const zone = page.getByRole("region", { name: "Your time zone" });
    await pick(page, zone.getByLabel("Your time zone", { exact: true }), "Tokyo");
    await zone.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Your time zone is saved.");
    await expect(page.getByRole("region", { name: "Your time zone" }).getByLabel("Your time zone")).toContainText(
      "Tokyo",
    );
  });

  test("the callback needs a session", async ({ context, page }) => {
    await context.clearCookies();
    const res = await page.request.get("/api/discord/callback?code=abc&state=x", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });
});

test.describe("the admin", () => {
  test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, E2E.admin));

  test("sees the linked friends and changes each kind of post in its own box", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one settings row for the site");
    await page.goto("/discord");
    const friends = page.getByRole("region", { name: "Linked friends" });
    await expect(friends.getByTestId("linked-friend").first()).toBeVisible();
    await expect(friends).toContainText(/\d+ of \d+/);

    const feats = page.getByRole("region", { name: "Feats" });
    const post = feats.getByRole("switch", { name: "Post feats" });
    const before = await post.getAttribute("aria-checked");
    const switched = page.waitForResponse((r) => r.request().method() === "POST");
    await post.click();
    await switched;
    const after = before === "true" ? "false" : "true";
    await expect(post).toHaveAttribute("aria-checked", after);
    await expect(page.getByLabel("Default channel")).toBeDisabled();

    const runs = page.getByRole("region", { name: "Runs" });
    await expect(runs.getByRole("switch", { name: "Post runs" })).toBeVisible();
    await pickSaved(page, runs.getByLabel("Reminder time"), "1 hour before");
    const recap = page.getByRole("region", { name: "Weekly recap" });
    await pickSaved(page, recap.getByLabel("Day and time"), "Friday · 20:00");

    await page.reload();
    await expect(page.getByRole("switch", { name: "Post feats" })).toHaveAttribute("aria-checked", after);
    await expect(page.getByLabel("Reminder time")).toHaveText(/1 hour before/);
    await expect(page.getByLabel("Day and time")).toHaveText(/Friday · 20:00/);
  });

  test("Doomsday: the posts start off, and a reset change waits for the next reset (with Undo)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "one settings row for the site");
    await page.goto("/discord");
    const doomsday = page.getByRole("region", { name: /^Doomsday/ });
    await expect(doomsday.getByRole("switch", { name: "Daily board" })).toHaveAttribute("aria-checked", "false");
    await expect(doomsday.getByRole("switch", { name: "Weekly ladder" })).toHaveAttribute("aria-checked", "false");

    const hour = doomsday.getByLabel("Reset hour, realm time");
    await expect(hour).toHaveValue("19");
    await hour.fill("21");
    await hour.blur();
    await expect(doomsday.getByText(/^From the next reset: \w{3} 21:00$/)).toBeVisible();
    await expect(doomsday.getByText("Today still ends at 19:00, so nobody loses a half-done day.")).toBeVisible();
    await doomsday.getByRole("button", { name: "Undo" }).click();
    await expect(doomsday.getByText(/^From the next reset/)).toHaveCount(0);
    await expect(doomsday.getByLabel("Reset hour, realm time")).toHaveValue("19");
  });

  test("makes the bot token once, sends a test post per kind the bot gets, and revokes it", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one bot token for the site");
    await page.goto("/discord");
    const bot = page.getByRole("region", { name: "The bot" });
    // Without a token the test buttons wait, with the reason next to them.
    if (await bot.getByRole("button", { name: "Create bot token" }).isVisible()) {
      await expect(page.getByRole("button", { name: "Send a test feat" })).toBeDisabled();
      await expect(page.getByText("Create a bot token first").first()).toBeVisible();
    }
    await bot.getByRole("button", { name: /^(Create bot token|Replace)$/ }).click();
    const shown = bot.getByLabel("Your new bot token · shown once");
    await expect(shown).toHaveValue(/^cfb_/);
    const token = await shown.inputValue();
    await expect(page.getByTestId("bot-status")).toHaveText("Bot not connected");

    // The bot calls with it: online.
    const settings = await page.request.get("/api/bot/v1/settings", { headers: { authorization: `Bearer ${token}` } });
    expect(settings.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId("bot-status")).toHaveText("● Bot online");
    await expect(bot.getByLabel("Your new bot token · shown once")).toHaveCount(0);

    for (const name of ["Send a test feat", "Send a test recap", "Send a test board"]) {
      await page.getByRole("button", { name }).click();
      await expect(page).toHaveURL(/notice=test-sent/);
      await expect(page.getByRole("status")).toContainText("Test post sent");
    }
    // Every page of the feed (50 events each, oldest first): the upload tests' feats may come before the test posts.
    // A page that isn't full is the last (asking past it would long-poll).
    const kinds = async () => {
      const all: { type: string; data: { kind?: string } }[] = [];
      for (let after = "0"; ;) {
        const feed = await page.request.get(`/api/bot/v1/events?after=${after}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const answer = (await feed.json()) as { events: { type: string; data: { kind?: string } }[]; cursor: string };
        all.push(...answer.events);
        if (answer.events.length < 50) break;
        after = answer.cursor;
      }
      return all.filter((e) => e.type === "test").map((e) => e.data.kind);
    };
    await expect.poll(kinds).toEqual(expect.arrayContaining(["feats", "recap", "doomsday"]));

    await bot.getByRole("button", { name: "Revoke" }).click();
    await bot.getByRole("button", { name: "Revoke token" }).click();
    await expect(page.getByRole("status")).toContainText("bot token is revoked");
    await expect(page.getByTestId("bot-status")).toHaveText("Bot not connected");
    const after = await page.request.get("/api/bot/v1/settings", { headers: { authorization: `Bearer ${token}` } });
    expect(after.status()).toBe(401);
  });

  test("picks channels and a role once the bot reported them (WEB-46)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one bot token and one settings row for the site");
    await page.goto("/discord");
    const bot = page.getByRole("region", { name: "The bot" });
    await bot.getByRole("button", { name: /^(Create bot token|Replace)$/ }).click();
    const token = await bot.getByLabel("Your new bot token · shown once").inputValue();
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
    const fallback = page.getByLabel("Default channel");
    await expect(fallback).toBeEnabled();
    await pickSaved(page, fallback, "# general");
    await page.reload();
    // Each box starts at the default channel.
    await expect(page.getByLabel("Feats channel")).toHaveText(/Default · # general/);
    await pickSaved(page, page.getByLabel("Runs channel"), "# runs");
    await pickSaved(page, page.getByLabel("Mention on new runs"), "@Raiders");
    await page.reload();
    await expect(page.getByLabel("Default channel")).toHaveText(/# general/);
    await expect(page.getByLabel("Runs channel")).toHaveText(/# runs/);
    await expect(page.getByLabel("Mention on new runs")).toHaveText(/@Raiders/);

    // The channel goes away on Discord: the pick stays, marked removed.
    await page.request.post("/api/bot/v1/guild", {
      headers: { authorization: `Bearer ${token}` },
      data: { channels: [{ id: "80351110224678913", name: "runs" }], roles: [] },
    });
    await page.reload();
    await expect(page.getByLabel("Default channel")).toHaveText(/\(removed: # general\)/);
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

  test("the bot gets card images from the production server (WEB-41d)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one bot token for the site");
    await page.goto("/discord");
    const bot = page.getByRole("region", { name: "The bot" });
    await bot.getByRole("button", { name: /^(Create bot token|Replace)$/ }).click();
    const token = await bot.getByLabel("Your new bot token · shown once").inputValue();
    const headers = { authorization: `Bearer ${token}` };
    // Ves Doombringer of the sample, seen in a zone the map draws.
    const res = await page.request.get("/api/bot/v1/cards/whereis-Player-1-0000A001.png", { headers });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).subarray(1, 4).toString("latin1")).toBe("PNG");
    expect((await page.request.get("/api/bot/v1/cards/whereis-Player-1-0000A001.png")).status()).toBe(401);
  });
});
