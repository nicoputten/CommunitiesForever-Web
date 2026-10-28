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
| unreleased (CF-47, CF-48) | 2 | `tests/fixtures/addon-unreleased/pending.lua` (the `pending` list only, the addon's own sample) |

Schema 2 adds only `global.pending`; the site reads schemas 1 and 2 with the same reader (`SUPPORTED_SCHEMA` = 2) and the pending items apart (`src/core/gameItems.ts`, WEB-43). A newer schema is stored as rejected ("newer format").

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
| `Char` | `guid, name, classFile, raceID, level, faction, realm, ilvl, professions[skillLineID] = {name, rank, max}, talents, mainTree, role, quests, updatedAt, lastPlayed`; `pvp = { hk, rank, rankName, weekKills, weekHonor, deaths, duelsWon, duelsLost }` (CF-52: lifetime honorable kills, PvP rank 0 to 14 and the game's name for it, this week's kills and honor, lifetime deaths and duels); `riding` (CF-53: 0, 75 or 150); later `recipes` (addon CF-38) | alts, professions, Doomsday feats (WEB-56) |
| `locations[guid]` | `{ zone, seenAt }`: last zone seen in the community while Nico was online. Zone name text, can be a dungeon. | map |
| `presence[guid]` | `{ battleTag, lastSeen }`: BNet presence link | last seen online |
| `self.feed`, `people[bt].feed` | activity per realm day (CF-22/23): per character `name, classFile, at, levelFrom, levelTo, quests[zone], ranks[profession], learned[profession], runs[]`. Since CF-52: `kills[zone]`, `deaths = { { t, zone, cause } }` (cause `fall`, `fire`, `lava`, `drown`, `fatigue`, `player`, `creature` or `other`; anything else is read as `other`), `duels = { { t, won, vs } }` (`vs` the opponent's full name). CF-53: `loot = { rare, epic = { { id, name, slot, level } } }` (`slot` an `INVTYPE_*` token), `notable[itemID]`, `gold = { gained, spent }` (copper, never shown as an amount), `sessions = { { from, to } }`, `groups[guid] = true`. CF-55: `pvpKills = { { t, zone, name, lvl, myLvl, class, race, rank, solo, bg } }` (`lvl` -1 is a skull; each victim field only when readable). Capped as the addon caps them (50 deaths, duels, epics and sessions, 40 groups, 100 kills per day and character). `false` from addons that had "Share my activity" (gone, Nico 2026-10-28): read as nothing sent. The last 7 realm days only | weekly recap history (WEB-41), Doomsday (E8) |
| `self.goals`, `people[bt].goals` | Doomsday goals (CF-56): `days[n]` and `weeks[w]` each `{ set, swapped[id] = originalId, done[id] = time, at }`, plus `streak`, `best`, `pool` (the pool version), `reset` (seconds after midnight realm time). Ids at most 24 characters, at most 5 per day and 4 per week; numbers 0 or more. `false` is read as nothing sent. The last 7 days and 2 weeks only | Doomsday (WEB-55, WEB-58) |
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
- The feed is read apart from the `Dataset` (`readFeeds`, `src/core/feed.ts`, WEB-41): it is history, kept per day in its own tables, not merged state. So are the Doomsday goals (`readAllGoals`, `src/core/doomsday/record.ts`, WEB-55).
- Not read yet: `runs`, `invite`, other `settings`.

## The game's items (`pending`, WEB-43)
Schema 2 (addon CF-47, CF-48): what the player did in game that has to reach the site, until the site's runs list
their ids under `received` (WEB-44). Each item: `id` (unique per player: account id, time, counter) and `at` (UTC).
| `kind` | Fields | The site |
|---|---|---|
| `plan` (own file only) | `dungeon` (the addon's id), `startsAt`, `guid`, `name`, `role`, `note` | a run, source "game", the player leading as that character (else organiser without a slot); dropped when its start has passed |
| `answer` | `run` (`r-<id>`), `answer` (`in` / `maybe` / `cant`), `guid`, `name`, `role` | the player's answer, source "game" ("N run answers") |
| `ask` | `dungeon`, `guid`, `name`, `role`, `note`; `battleTag` (optional, addon CF-51: the asker) | an ask (WEB-51) and an `askNow` bot event, only within 10 minutes of `at`. WEB-53: a friend's ask carried in another member's file (CF-51) is the asker's, by the owner of `guid`, else the person `battleTag` names; created once by its `id` (the asker's), every carrier kept (`game_item_carriers`); an asker the community's data doesn't know: `not_member` |
| `askAnswer` | `ask` (the ask's `id`), `answer` (`in` / `maybe` / `cant`), `guid`, `name`, `role` | WEB-53 (CF-51): the player's answer to that ask, source "game", as a Discord answer; `unknown_ask` when the site has no such ask, `expired` after its 10 minutes |
| `ping` | `run`, `battleTag`, `guid`, `name` (who to ping) | a `ping` bot event |

The run log (CF-23, in the feed: `feed[day][guid].runs`) decides "Ran it" (WEB-43, `src/core/runOutcome.ts`).
