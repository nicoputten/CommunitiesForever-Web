import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { isPhone } from "../design/checks";
import { planRun } from "./runs";
import { signInAs } from "./session";
import { pick } from "./dropdown";

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

  // Femke answers on the run's page; the healer slot takes Lia. Her first try doesn't go through: it is kept.
  await as(context, baseURL!, "Femke#3307");
  await page.goto(`/runs/${runId}`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await pick(page, answer.getByLabel("Answer with"), "Lia Thornwhisper 37 · healer");
  await page.route("**/api/runs/*/answer", (route) => route.abort());
  await answer.getByRole("button", { name: "I'm in" }).click();
  await expect(answer.getByText(/Answer didn.t go through/)).toBeVisible();
  await page.unroute("**/api/runs/*/answer");
  await answer.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("region", { name: "Group" }).getByText("Lia Thornwhisper")).toBeVisible();
  if (isPhone(page)) {
    // In thumb reach: the answer stays at the bottom of the screen, above the tab bar.
    const box = (await answer.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(812 - 200);
  }

  // Only the organiser edits.
  expect((await page.request.get(`/runs/${runId}/edit`)).status()).toBe(404);
  await as(context, baseURL!, E2E.admin);
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
  await page.getByLabel("Time").fill("00:01");
  await expect(page.getByText(/^Time already passed\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan run" })).toBeDisabled();
});
