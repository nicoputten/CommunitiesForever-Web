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
commit `b722967e40221a4f8c1564ee4ac5ef8b670b495e` (`develop` after CF-70, PR #181, and CF-69, PR #182: the catalogue `pools.catalogue` and `pointsPerGoal`, WEB-80; before it CF-68, PR #172, the schedule cases agreed with WEB-78, and CF-55a, PR #97). Prettier leaves it alone
(`.prettierignore`). Never edited here: a rule change updates
the addon's `docs/DOOMSDAY.md`, this file and both copies in the same release. `tests/unit/doomsday.golden.test.ts`
checks `src/core/doomsday/rules.ts` against it; cases marked `addonOnly` (goal progress, a recorded day kept) are skipped.
