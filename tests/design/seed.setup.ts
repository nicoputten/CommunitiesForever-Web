import { expect, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import { ADMIN, sampleSavedVariables } from "./sample";

// Seeds the design server's fresh database with the sample data through the real upload route, as the admin.
test("upload the sample data", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
  const res = await page.request.post("/api/uploads", {
    multipart: {
      file: { name: "CommunitiesForever.lua", mimeType: "text/plain", buffer: Buffer.from(sampleSavedVariables()) },
    },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
