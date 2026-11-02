import { expect, test } from "@playwright/test";
import { answerRun, planRun, setTimeZone } from "../e2e/runs";
import { signInAs } from "../e2e/session";
import { ADMIN, sampleSavedVariables, type SampleDay } from "./sample";

// Seeds the design server's fresh database with the sample data through the real upload route, as the admin: the
// day before first, then the design sample, so upload 2 has a session report with level ups and skill gains (WEB-20).
// The merged result is the design sample.
test("upload the sample data", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
  for (const day of [2, 3] satisfies SampleDay[]) {
    const res = await page.request.post("/api/uploads", {
      multipart: {
        file: {
          name: "CommunitiesForever.lua",
          mimeType: "text/plain",
          buffer: Buffer.from(sampleSavedVariables({ day })),
        },
      },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  }
});

// The sample's planned runs (WEB-40), through the real form and answer route, as their organisers and friends. "Now"
// is Thu 19 Nov 2026 21:00 in Amsterdam (FIXED_NOW); Bob is in London, so his run reads "20:00 for Bob".
test("plan the sample runs", async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  const as = async (battleTag: string) => {
    await context.clearCookies();
    await signInAs(context, baseURL!, battleTag);
  };
  await as(ADMIN);
  // The desktop and phone projects run this file again: plan once.
  await page.goto("/runs?show=all");
  if ((await page.getByRole("article").count()) > 0) return;
  await setTimeZone(page, "Europe/Amsterdam");
  const armory = await planRun(page, {
    dungeon: "sm-armory",
    day: 0,
    time: "23:30",
    lead: "Ves Doombringer",
    note: "Bring water, we clear the courtyard first.",
  });

  await as("Bob#2002");
  await setTimeZone(page, "Europe/London");
  await answerRun(page, armory, "in", "Player-1-0000B001");
  await planRun(page, { dungeon: "rfk", day: 1, time: "20:00", lead: "Tok Ironhide" });
  await planRun(page, { dungeon: "zf", day: 3, time: "19:00" });

  await as("Femke#3307");
  await setTimeZone(page, "Europe/Amsterdam");
  await answerRun(page, armory, "in", "Player-1-0000E001");
  await planRun(page, { dungeon: "sm-cathedral", day: 6, time: "20:00", lead: "Lia Thornwhisper" });
  const sfk = await planRun(page, { dungeon: "sfk", day: 2, time: "18:00" });
  await page.goto(`/runs/${sfk}`);
  await page.getByRole("button", { name: "Delete run" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/^Cancelled by/)).toBeVisible();

  await as("Mira#1188");
  await setTimeZone(page, "Europe/Amsterdam");
  await answerRun(page, armory, "cant");
  const wc = await planRun(page, { dungeon: "wc", day: 2, time: "15:00", lead: "Kel Dawnhammer" });

  await as("Jorrit#4410");
  await setTimeZone(page, "Europe/Amsterdam");
  await answerRun(page, armory, "maybe", "Player-1-0000D001");

  await as(ADMIN);
  await answerRun(page, wc, "maybe", "Player-1-0000A002");
});
