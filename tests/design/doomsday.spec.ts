import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  TYPE,
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
} from "./checks";
import { ADMIN } from "./sample";

// WEB-59..61: design checks of the Doomsday page (boards doomsday-today, -ladder, -feats, -phone) on what the engine
// (WEB-58) computes from the design sample's uploads (sampleDoomsday.ts, WEB-63). "Now" is fixed, so the day's draw
// and the numbers below are too: Nico's goals today, Femke with the crown and no kill ever, Ves's first epic.

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

const TABS = [
  { name: "today", url: "/doomsday" },
  { name: "week", url: "/doomsday/week" },
  { name: "board", url: "/doomsday/board" },
  // WEB-60: boards doomsday-ladder and doomsday-feats.
  { name: "ladder", url: "/doomsday/ladder" },
  { name: "ladder-all", url: "/doomsday/ladder?scope=all" },
  { name: "pvp", url: "/doomsday/pvp" },
  { name: "feats", url: "/doomsday/feats" },
  // WEB-61: the phone ladder's PvP track and the states (board doomsday-phone) on /dev/doomsday.
  { name: "ladder-pvp", url: "/doomsday/ladder?track=pvp" },
  { name: "state-first-day", url: "/dev/doomsday?state=first-day" },
  { name: "state-only-you", url: "/dev/doomsday?state=only-you" },
  { name: "state-loading", url: "/dev/doomsday?state=loading" },
  { name: "state-error", url: "/dev/doomsday?state=error" },
];

test("doomsday phone: design values", async ({ page }) => {
  test.skip(!isPhone(page), "the phone layout");
  await openScreen(page, "/doomsday");
  // The day's points and the reset under the tabs; the header's stat cards are desktop only.
  await expect(page.getByText("This week", { exact: true }).first()).toBeHidden();
  await expectStyles(page.getByText(/^resets in /).first(), { color: "var(--streak-text)" });
  await expectStyles(page.getByTestId("goal").first(), { "min-height": "var(--size-goal-row)" });
  // The board as one card per friend, with a mark per goal.
  await expect(page.getByRole("region", { name: "The board", exact: true })).toBeHidden();
  const card = page.getByTestId("board-card").first();
  await expectStyles(card, { "background-color": "var(--surface-goal)", "border-radius": "var(--r-card)" });
  const done = card.getByRole("img", { name: /: done \d\d:\d\d/ }).first();
  await expectStyles(done, {
    "min-width": "var(--size-mark)",
    height: "var(--size-mark)",
    "background-color": "var(--mark-pve)",
    color: "var(--pve-text)",
  });
  // The ladder: one track at a time with a PvE | PvP switch.
  await openScreen(page, "/doomsday/ladder");
  await expect(page.getByRole("region", { name: /^PvE · this week/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /^PvP · this week/ })).toBeHidden();
  await expectStyles(page.getByRole("navigation", { name: "Track" }).getByRole("link", { name: "PvE" }), {
    "background-color": "var(--tint-selected)",
    "min-height": "var(--size-touch)",
  });
});

test("doomsday states: design values", async ({ page }) => {
  await openScreen(page, "/dev/doomsday?state=first-day");
  await expectStyles(page.getByRole("heading", { name: "Day one of Doomsday" }), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-title-lg)",
    color: "var(--text-strong)",
  });
  await expect(page.getByText("Nobody has done anything yet.")).toBeVisible();
  await openScreen(page, "/dev/doomsday?state=error");
  await expectStyles(page.getByRole("button", { name: "Try again" }), {
    color: "var(--stale-text)",
    "min-height": "var(--size-touch)",
  });
  await openScreen(page, "/dev/doomsday?state=loading");
  await expect(page.getByText("Loading today’s goals…")).toBeVisible();
});

