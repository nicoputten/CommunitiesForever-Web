import { expect, test } from "@playwright/test";
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
