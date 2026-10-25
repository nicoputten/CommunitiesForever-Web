# Source data: the addon's SavedVariables

File: `WTF/Account/<ACCOUNT>/SavedVariables/CommunitiesForever.lua`, written by the game at logout and `/reload`.
Shape: `CommunitiesForeverDB = { global = { ... }, profileKeys = ..., ... }`. Only `global` is read.

Source of truth: the addon repo, `docs/ARCHITECTURE.md` "Data model". This file lists what the site uses.

## Releases
| Addon release | `schemaVersion` | Fixture |
|---|---|---|
| v0.3 | 1 | `tests/fixtures/addon/v0.3/savedvariables.lua` |
| v0.4 | 1 | `tests/fixtures/addon/v0.4/savedvariables.lua` |

The fixtures hold `global` only (as `return { ... }`), captured from invented players. WEB-03 adds at least one real file, wrapped as the game writes it.

## What the site uses
| Field | Meaning | Used for |
|---|---|---|
| `self.battleTag`, `self.displayName` | the uploader (Nico) | person row |
| `self.chars[guid]` | own characters (`Char`) | alts |
| `people[battleTag]` | each friend: `displayName`, `chars[guid]`, `receivedAt`, `via` (relayed by), `removed[guid]` | alts, data age |
| `Char` | `guid, name, classFile, raceID, level, faction, realm, ilvl, professions[skillLineID] = {name, rank, max}, talents, mainTree, role, quests, updatedAt, lastPlayed`; later `recipes` (addon CF-38) | alts, professions |
| `locations[guid]` | `{ zone, seenAt }`: last zone seen in the community while Nico was online. Zone name text, can be a dungeon. | map |
| `presence[guid]` | `{ battleTag, lastSeen }`: BNet presence link | last seen online |
| `self.feed`, `people[bt].feed` | activity per realm day | later (backlog) |
| `runs` | Nico's runs in progress | later (backlog) |
| `settings` | `clubName` only | page title / group name |

Times are Unix seconds. Any field can be missing in older releases.
