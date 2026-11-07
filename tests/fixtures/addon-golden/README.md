# The addon's golden cases for dungeons (CF-106)

Copied byte for byte from the addon repo (`tests/fixtures/*.json` there). The addon owns them; never edit a case
here to make code pass: a rule change updates the addon's file and this copy in the same release.

Source: addon `develop` at `521dbaf253da1f2f3b4a775082666fb50ae9a4db` (CF-106 merged, PR #243).

- `dungeon-fit-cases.json`: the one fit rule, `level >= min - 2 and level <= max` (`src/core/levelFit.ts`
  `dungeonFit`).
- `loot-usable-cases.json`: "Usable by", the class can ever use the item (`src/core/loot.ts` `usable`).
- `run-progress-cases.json`: a planned run's boss progress (`src/core/runProgress.ts`).

Checked by `tests/unit/dungeonGolden.test.ts`. Prettier leaves them alone (`.prettierignore`).