test("doomsday ladder: design values", async ({ page }) => {
  // The PvP track, so the phone (one track at a time) shows it too.
  await openScreen(page, "/doomsday/ladder?track=pvp");
  await expectStyles(page.getByRole("navigation", { name: "Ladder period" }).getByRole("link", { name: "This week" }), {
    "border-color": "var(--gold)",
    "background-color": "var(--tint-pressed)",
  });
  const pvp = page.getByRole("region", { name: /^PvP · this week/ });
  await expectStyles(pvp.locator("summary").first().locator("span").first(), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-ladder-place)",
    color: "var(--gold-pale)",
  });
  await expectStyles(pvp.getByText("– 0", { exact: true }), { color: "var(--text-faint)" });
  await expectStyles(pvp.getByText("PvP Virgin"), { color: "var(--swap-text)", "background-color": "var(--virgin-tint)" });
  // Movement up and down: the PvE ladder this week.
  await openScreen(page, "/doomsday/ladder");
  const pve = page.getByRole("region", { name: /^PvE · this week/ });
  await expectStyles(pve.getByText(/^▲ \d/), { color: "var(--pve-text)" });
  await expectStyles(pve.getByText(/^▼ \d/), { color: "var(--pvp-text)" });
});

test("doomsday pvp: design values", async ({ page }) => {
  await openScreen(page, "/doomsday/pvp");
  await expectStyles(page.getByRole("heading", { name: /^PvP details · / }), { ...TYPE.title, color: "var(--gold-bright)" });
  await expectStyles(page.getByText("Stone Guard · rank 6"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-name)",
  });
  await expectStyles(page.getByText("Mailbox Menace"), { color: "var(--gold-pale)" });
  const grid = page.getByRole("table");
  await expectStyles(grid.getByRole("cell", { name: "1–0" }), { color: "var(--pve-text)" });
  await expectStyles(grid.getByRole("cell", { name: "0–1" }), { color: "var(--pvp-text)", "white-space": "nowrap" });
  // WEB-65, bug 7: named corner, "—" against yourself, "·" without duels, fits its card without a scroll box.
  await expect(grid.getByRole("columnheader", { name: "row vs column" })).toBeVisible();
  await expectStyles(grid.locator('td[data-empty="self"]').first(), { color: "var(--duel-self)" });
  const wrap = page.getByRole("region", { name: "Duels between friends" });
  expect(await wrap.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByText(/^Read across: .+ beat .+ \d+–\d+\.$/)).toBeVisible();
  await expectStyles(page.getByText("1,016"), { "font-family": "var(--font-name)", color: "var(--gold-pale)" });
  await expectStyles(page.getByRole("region", { name: "Battlegrounds" }), { "border-style": "dashed" });
});

test("doomsday feats: design values", async ({ page }) => {
  await openScreen(page, "/doomsday/feats");
  const feat = page.getByTestId("feat").filter({ hasText: "First epic" });
  await expectStyles(feat, { "background-color": "var(--surface-goal)", "border-color": "var(--line-goal)" });
  await expectStyles(feat.getByText("Robes of the Exalted"), { color: "var(--epic)" });
  await expectStyles(feat.getByText("First in the group"), {
    color: "var(--gold-pale)",
    "background-color": "var(--first-tint)",
  });
  await expectStyles(page.getByText("132 / 1,000"), { ...TYPE.meta, color: "var(--text-dim)" });
});

test("doomsday: design values", async ({ page }) => {
  await openScreen(page, "/doomsday");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByRole("heading", { name: /^Your goals ·/ }), {
    ...TYPE.title,
    color: "var(--gold-bright)",
  });
  const tabs = page.getByRole("navigation", { name: "Doomsday" });
  await expectStyles(tabs.getByRole("link", { name: "Today" }), {
    "font-family": "var(--font-display)",
    color: "var(--gold-pale)",
    "min-height": "var(--size-touch)",
  });
  await expectStyles(tabs.getByRole("link", { name: "Week" }), { color: "var(--text-dim)" });

  const goal = page.getByTestId("goal").filter({ hasText: "Finish 5 quests in one zone" });
  await expectStyles(goal, { "background-color": "var(--surface-goal)", "border-color": "var(--line-goal-done)" });
  await expectStyles(goal.getByText("PvE daily"), { ...TYPE.overline, "font-weight": "var(--fw-semibold)", color: "var(--pve-text)" });
  await expectStyles(goal.getByText("Finish 5 quests in one zone"), {
    "font-family": "var(--font-name)",
    "font-size": isPhone(page) ? "var(--fs-name-sm)" : "var(--fs-section)",
    color: "var(--text-muted)",
  });
  const open = page.getByTestId("goal").filter({ hasText: "Front line" });
  await expectStyles(open.getByText("PvP · Skirmish"), { color: "var(--pvp-text)" });
  await expectStyles(open.getByText("1 / 5"), { ...DATA, color: "var(--text)" });
  await expectStyles(page.getByText(/^resets in /), { "font-size": "var(--fs-body-sm)", color: "var(--streak-text)" });

  // The phone shows the board as cards (WEB-61, "doomsday phone: design values").
  if (isPhone(page)) return;
  const board = page.getByRole("table");
  await expectStyles(board.getByRole("columnheader", { name: "Friend" }), {
    ...TYPE.overline,
    "font-weight": "var(--fw-semibold)",
    color: "var(--text-faint)",
  });
  await expectStyles(board.getByText("PvP Virgin"), {
    color: "var(--swap-text)",
    "background-color": "var(--virgin-tint)",
    "border-color": "var(--virgin-line)",
  });
  await expectStyles(board.getByText(/first · \d/), {
    color: "var(--gold-pale)",
    "background-color": "var(--first-tint)",
  });
});

