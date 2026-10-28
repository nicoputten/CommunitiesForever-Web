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

// WEB-59: design checks of the Doomsday page (boards doomsday-today, doomsday-phone "Week tab", doomsdays-feats
// heatmap) on the made-up Doomsday sample (src/server/doomsdaySample.ts, DOOMSDAY_SAMPLE=1) until the engine (WEB-58)
// computes it from the uploads. The phone layout is WEB-61; these run at both sizes so nothing breaks meanwhile.

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
];

test("doomsday ladder: design values", async ({ page }) => {
  await openScreen(page, "/doomsday/ladder");
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
  await expectStyles(pvp.getByText("▲ 1"), { color: "var(--pve-text)" });
  await expectStyles(pvp.getByText("▼ 1"), { color: "var(--pvp-text)" });
  await expectStyles(pvp.getByText("new"), { color: "var(--swap-text)" });
  await expectStyles(pvp.getByText("PvP Virgin"), { color: "var(--swap-text)", "background-color": "var(--virgin-tint)" });
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
  await expectStyles(grid.getByRole("cell", { name: "4–2" }), { color: "var(--pve-text)" });
  await expectStyles(grid.getByRole("cell", { name: "1–3" }), { color: "var(--pvp-text)" });
  await expectStyles(page.getByText("1,084"), { "font-family": "var(--font-name)", color: "var(--gold-pale)" });
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
  await expectStyles(page.getByText("412 / 1,000"), { ...TYPE.meta, color: "var(--text-dim)" });
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

  const goal = page.getByTestId("goal").filter({ hasText: "Finish 10 quests" });
  await expectStyles(goal, { "background-color": "var(--surface-goal)", "border-color": "var(--line-goal-done)" });
  await expectStyles(goal.getByText("PvE daily"), { ...TYPE.overline, "font-weight": "var(--fw-semibold)", color: "var(--pve-text)" });
  await expectStyles(goal.getByText("Finish 10 quests"), {
    "font-family": "var(--font-name)",
    "font-size": "var(--fs-section)",
    color: "var(--text-muted)",
  });
  const open = page.getByTestId("goal").filter({ hasText: "Lone wolf" });
  await expectStyles(open.getByText("PvP · Skirmish"), { color: "var(--pvp-text)" });
  await expectStyles(open.getByText("2 / 3"), { ...DATA, color: "var(--text)" });
  await expectStyles(page.getByText(/^resets in /), { "font-size": "var(--fs-body-sm)", color: "var(--streak-text)" });

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
  await expectStyles(page.getByTestId("goal").filter({ hasText: "Bounty" }).getByText("PvP bounty"), {
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
