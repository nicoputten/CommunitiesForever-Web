# The addon's golden cases for dungeons (CF-106)

Copied byte for byte from the addon repo (`tests/fixtures/*.json` there). The addon owns them; never edit a case
here to make code pass: a rule change updates the addon's file and this copy in the same release.

Source: addon branch `feature/cf-106-runs-dungeons-tabs` at `97833eadb25c309be832dbb2f55049c7f7653546`, before CF-106
merged. Copy them again from `develop` once it merges (WEB-102, WEB-97).

- `dungeon-fit-cases.json`: the one fit rule, `level >= min - 2 and level <= max` (`src/core/levelFit.ts`
  `dungeonFit`).
- `loot-usable-cases.json`: "Usable by", the class can ever use the item (`src/core/loot.ts` `usable`).
- `run-progress-cases.json`: a planned run's boss progress (`src/core/runProgress.ts`).

Checked by `tests/unit/dungeonGolden.test.ts`. Prettier leaves them alone (`.prettierignore`).
