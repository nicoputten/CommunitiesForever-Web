# Doomsday data (handwritten)

Saved data with the fields of addon CF-52, CF-53, CF-55 and CF-56 (`chars.*.pvp`, `chars.*.riding`, the feed's
`kills`, `deaths`, `duels`, `loot`, `notable`, `gold`, `sessions`, `groups`, `pvpKills`, and `goals`), written by hand
from the addon's stories and its CF-52 work in progress (WEB-55, agreed with Nico 2026-10-28), because no addon
release writes them yet. Made-up names and ids only.

When the addon releases these fields, its golden fixture joins `tests/fixtures/addon/<release>/` (CLAUDE.md rule 4)
and the tests switch to it; this file can then go.

- `savedvariables.lua`: every new field, for the uploader (Ada) and a friend (Bob); Cid on an older addon has none.
- `goals-false.lua`: the same friends, with `feed = false` and `goals = false` from an addon that still had
  "Share my activity" (now gone: false means nothing was sent).

## `doomsday-cases.json`
The addon's golden cases (`tests/fixtures/doomsday-cases.json` in the addon repo), copied byte for byte from addon
commit `cd5cfb441a59bd1ed88345167e4bd8fee633bb01` (`develop` after CF-104, PR #259: pool version 4 and the Hunt, WEB-101; before it `126ae5ca5635e08927ad0d76af98c1219dad5128`, `develop` after CF-99, PR #226: pool version 3, WEB-89; byte-identical to the CF-99 branch at `111e2e2`; before it `50fc1577e3ca351d3b0fb921d738a318796630ee`, `develop` after CF-77, PR #188: pool version 2, WEB-80 part 4; byte-identical to the CF-77 branch at `c109b19`; before it `4a17466`, CF-78, PR #185, and CF-79, PR #186: the PvP Virgin `ladder` cases and the full catalogue, WEB-80 parts 2 and 3; before it CF-70, PR #181, and CF-69, PR #182: `pools.catalogue` and `pointsPerGoal`, WEB-80 part 1; before it CF-68, PR #172, the schedule cases agreed with WEB-78, and CF-55a, PR #97). Prettier leaves it alone
(`.prettierignore`). Never edited here: a rule change updates
the addon's `docs/DOOMSDAY.md`, this file and both copies in the same release. `tests/unit/doomsday.golden.test.ts`
checks `src/core/doomsday/rules.ts` against it; cases marked `addonOnly` (goal progress, a recorded day kept) are skipped. A case with `pool` runs in that pool version, one without it in pool version 1 (CF-77).
