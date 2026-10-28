import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { planRun } from "./runs";
import { signInAs } from "./session";

// WEB-40: plan a run, friends answer from the list and the run's page (an answer that didn't go through is kept and
// retried), the organiser edits and deletes, someone else can't. On the e2e sample (seed.setup.ts): the admin plays
// Nico's characters (Ves Doombringer 39), Bob has Bob Example 41, Femke Lia Thornwhisper 37.

async function as(context: BrowserContext, baseURL: string, battleTag: string) {
  await context.clearCookies();
  await signInAs(context, baseURL, battleTag);
}

/** Desktop and phone plan different wings, so each finds its own run. */
const wing = (page: Page) =>
  isPhone(page)
    ? { id: "sm-cathedral", name: "Scarlet Monastery: Cathedral" }
    : { id: "sm-armory", name: "Scarlet Monastery: Armory" };

test("plan, answer, edit and delete a run", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const { id: dungeon, name } = wing(page);

  // The admin plans tomorrow evening, leading as Ves.
  await as(context, baseURL!, E2E.admin);
  const runId = await planRun(page, { dungeon, day: 1, time: "20:30", lead: "Ves Doombringer", note: "Bring water" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByText("Planned by you on the website")).toBeVisible();
  await expect(page.getByText("“Bring water”")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Organiser" })).toBeVisible();

  // Bob sees it under "Runs I can join", with the badge, and answers I'm in from the list.
  await as(context, baseURL!, "Bob#2002");
  await page.goto("/runs");
  const nav = isPhone(page) ? page.locator("[data-tabbar]") : page.getByRole("banner");
  await expect(nav.getByRole("link", { name: /^Runs \d+ runs? you can join/ })).toBeVisible();
  const card = page.getByRole("article", { name });
  await card.getByRole("button", { name: "I'm in" }).click();
  await expect(card.getByText(/^You answered I'm in with Bob Example/)).toBeVisible();

  // Femke answers on the run's page through the picker (WEB-49); the healer slot takes Lia. A try that doesn't go
  // through stays in the picker with what she chose.
  await as(context, baseURL!, "Femke#3307");
  await page.goto(`/runs/${runId}`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await answer.getByRole("button", { name: "Answer" }).click();
  const picker = page.getByRole("dialog", { name: `Join ${name}` });
  await picker.getByRole("option", { name: /Lia Thornwhisper/ }).click();
  await expect(picker.getByRole("radio", { name: /^Healer/ })).toHaveAttribute("aria-checked", "true");
  await expect(picker.getByRole("radio", { name: /^Tank/ })).toHaveAttribute("aria-disabled", "true");
  await page.route("**/api/runs/*/answer", (route) => route.abort());
  await picker.getByRole("button", { name: "Save answer" }).click();
  await expect(picker.getByRole("alert")).toHaveText(/No connection/);
  await page.unroute("**/api/runs/*/answer");
  await picker.getByRole("button", { name: "Save answer" }).click();
  await expect(picker).toBeHidden();
  const group = page.getByRole("region", { name: "Group" });
  await expect(group.getByText("Lia Thornwhisper")).toBeVisible();
  await expect(answer.getByText(/You're in as/)).toBeVisible();
  if (isPhone(page)) {
    // In thumb reach: the answer stays at the bottom of the screen, above the tab bar.
    const box = (await answer.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(812 - 200);
  }

  expect((await page.request.get(`/runs/${runId}/edit`)).status()).toBe(404);

  // The organiser moves Lia to reserve and benches himself, from the slots' ⋯ menus (WEB-49).
  await as(context, baseURL!, E2E.admin);
  await page.goto(`/runs/${runId}`);
  await page.getByRole("button", { name: "Move Lia Thornwhisper" }).click();
  await page.getByRole("menuitem", { name: /^Move to reserve/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Lia Thornwhisper moved to reserve" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Lia Thornwhisper" })).toBeVisible();
  await page.getByRole("button", { name: "Change your place" }).click();
  await page.getByRole("menuitem", { name: "Bench yourself" }).click();
  await expect(page.getByRole("region", { name: "You lead" }).getByText(/You're on the bench as/)).toBeVisible();
  await page.getByRole("button", { name: "Join again" }).click();
  await page.getByRole("dialog", { name: "Lead as" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "You lead" }).getByText(/^You lead as/)).toBeVisible();

  // Only the organiser edits.
  await page.goto(`/runs/${runId}`);
  await page.getByRole("link", { name: "Edit run" }).click();
  await page.getByLabel("Note (optional)").fill("Bring water and food");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("“Bring water and food”")).toBeVisible();

  // The organiser deletes it: cancelled, under Past.
  await page.getByRole("button", { name: "Delete run" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Cancelled by Nico")).toBeVisible();
  await page.goto("/runs?show=all");
  await expect(page.getByRole("link", { name: `Tomorrow ${name} · Nico Cancelled` })).toBeVisible();
});

test("the roster shows the next run and a band's planned runs (WEB-45)", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, E2E.admin);
  const dungeon = isPhone(page) ? "sm-library" : "sm-graveyard";
  const runId = await planRun(page, { dungeon, day: 2, time: "21:00", lead: "Ves Doombringer" });
  await page.goto("/roster");
  const next = page.getByRole("region", { name: "Next run" });
  await expect(next).toBeVisible();
  await expect(next.getByRole("link", { name: "All runs →" })).toHaveAttribute("href", "/runs");
  // The run's band may be beyond the 4 rows.
  const showAll = page.getByRole("button", { name: /^Show all \d+$/ });
  if (await showAll.isVisible()) await showAll.click();
  const band = page
    .getByRole("list", { name: "Dungeon bands" })
    .getByRole("button", { name: /· \d+ runs?/ })
    .first();
  await band.click();
  const pop = page.getByRole("dialog").filter({ hasText: "Plan a run" });
  await expect(pop.getByRole("link", { name: /View run|· 1 in/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  // Clean up: the run is cancelled, so the other tests see the roster as before.
  await page.goto(`/runs/${runId}`);
  await page.getByRole("button", { name: "Delete run" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
});

test("Plan a run says when the time has passed, and when none of your characters fit", async ({
  page,
  context,
  baseURL,
}) => {
  await as(context, baseURL!, E2E.admin);
  await page.goto("/runs/new?dungeon=scholo");
  // Ves (39) is 19 below Scholomance: too low to lead (WEB-47 levelFit; 5 below Zul'Farrak he may).
  await expect(page.getByText(/None of your characters fit Scholomance \(58–60\)/)).toBeVisible();
  await page.getByRole("group", { name: "Day" }).getByRole("radio").first().check();
  await page.getByRole("group", { name: "Time" }).getByRole("radio", { name: "Other…" }).check();
  await page.getByLabel("Other time").fill("00:01");
  await expect(page.getByText(/^Time already passed\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan run" })).toBeDisabled();
});

// WEB-49 part B (board runs-v2-plan, findings 6 and 11): no guessed dungeon, the dropdown's groups and other wings,
// day and time chips; the runs list's slot bar with its tooltip.
test("Plan v2: an empty dungeon, its groups and wings, day and time chips", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, E2E.admin);
  await page.goto("/runs/new");
  const dungeon = page.getByRole("combobox", { name: "Dungeon", exact: true });
  await expect(dungeon).toContainText("Pick a dungeon");
  await expect(page.getByRole("button", { name: "Plan run" })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Lead as" })).toHaveCount(0);

  await dungeon.click();
  await expect(page.getByRole("group", { name: "Fits your characters" })).toBeVisible();
  await expect(page.getByRole("group", { name: "All dungeons by level" })).toBeAttached();
  await page.getByRole("combobox", { name: "Search" }).fill("graveyard");
  await expect(page.getByRole("group", { name: "Other Scarlet Monastery wings" }).getByRole("option")).toHaveCount(3);
  await page.getByRole("option", { name: /^Scarlet Monastery: Graveyard/ }).click();
  await expect(dungeon).toContainText("Scarlet Monastery: Graveyard");
  await expect(page.getByRole("listbox", { name: "1 · Character" })).toBeVisible();

  // Time: the chips, and Other… for any other time.
  const time = page.getByRole("group", { name: "Time" });
  await expect(time.getByRole("radio", { name: "20:30" })).toBeChecked();
  await time.getByRole("radio", { name: "Other…" }).check();
  await page.getByLabel("Other time").fill("21:45");
  await page.getByLabel("Other time").blur();
  await expect(page.getByRole("region", { name: "Preview in Discord" })).toContainText("at 21:45");

  // Day: seven chips; a date picked beyond them gets a chip of its own.
  const day = page.getByRole("group", { name: "Day" });
  await expect(day.getByRole("radio")).toHaveCount(7);
  await expect(day.getByRole("radio").first()).toHaveAccessibleName("Today");
  await page.getByRole("button", { name: /^Another date/ }).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(day.getByRole("radio")).toHaveCount(8);
  await expect(day.getByRole("radio").last()).toBeChecked();
  await expect(page.getByRole("button", { name: "Plan run" })).toBeEnabled();
});

test("the runs list: a summary and the slot bar's tooltip", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, E2E.admin);
  // Its own run (the seed has none): each size plans a different dungeon.
  const [dungeon, name] = isPhone(page) ? ["rfk", "Razorfen Kraul"] : ["sfk", "Shadowfang Keep"];
  await planRun(page, { dungeon, day: 2, time: "19:00" });
  await page.goto("/runs?show=all");
  const bar = page.getByRole("article", { name }).getByRole("img", { name: /^Group: Tank · / });
  await expect(bar).toBeVisible();
  await expect(page.getByText(/^\d+ in( · \d+ maybe)? · (\d+ open|full)/).first()).toBeVisible();
  await bar.focus();
  await expect(bar.getByText(/^Healer · /)).toBeVisible();
});
