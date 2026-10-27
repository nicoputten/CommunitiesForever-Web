import { expect, type Page } from "@playwright/test";

// Helpers for the runs tests (WEB-40): plan through the real form, set a friend's time zone on the Discord page,
// answer through the site's answer route.

export interface PlanInput {
  dungeon: string;
  /** Index of the day chip: 0 today … 6. */
  day: number;
  time: string;
  /** The lead character's option text start, e.g. "Ves Doombringer"; default: the first that fits. */
  lead?: string;
  note?: string;
}

/** Plans a run as the signed-in friend; returns its id. */
export async function planRun(page: Page, input: PlanInput): Promise<number> {
  await page.goto(`/runs/new?dungeon=${input.dungeon}`);
  if (input.lead !== undefined) {
    const lead = page.getByLabel("Lead as");
    const value = await lead.locator("option", { hasText: input.lead }).first().getAttribute("value");
    await lead.selectOption(value ?? "");
  }
  await page.getByRole("group", { name: "Day" }).getByRole("radio").nth(input.day).check();
  await page.getByLabel("Time").fill(input.time);
  if (input.note !== undefined) await page.getByLabel("Note (optional)").fill(input.note);
  await page.getByRole("button", { name: "Plan run" }).click();
  await page.waitForURL(/\/runs\/\d+$/);
  return Number(page.url().split("/").at(-1));
}

/** Picks the signed-in friend's time zone on the Discord page. */
export async function setTimeZone(page: Page, timeZone: string): Promise<void> {
  await page.goto("/discord");
  const select = page.getByLabel("Time zone", { exact: true });
  await select.selectOption(timeZone);
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page).toHaveURL(/notice=time-zone/);
}

/** Answers a run as the signed-in friend, through the route the answer buttons use. */
export async function answerRun(page: Page, runId: number, answer: "in" | "maybe" | "cant", guid?: string) {
  const res = await page.request.post(`/api/runs/${runId}/answer`, {
    data: { answer, ...(guid === undefined ? {} : { guid }) },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { stored: { answer: string; waitlisted: boolean } };
}
