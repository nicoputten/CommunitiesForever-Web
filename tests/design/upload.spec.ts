import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "../e2e/session";
import {
  DATA,
  SURFACE,
  TYPE,
  expectAccessible,
  expectBackground,
  expectNoMotion,
  expectScreenshot,
  expectStyles,
  expectTouchTargets,
  isPhone,
  openScreen,
  runningAnimations,
} from "./checks";
import { ADMIN, NOW, sampleSavedVariables } from "./sample";

// WEB-19: design checks of the upload page (boards `upload`, `upload-states`). The states come from canned answers
// of /api/uploads (page.route), so the shared design database, and with it every other screenshot, never changes;
// tests/e2e/upload.spec.ts runs the same states against the real server.

const H = 3600;
const zone = (page: Page) => page.locator("[data-state]");

/** Answers the next upload with `body`; `hold` keeps the request open (the reading state). */
async function answer(page: Page, body: object | "hold"): Promise<void> {
  await page.route("**/api/uploads", async (route) => {
    if (body === "hold") return new Promise(() => {});
    await route.fulfill({ json: body });
  });
}

async function choose(page: Page, name = "CommunitiesForever.lua", text = sampleSavedVariables()): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
}

/** Reduced motion still fades changes over --dur-instant: wait until the state has settled. */
async function settle(page: Page): Promise<void> {
  await expect.poll(() => runningAnimations(page)).toEqual([]);
}

const rejected = (extra: object) => ({ id: 2, uploadedAt: NOW, status: "rejected", duplicate: false, ...extra });

/** Each state of the upload-states board, and the refusal without a board that looks most different. */
const STATES: { name: string; state: string; show: (page: Page) => Promise<void> }[] = [
  {
    name: "reading",
    state: "reading",
    show: async (page) => {
      await answer(page, "hold");
      await choose(page);
      await expect(zone(page).getByText(/characters from \d+ friends/).first()).toBeVisible();
    },
  },
  {
    name: "wrong-file",
    state: "wrong-file",
    show: async (page) => {
      await answer(page, rejected({ unreadable: "not-ledger" }));
      await choose(page, "Questie.lua", "QuestieConfig = {}");
    },
  },
  {
    name: "newer-format",
    state: "newer-format",
    show: async (page) => {
      await answer(page, rejected({ unreadable: "newer-format", schemaVersion: 3 }));
      await choose(page);
    },
  },
  {
    name: "nothing-new",
    state: "nothing-new",
    show: async (page) => {
      await answer(page, { id: 1, uploadedAt: NOW - 2 * H, status: "ok", duplicate: true });
      await choose(page);
      await expect(zone(page).getByText(/your upload of today \d\d:\d\d/)).toBeVisible();
    },
  },
  {
    name: "not-your-file",
    state: "not-your-file",
    show: async (page) => {
      await answer(page, rejected({ rejection: { code: "not-your-file", owner: "Bob#2002" } }));
      await choose(page);
    },
  },
];

test.beforeEach(async ({ context, baseURL }) => {
  await signInAs(context, baseURL!, ADMIN);
});

