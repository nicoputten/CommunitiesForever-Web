# Design checks (WEB-30)

Drifting from the design system (`docs/DESIGN.md`, CLAUDE.md rules 11 and 12) fails the build. `npm run test:design` runs all of it (after `npm run build`); CI runs it on every PR (job `design` in `.github/workflows/ci.yml`).

| Check | Where | What |
|---|---|---|
| Token lint | `tokens.test.ts`, `token-lint.ts` (Vitest, also in `npm test`) | No raw colours, font sizes, font families, radii, shadows, blurs or durations in `src/**/*.css` and `src/**/*.tsx` outside `src/styles/tokens.css`. Allowed: `0`, `100%`, CSS keywords. A value that's really needed goes into tokens.css part 2 with the board it comes from. The allow-list in `tokens.test.ts` is empty; an entry needs Nico's OK. |
| Computed styles | `expectStyles` in `checks.ts` | Key elements use the design values, read with `getComputedStyle`. Expected values are tokens (`var(--fs-display)`); the browser resolves them. A `font-family` must also be loaded. Presets: `TYPE.*` (type scale), `DATA` (Inter, tabular numbers), `characterName(classFile)` (Marcellus in the class `-text` colour), `SURFACE` / `SURFACE_MODAL` (token blur), `expectBackground(page, "map" \| "data")`. |
| Touch targets | `expectTouchTargets` | Every visible interactive element ≥ 44 × 44 px; run it at phone size (and again with menus open). |
| Accessibility | `expectAccessible` | `@axe-core/playwright`, WCAG 2.2 AA rules, no serious or critical violations, at both sizes. |
| Reduced motion | `expectNoMotion` | With `prefers-reduced-motion`, no running CSS animation, transition or Web Animation. Generic, so it covers any new animation; JS-driven motion (requestAnimationFrame) is not seen, so use CSS or the Web Animations API. |
| Screenshots | `expectScreenshot` | `toHaveScreenshot` (full page) at 1440 px (`desktop`) and 375 px (`phone`), reduced motion, fixed "now". |

## Fixed data
`playwright.design.config.ts` starts its own server (port 3200) on a fresh database with `FIXED_NOW` (`NOW` in `sample.ts`) and admin `Nico#2201`. The `empty-*` projects (`*.empty.ts`) check the site before any upload (WEB-29); then the `seed` project (`seed.setup.ts`) uploads `sample.ts` through the real upload route, the day before first and then the design sample (so upload 2 has a session report, WEB-20): the invented friends of `docs/DESIGN-PROMPT.md` in the community "Doombringers", with their Doomsday data (`sampleDoomsday.ts`: goals, kills, PvP ranks; the engine computes Doomsday from it, WEB-63). `openScreen` sets the browser clock to the same "now", emulates reduced motion, waits until the page is fully streamed (a `loading.tsx` can still show at the load event on a slow machine, WEB-63) and waits for the web fonts. `sample.test.ts` keeps the sample a file the site accepts.

## Adding a screen (WEB-17..29)
Add `tests/design/<screen>.spec.ts` (and remove the screen's placeholder entry from `SHELL_SCREENS` in `shell.spec.ts`):

```ts
test.beforeEach(async ({ context, baseURL }) => signInAs(context, baseURL!, ADMIN));

test("roster: design values", async ({ page }) => {
  await openScreen(page, "/roster");
  await expectBackground(page, "data");
  await expectStyles(page.getByRole("heading", { level: 1 }), TYPE.display);
  await expectStyles(page.getByText("Ves Doombringer"), { ...characterName("WARLOCK"), "font-size": "var(--fs-name)" });
  await expectStyles(page.getByTestId("level"), DATA);
});
test("roster: touch targets", async ({ page }) => { test.skip(!isPhone(page)); await openScreen(page, "/roster"); await expectTouchTargets(page); });
test("roster: accessibility", async ({ page }) => { await openScreen(page, "/roster"); await expectAccessible(page); });
test("roster: reduced motion", async ({ page }) => { await openScreen(page, "/roster"); await expectNoMotion(page); });
test("roster: screenshot", async ({ page }) => { await openScreen(page, "/roster"); await expectScreenshot(page, "roster"); });
```

Check the screen's states too (empty, loading, error, open menus or sheets) where they look different. Extend `sample.ts` when a screen needs data it doesn't have yet (that changes other screens' screenshots too).

## Screenshot baselines
Baselines live in `__screenshots__/` and are made on Linux in the Playwright image (`mcr.microsoft.com/playwright:v1.64.1-noble`), because fonts render differently on Windows and macOS; there `expectScreenshot` is skipped and the other checks run as usual. The image tag matches `@playwright/test`: bump both together.

**A changed baseline is only committed after Nico approved the new look** (CLAUDE.md rule 12). To update:
1. Push. The CI job `design` writes the screenshots that differ (or are new) and fails with "Screenshots differ from the baselines".
2. Download them: `gh run download <run-id> -n design-baselines -D tests/design/__screenshots__`.
3. Look at the diff (GitHub shows image diffs in the PR), get Nico's OK in the PR, commit.

With Docker you can do the same locally: `docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.64.1-noble sh -c "npm ci --ignore-scripts && npm run build && npm run test:design -- --update-snapshots"` (this replaces `node_modules` and `.next` with Linux builds; run `npm ci` again afterwards).