test("doomsday: week and heatmap design values", async ({ page }) => {
  await openScreen(page, "/doomsday/week");
  await expectStyles(page.getByTestId("goal").getByText("PvP bounty"), {
    color: "var(--pvp-text)",
  });
  await openScreen(page, "/doomsday/board");
  const heat = page.getByRole("img", { name: /goals per day over 12 weeks/ }).first();
  await expect(heat.locator("span")).toHaveCount(84);
  await expectStyles(heat.locator("span").first(), {
    width: "var(--size-heat)",
    "border-radius": "var(--r-heat)",
    "background-color": "var(--heat-0)",
  });
});

for (const tab of TABS) {
  test(`doomsday ${tab.name}: touch targets`, async ({ page }) => {
    test.skip(!isPhone(page));
    await openScreen(page, tab.url);
    await expectTouchTargets(page);
  });
  test(`doomsday ${tab.name}: accessibility`, async ({ page }) => {
    await openScreen(page, tab.url);
    await expectAccessible(page);
  });
  test(`doomsday ${tab.name}: reduced motion`, async ({ page }) => {
    await openScreen(page, tab.url);
    await expectNoMotion(page);
  });
  test(`doomsday ${tab.name}: screenshot`, async ({ page }) => {
    await openScreen(page, tab.url);
    await expectScreenshot(page, `doomsday-${tab.name}`);
  });
}

test("doomsday roster chips: design values", async ({ page }) => {
  await openScreen(page, "/roster");
  const chip = page.getByRole("link", { name: /^Doomsday this week: PvE 80 PvP 67/ });
  await expectStyles(chip, {
    "background-color": "var(--surface-dd-chip)",
    "border-color": "var(--line-control)",
    "font-size": "var(--fs-meta)",
  });
  await expectStyles(chip.getByText("PvE 80"), { color: "var(--pve-text)" });
  await expectStyles(chip.getByText(/^PvP/), { color: "var(--pvp-text)" });
  await expectStyles(page.getByRole("link", { name: /PvP Virgin/ }).getByText("PvP Virgin"), { color: "var(--swap-text)" });
});

// WEB-65: the ⓘ tooltip, the site's one way to explain something (board live-test-site-fixes).
test("info tip: design values", async ({ page }) => {
  await openScreen(page, "/doomsday");
  const goals = page.getByRole("region", { name: /^Your goals/ });
  const button = goals.getByRole("button", { name: "More info" });
  await expectStyles(button, { width: "var(--size-touch)", height: "var(--size-touch)" });
  await expectStyles(button.locator("span"), {
    width: "var(--size-info)",
    height: "var(--size-info)",
    "border-top-color": "var(--gold)",
  });
  await button.click();
  const tip = page.getByRole("tooltip").filter({ hasText: "Goals are suggestions with points." });
  await expectStyles(tip, {
    "background-color": "var(--surface-tooltip)",
    "border-top-color": "var(--line-tip)",
    "font-size": "var(--fs-tip)",
  });
  // Inside the screen, also on a 375 px phone.
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(button).toHaveAttribute("aria-describedby", (await tip.getAttribute("id"))!);
});
