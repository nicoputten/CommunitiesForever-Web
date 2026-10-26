# Sample upload files

SavedVariables files in the game's format (`CommunitiesForeverDB = { ["global"] = … }`) with the invented friends of the design sample (`tests/design/sample.ts`, from `docs/DESIGN-PROMPT.md`): never real people. They're for uploading by hand on a local site, e.g. to see the roster, the session report and the upload history with something in them.

| File | `self.battleTag` | Use |
|---|---|---|
| `e2e-admin-day1.lua` … `day3.lua` | `Admin#1000` (the e2e admin, `playwright.config.ts`) | a local server started like the e2e one |
| `yours-day1.lua` … `day3.lua` | `YourName#1234` (placeholder) | a local run with your real Battle.net sign-in |

- **Three consecutive days** of the same uploader's file (evenings of 2026-10-24, 25 and 26, 20:00 UTC). Upload them in order:
  - Day 2 brings level ups, skill gains, item level gains, newer sightings and a new character (Tok Ironhide).
  - Day 3 brings more of the same and is the design checks' sample exactly.
  - Ages on the site count from those dates.
- **Same community** in every file: `settings.clubId` `40000001`, `clubName` "Doombringers".
- **Your own sign-in:** replace `YourName#1234` with your BattleTag (one line, `["battleTag"] = "YourName#1234"` under `["self"]`, e.g. `Vestras#2858`).
  - Your BattleTag must be `ADMIN_BATTLETAG` in `.env.local`, because before the admin's first upload only the admin can upload.
  - Name the file `CommunitiesForever.lua` when you pick it, as the game does.
- **Generated, never edited by hand:** `tests/design/sample.test.ts` checks that every file equals what `sampleSavedVariables()` makes. After a change to the sample, write them again with:

```bash
UPDATE_SAMPLE_FILES=1 npx vitest run tests/design/sample.test.ts
```