test("upload: design values", async ({ page }) => {
  await openScreen(page, "/upload");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), { ...TYPE.display, color: "var(--gold-bright)" });
  await expectStyles(page.getByText("After a play session", { exact: false }), { ...TYPE.bodySm, color: "var(--text-dim)" });
  await expectStyles(zone(page), {
    "min-height": "var(--size-dropzone)",
    "border-radius": "var(--r-sheet)",
    "border-top-style": "dashed",
    "border-top-color": "var(--drop-line)",
  });
  await expectStyles(zone(page).getByText(/^Drop .* here$/), {
    ...TYPE.name,
    "font-size": "var(--fs-drop)",
    color: "var(--text-strong)",
  });
  await expectStyles(page.getByRole("button", { name: "Choose file" }), {
    "background-color": "var(--gold)",
    color: "var(--on-gold)",
    "border-radius": "var(--r-btn)",
    "min-height": "var(--size-touch)",
    "font-weight": "var(--fw-semibold)",
  });
  await expectStyles(page.getByText(/^Find it in your game folder/), { ...TYPE.meta, color: "var(--text-faint)" });
  await expectStyles(page.getByText(/^The game writes this file/).locator(".."), {
    ...TYPE.meta,
    color: "var(--text-muted)",
    "border-radius": "var(--r-btn)",
  });

  const history = page.getByRole("complementary", { name: "History" });
  await expectStyles(history, { ...SURFACE, "border-radius": "var(--r-panel)" });
  await expectStyles(history.getByRole("heading", { level: 2 }), {
    ...TYPE.section,
    "letter-spacing": "var(--ls-section)",
    color: "var(--gold-bright)",
  });
  const line = page.getByTestId("history-line").first();
  await expect(line).toContainText(/^Today \d\d:\d\dNicoFirst upload · \d+ charactersDone$/);
  await expectStyles(line, { ...DATA, "min-height": "var(--size-touch)" });
  await expectStyles(line.getByText("Done", { exact: true }), {
    color: "var(--fresh-text)",
    "background-color": "var(--done-tint)",
    "border-radius": "var(--r-pill)",
    "font-size": "var(--fs-meta-sm)",
  });
});

test("upload: touch targets", async ({ page }) => {
  test.skip(!isPhone(page), "phone only");
  await openScreen(page, "/upload");
  await expectTouchTargets(page);
});

test("upload: accessibility", async ({ page }) => {
  await openScreen(page, "/upload");
  await expectAccessible(page);
});

test("upload: reduced motion", async ({ page }) => {
  await openScreen(page, "/upload");
  await expectNoMotion(page);
});

test("upload: with motion allowed, the dropzone breathes", async ({ page }) => {
  await openScreen(page, "/upload", { motion: true });
  await expect.poll(() => runningAnimations(page)).toEqual(expect.arrayContaining([expect.stringMatching(/breathe/)]));
});

test("upload: screenshot", async ({ page }) => {
  await openScreen(page, "/upload");
  await expectScreenshot(page, "upload");
});

test("upload: dragging over the page", async ({ page }) => {
  test.skip(isPhone(page), "phones don't drag files");
  await openScreen(page, "/upload");
  const data = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([""], "CommunitiesForever.lua"));
    return dt;
  });
  await page.dispatchEvent("main", "dragenter", { dataTransfer: data });
  await expect(zone(page)).toHaveAttribute("data-state", "dragging");
  await settle(page);
  await expectStyles(zone(page), { "border-top-color": "var(--gold-bright)", "border-top-style": "solid" });
  await expectStyles(zone(page).getByText("Let go to upload"), {
    ...TYPE.name,
    "font-size": "var(--fs-state)",
    color: "var(--text-strong)",
  });
  await expectNoMotion(page);
  await expectScreenshot(page, "upload-dragging");
});

for (const s of STATES) {
  test.describe(`upload: ${s.name}`, () => {
    test("design values", async ({ page }) => {
      await openScreen(page, "/upload");
      await s.show(page);
      await expect(zone(page)).toHaveAttribute("data-state", s.state);
      await settle(page);
      await expectStyles(zone(page).locator(":scope > p").first(), {
        ...TYPE.name,
        "font-size": "var(--fs-state)",
        color: "var(--text-strong)",
      });
      const line =
        s.state === "reading" ? "var(--line-control)" : s.state === "nothing-new" ? "var(--line-neutral)" : "var(--alert-line)";
      await expectStyles(zone(page), { "border-top-color": line, "border-radius": "var(--r-sheet)" });
      if (s.state !== "reading") {
        await expectStyles(zone(page).getByRole(s.state === "newer-format" ? "link" : "button"), {
          "min-height": "var(--size-touch)",
          "border-radius": "var(--r-btn)",
        });
      }
    });

    test("touch targets, accessibility, reduced motion", async ({ page }) => {
      await openScreen(page, "/upload");
      await s.show(page);
      if (isPhone(page)) await expectTouchTargets(page);
      await expectAccessible(page);
      await expectNoMotion(page);
    });

    test("screenshot", async ({ page }) => {
      await openScreen(page, "/upload");
      await s.show(page);
      await settle(page);
      await expectScreenshot(page, `upload-${s.name}`);
    });
  });
}
