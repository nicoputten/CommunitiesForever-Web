# Source data: the addon's SavedVariables

File: `WTF/Account/<ACCOUNT>/SavedVariables/CommunitiesForever.lua`, written by the game at logout and `/reload`.
Shape: `CommunitiesForeverDB = { ["profileKeys"] = ..., ["global"] = { ... } }`. Only `global` is read.
Format as the game writes it (real file, beta October 2026): a leading blank line, CRLF line endings, every key bracketed (`["key"] =`, `[818] =`), arrays as positional items, floats with up to 16 significant digits (`509.1666259765625`). `src/core/lua.ts` documents how tables come out of the parser (positional-only tables are arrays; tables with keys, and empty ones, are objects with string keys).

Source of truth: the addon repo, `docs/ARCHITECTURE.md` "Data model". This file lists what the site uses.

## Releases
| Addon release | `schemaVersion` | Fixture |
|---|---|---|
| v0.3 | 1 | `tests/fixtures/addon/v0.3/savedvariables.lua` |
| v0.4 | 1 | `tests/fixtures/addon/v0.4/savedvariables.lua` |

The addon fixtures hold `global` only (as `return { ... }`), captured from invented players.

`tests/fixtures/real/beta-2026-10.lua`: Nico's real file from the beta (October 2026), wrapped as the game writes it and kept byte-for-byte (CRLF; `.gitattributes` marks fixtures `-text`) except for anonymization: every BattleTag, character GUID (the realm part kept), `accountId`, character name, club name and `clubId` replaced consistently with invented values.

### What the real file shows (differences from the addon fixtures)
- No `people` table at all: friends without the addon's sync appear only in `presence` and `locations`, without records. No `runs` either.
- `self` has `accountId` and no `displayName`.
- `settings.clubId` is a number (the fixtures have a string). Read it as either.
- `Char.mainTree` is a talent tree index (1), not a name. `Char.talents` is an array of `{ name, points }`, one per tree. `Char.autoRole` sits next to `role`.
- `Char.quests[questID] = { title, area, dungeon }` (`area` is missing in the fixtures).
- `realm` is the beta realm name "CAMWOW EU4 Realm 2 PvP"; GUIDs of one mega-realm carry different realm IDs (`Player-6842-...`, `Player-6943-...`).
- `settings` holds UI state with floats (`window`, `tree`, `dungeonTree`), `tree.groups` keys are BattleTag + GUID concatenated.

## What the site uses
| Field | Meaning | Used for |
|---|---|---|
| `self.battleTag`, `self.displayName` | the uploader (Nico) | person row |
| `self.chars[guid]` | own characters (`Char`) | alts |
| `people[battleTag]` | each friend: `displayName`, `chars[guid]`, `receivedAt`, `via` (relayed by), `removed[guid]` | alts, data age |
| `Char` | `guid, name, classFile, raceID, level, faction, realm, ilvl, professions[skillLineID] = {name, rank, max}, talents, mainTree, role, quests, updatedAt, lastPlayed`; later `recipes` (addon CF-38) | alts, professions |
| `locations[guid]` | `{ zone, seenAt }`: last zone seen in the community while Nico was online. Zone name text, can be a dungeon. | map |
| `presence[guid]` | `{ battleTag, lastSeen }`: BNet presence link | last seen online |
| `self.feed`, `people[bt].feed` | activity per realm day (CF-22/23): per character `name, classFile, at, levelFrom, levelTo, quests[zone], ranks[profession], learned[profession], runs[]`; `false` when "Share my activity" is off; the last 7 realm days only | weekly recap history (WEB-41) |
| `runs` | Nico's runs in progress | later (backlog) |
| `settings` | `clubName` only | page title / group name |

Times are Unix seconds. Any field can be missing in older releases.

## Internal shape
`normalize` turns a file into a `Dataset` (`src/core/model.ts`); `merge` combines two of them into the same shape, so the state after many uploads is a `Dataset` too and WEB-05 can diff two per GUID.
- `people[key]`: key is the BattleTag, or `aid:<accountId>` for someone known only through the community. `displayName` is resolved; `hasRecord: false` for friends seen only in `presence`; `removed[guid] = time`.
- `characters[guid]`: the `Char` fields, all optional, plus `owner` (person key, undefined when unknown) and `hasRecord` (false for a stub). `professions` and `quests` are keyed by ID strings, `talents` is a list (also when the file has `{}`), `mainTree` the 1-based index into it with `mainTreeName` resolved.
- `locations[guid] = { zone, seenAt }`, `presence[guid] = { battleTag, lastSeen }`.
- `community = { id, name }`: `id` is always a string (`settings.clubId` is a number in real files, a string in the fixtures).
- `uploader` (person key of `self`) and `version` (`self.version`).
- The feed is read apart from the `Dataset` (`readFeeds`, `src/core/feed.ts`, WEB-41): it is history, kept per day in its own tables, not merged state.
- Not read yet: `runs`, `invite`, other `settings`.
