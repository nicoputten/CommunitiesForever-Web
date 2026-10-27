import { expect, test } from "@playwright/test";
import { E2E } from "../../playwright.config";
import { sampleSavedVariables } from "../design/sample";
import { signInAs } from "./session";

// Uploads the design sample (the invented friends) as the e2e admin through the real upload route, with times
// relative to now (WEB-21).
test("upload the sample data", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, E2E.admin);
  const text = sampleSavedVariables({ self: E2E.admin, now: Math.floor(Date.now() / 1000) });
  const res = await page.request.post("/api/uploads", {
    multipart: { file: { name: "CommunitiesForever.lua", mimeType: "text/plain", buffer: Buffer.from(text) } },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
