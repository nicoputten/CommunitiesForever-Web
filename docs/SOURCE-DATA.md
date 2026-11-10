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
| unreleased (CF-103) | 3 | none yet: the addon's golden fixture joins `tests/fixtures/addon/` with its release |

Schema 2 adds only `global.pending`; the site reads schemas 1 and 2 with the same reader (`SUPPORTED_SCHEMA` = 2) and the pending items apart (`src/core/gameItems.ts`, WEB-43). Schema 3 (addon CF-103, WEB-97) changes only `runs[guid].bosses` (kill times instead of `true`) and adds `liveKills`; the same reader takes it (`SUPPORTED_SCHEMA` = 3). A newer schema is stored as rejected ("newer format").

The addon fixtures hold `global` only (as `return { ... }`), captured from invented players.

`tests/fixtures/real/beta-2026-10.lua`: Nico's real file from the beta (October 2026), wrapped as the game writes it and kept byte-for-byte (CRLF; `.gitattributes` marks fixtures `-text`) except for anonymization: every BattleTag, character GUID (the realm part kept), `accountId`, character name, club name and `clubId` replaced consistently with invented values.

### What the real file shows (differences from the addon fixtures)
- No `people` table at all: friends without the addon's sync appear only in `presence` and `locations`, without records. No `runs` either.
- `self` has `accountId` and no `displayName`.
- `settings.clubId` is a number (the fixtures have a string). Read it as either.
- `Char.mainTree` is a talent tree index (1), not a name. `Char.talents` is an array of `{ name, points }`, one per tree. `Char.autoRole` sits next to `role`.
- WEB-100: addon releases before CF-115 don't say which talents a character took. The addon (CF-18) reads every node of the class's C_Traits tree as `{ posX, ranks }` in game, only to add up the points per tree; `talentNodes` is not saved. `posX` alone couldn't name a talent anyway: up to seven talents share a column. The site reads `Char.talentNodes = { { id, ranks } }` (`id` = the TraitNode ID of `C_Traits.GetTreeNodes`; or `posX` with `posY` in place of `id`), the shape CF-115 adds; without it every talent tooltip is the tree-only one (A).
- `Char.quests[questID] = { title, area, dungeon }` (`area` is missing in the fixtures).
- `realm` is the beta realm name "CAMWOW EU4 Realm 2 PvP"; GUIDs of one mega-realm carry different realm IDs (`Player-6842-...`, `Player-6943-...`).
- `settings` holds UI state with floats (`window`, `tree`, `dungeonTree`), `tree.groups` keys are BattleTag + GUID concatenated.

## What the site uses
| Field | Meaning | Used for |
|---|---|---|
| `self.battleTag`, `self.displayName` | the uploader (Nico) | person row |
| `self.chars[guid]` | own characters (`Char`) | alts |
| `people[battleTag]` | each friend: `displayName`, `chars[guid]`, `receivedAt`, `via` (relayed by), `removed[guid]` | alts, data age |
| `Char` | `guid, name, classFile, raceID, level, faction, realm, ilvl, professions[skillLineID] = {name, rank, max}, talents, mainTree, role, quests, updatedAt, lastPlayed`; `pvp = { hk, rank, rankName, weekKills, weekHonor, deaths, duelsWon, duelsLost }` (CF-52: lifetime honorable kills, PvP rank 0 to 14 and the game's name for it, this week's kills and honor, lifetime deaths and duels); `riding` (CF-53: 0, 75 or 150). CF-38 (WEB-90): `recipes = { [recipeID] = itemID }` (every learned recipe of every profession, complete on each scan; `itemID` 0 when the recipe makes no item), `recipesAt` (server time of the scan), `recipeLines = { [recipeID] = skillLineID }` (own characters only, where `GetTradeSkillLineForRecipe` answers; the item database wins); per profession `link` (the bare `trade:...` payload without the `|H` wrapper, kept whole up to 4,096 characters, else dropped), `linkType` (`short` / `long`), `spec` (English specialisation name, Blacksmithing, Leatherworking or Engineering, rarely set), `scannedAt`. Friends' copies under `people[*].chars` carry `recipes` and `recipesAt` too once synced: merge takes the recipes from the copy with the newest `recipesAt` (the rest of the record still by `updatedAt`). `recipeOrder` and `recipesBase` (the addon's own bookkeeping) are not read. Older addons send none of it: read as nothing known, never as nothing learned | alts, professions, Doomsday feats (WEB-56), recipes (WEB-90) |
| `locations[guid]` | `{ zone, seenAt }`: last zone seen in the community while Nico was online. Zone name text, can be a dungeon. | map |
| `presence[guid]` | `{ battleTag, lastSeen }`: BNet presence link | last seen online |
| `self.feed`, `people[bt].feed` | activity per realm day (CF-22/23): per character `name, classFile, at, levelFrom, levelTo, quests[zone], ranks[profession], learned[profession], runs[]`. Since CF-52: `kills[zone]`, `deaths = { { t, zone, cause } }` (cause `fall`, `fire`, `lava`, `drown`, `fatigue`, `player`, `creature` or `other`; anything else is read as `other`), `duels = { { t, won, vs } }` (`vs` the opponent's full name). CF-53: `loot = { rare, epic = { { id, name, slot, level } } }` (`slot` an `INVTYPE_*` token), `notable[itemID]`, `gold = { gained, spent }` (copper, never shown as an amount), `sessions = { { from, to } }`, `groups[guid] = true`. CF-55: `pvpKills = { { t, zone, name, lvl, myLvl, class, race, rank, solo, bg } }` (`lvl` -1 is a skull; each victim field only when readable). CF-118 (pool version 6): each `pvpKills` entry may add `raceId` / `classId`, the victim's ChrRaces / ChrClasses ids next to the tokens; the site reads the ids when present, the tokens otherwise. A kill of a valid Hunt target is a Hunt kill (WEB-108). Capped as the addon caps them (50 deaths, duels, epics and sessions, 40 groups, 100 kills per day and character). `false` from addons that had "Share my activity" (gone, Nico 2026-10-28): read as nothing sent. The last 7 realm days only | weekly recap history (WEB-41), Doomsday (E8) |
| `self.goals`, `people[bt].goals` | Doomsday goals (CF-56): `days[n]` and `weeks[w]` each `{ set, swapped[id] = originalId, done[id] = time, at }`, plus `streak`, `best`, `pool` (the pool version), `reset` (seconds after midnight realm time). Ids at most 24 characters, at most 5 per day and 4 per week; numbers 0 or more. `false` is read as nothing sent. The last 7 days and 2 weeks only | Doomsday (WEB-55, WEB-58) |
| `runs` | the uploader's runs in progress per character (CF-23): only `bosses = { [encounterID] = at }` is read (CF-103, schema 3; schema 2's `true` has no time and is left out) | boss kills (WEB-97, `src/core/bossKills.ts`) |
| `liveKills` | friends' boss kills shared live (CF-103): `[guid] = { [encounterID] = at }`, kept 2 days by the addon | boss kills (WEB-97) |
| `feed.*.*.runs.*.bossKills` | CF-103, optional: `{ [encounterID] = at }`, the bosses a finished run killed (encounterID = DungeonEncounter.ID, `at` server time), next to the unchanged `bosses` count; missing on older addons (a count only) | boss kills (WEB-97): `boss_kills`, each (character, boss, time) once; a planned run's progress and the dungeon page's "Last cleared" |
| `probe` | the addon's hidden launch probe: per client flavour, per item `{ status, detail, at, build, ... }`, at most ~30 KB | the owner's download only (WEB-82): never normalized, stored or shown; read from the raw upload |
| `members` | the selected community's members (addon CF-89, the first release after v1.2.1): `[guid] = { name, seenAt }`, as the uploader's client last saw them, replaced whole on every update. Missing in v1.2.1 and older. Only the GUID keys and the newest `seenAt` are read | who is a member (WEB-85, `src/core/members.ts`) |
| `settings` | `clubName` only | page title / group name |

Times are Unix seconds. Any field can be missing in older releases.

## Internal shape
`normalize` turns a file into a `Dataset` (`src/core/model.ts`); `merge` combines two of them into the same shape, so the state after many uploads is a `Dataset` too and WEB-05 can diff two per GUID.
- `people[key]`: key is the BattleTag, or `aid:<accountId>` for someone known only through the community. `displayName` is resolved: own display name > BattleTag name part > (no BattleTag) the name of their first character by name, as the addon's Linker does > "Unknown player"; `hasRecord: false` for friends seen only in `presence`; `removed[guid] = time`.
- WEB-86: an `aid:<accountId>` person is merged into the BattleTag whose person carries the same account ID (`self.battleTag` with `self.accountId`, or a `people[battleTag]` record with `aid`), in any upload, as the addon's `Merge.absorb`: characters move over, the newer record's fields win, removals are kept. Feed days, feats and Doomsday goals stored under the `aid:` key move to the BattleTag too.
- `characters[guid]`: the `Char` fields, all optional, plus `owner` (person key, undefined when unknown) and `hasRecord` (false for a stub). `professions` and `quests` are keyed by ID strings, `talents` is a list (also when the file has `{}`), `mainTree` the 1-based index into it with `mainTreeName` resolved.
- `locations[guid] = { zone, seenAt }`, `presence[guid] = { battleTag, lastSeen }`.
- `community = { id, name }`: `id` is always a string (`settings.clubId` is a number in real files, a string in the fixtures).
- `uploader` (person key of `self`) and `version` (`self.version`).
- The feed is read apart from the `Dataset` (`readFeeds`, `src/core/feed.ts`, WEB-41): it is history, kept per day in its own tables, not merged state. So are the Doomsday goals (`readAllGoals`, `src/core/doomsday/record.ts`, WEB-55).
- Not read yet: `invite`, other `settings`; of `runs` only the kills.

## The game's items (`pending`, WEB-43)
Schema 2 (addon CF-47, CF-48): what the player did in game that has to reach the site, until the site's runs list
their ids under `received` (WEB-44). Each item: `id` (unique per player: account id, time, counter) and `at` (UTC).
| `kind` | Fields | The site |
|---|---|---|
| `plan` (own file only) | `dungeon` (the addon's id), `startsAt`, `guid`, `name`, `role`, `note` | a run, source "game", the player leading as that character (else organiser without a slot); dropped when its start has passed |
| `answer` | `run` (`r-<id>`), `answer` (`in` / `maybe` / `cant`), `guid`, `name`, `role`, `note` (optional, WEB-67 / addon CF-63) | the player's answer, source "game" ("N run answers"). `note` ("Late, start without me") is trimmed, loses control characters and WoW escapes, and is cut at 80 characters; it is stored with the answer, shown under it on the run page and sent to the bot. Without one, nothing changes |
| `ask` | `dungeon`, `guid`, `name`, `role`, `note`; `battleTag` (optional, addon CF-51: the asker) | an ask (WEB-51) and an `askNow` bot event, only within 10 minutes of `at`. WEB-53: a friend's ask carried in another member's file (CF-51) is the asker's, by the owner of `guid`, else the person `battleTag` names; created once by its `id` (the asker's), every carrier kept (`game_item_carriers`); an asker the community's data doesn't know: `not_member` |
| `askAnswer` | `ask` (the ask's `id`), `answer` (`in` / `maybe` / `cant`), `guid`, `name`, `role` | WEB-53 (CF-51): the player's answer to that ask, source "game", as a Discord answer; `unknown_ask` when the site has no such ask, `expired` after its 10 minutes |
| `ping` | `run`, `battleTag`, `guid`, `name` (who to ping) | a `ping` bot event |

The run log (CF-23, in the feed: `feed[day][guid].runs`) decides "Ran it" (WEB-43, `src/core/runOutcome.ts`).

## Item database (WEB-90)
Not from uploads: the items and recipes the site shows come from the game client's own data and cmangos, imported by
hand once per game patch (the owner's "Import item data" on the admin page, WEB-91, or `npm run import:items`; both use the newest builds wago.tools lists unless given others; built by `src/core/recipes/build.ts`,
written by `src/server/itemDb.ts`). Never scraped from Wowhead. The downloads stay in a cache folder outside the repo
(default `DATA_DIR/import-cache`) and are never committed; the tests use invented fixtures (`tests/fixtures/items/`).

Data used for the first import (2026-11-06):
| Source | What | Version |
|---|---|---|
| Blizzard's client data of **WoW: Forever**, DB2 tables as CSV from [wago.tools](https://wago.tools) | ItemSparse, Item, ItemModifiedAppearance, ItemAppearance, ItemSubClass, SkillLineAbility, SpellEffect, SpellReagents, SpellName, Spell, SpellMisc, SpellDuration, SpellRadius, SpellAuraOptions, SpellTargetRestrictions (the numbers in Use texts, WEB-95), ItemXItemEffect, ItemEffect, ManifestInterfaceData (icon file names), Faction, Map, DungeonEncounter (the bosses, WEB-96), ItemSet and ItemSetSpell (item sets, WEB-99), Lock, CreatureType, UiMapAssignment, AreaTable (where to get a reagent, WEB-98), TraitNode, TraitNodeEntry, TraitNodeXTraitNodeEntry, TraitDefinition, TraitNodeGroupXTraitNode, TraitNodeGroupXTraitCond, TraitCond, SkillLineXTraitTree, SkillRaceClassInfo, TalentTab, TraitEdge, TraitDefinitionEffectPoints, CurvePoint (the talent trees, WEB-100) | product `wowf`, build **1.60.1.70790** (the Forever client: WOW_PROJECT_ID 18, Interface 16001, the same build number) |
| The Classic Era client, same export | SkillLineAbility (recipes Forever has that Era lacks are Forever's own), SpellEffect with Effect 36 (what cmangos' trainer and recipe-item spells teach: Forever's client no longer has those spells) | `wow_classic_era` 1.15.9.70576 |
| [cmangos classic-db](https://github.com/cmangos/classic-db), `Full_DB/ClassicDB_1_12_1_z2815.sql.gz` | where each recipe is learned (`npc_trainer`, `npc_vendor`, the loot tables, `quest_template`), the bosses' own loot (`creature_loot_template`, WEB-96), where to get a reagent (`npc_vendor`, the loot tables, `skinning_loot_template`, `gameobject_template`, `creature` and `gameobject` spawns, WEB-98), and the tooltip numbers ItemSparse no longer has as flat values (armor, stats, resistances, durability, weapon damage and speed), as of Vanilla 1.12 | commit `28ef625` (2024-01-17) |

wago.tools cuts long CSV exports off after a few seconds; the script asks for rows in ID order (`sort[ID]=asc`) and
continues after the last whole row (`filter[ID]=>last`) until a download ends cleanly.

**Licence and attribution.** cmangos classic-db is © the CMaNGOS project, licensed GPL-3.0. The site imports facts from
it (which NPC teaches or sells a recipe, which creature drops it, an item's armor and stats) into its own database at
run time; no cmangos file or row is committed to this repo, and the downloaded dump stays in the import cache. The
client data is Blizzard's, read through wago.tools.

What the import makes (2026-11-06, build 70790): 2,483 recipes of the nine recipe skill lines (the crafting professions,
Cooking, First Aid, Mining for Smelting), 926 of them Forever's own (not in Classic Era, spell IDs mostly from 1,229,432
on); 2,693 items (what recipes make and use; 335 of Forever's items have no name in the client data yet); 1,286 sources.
- **Recipes:** SkillLineAbility rows of those skill lines whose spell creates an item (SpellEffect 24) or enchants one
  (53). Thresholds: orange = the lowest skill a source needs (the recipe item's `RequiredSkillRank`, else the trainer's
  `reqskillvalue`, never above yellow; else `MinSkillLineRank`), yellow = `TrivialSkillLineRankLow`, grey =
  `TrivialSkillLineRankHigh`, green = (yellow + grey) / 2 rounded down.
- **Removed and unobtainable:** a Classic Era recipe that nothing teaches (no trainer, vendor, loot or quest in cmangos,
  360 of them) is kept with `obtainable = false`, so a character who knows one still shows it, but it counts in no
  total and never as "Nobody has". Forever's own recipes count as obtainable; where they are learned is not known yet.
- **Sources:** trainer (also recipes learned with the profession, AcquireMethod 1); vendor, `vendor_limited` (limited
  stock), rep (the recipe item needs a standing: faction and rank); drop (a creature's, chest's or container's loot,
  through reference tables; the dungeon or raid when all its creatures are in one; the creatures when at most three,
  else a world drop); quest (a reward, or a reward spell that teaches it). `is_rare` is true for drop and rep.
- **Use, Equip and Chance on hit lines (WEB-95):** the item's spells (ItemXItemEffect, else cmangos' `spellid_N`), each
  spell's description with its tokens filled from the client's spell tables as the game's tooltip does
  (`src/core/recipes/spellText.ts` lists every token and its source): points (a potion's spread as "1050 to 1750"),
  durations in the tooltip's words ("1 hour", "2 hrs", "10 min", "15 sec"), totals over a duration (5 sec ticks for food
  and drink), periods, radii, proc chance and cooldown, other spells' numbers and descriptions, level conditions read at
  the level cap. A token the data can't fill is dropped and the line kept.
- **Icons:** the client's icon file id (Item, else the item's default appearance) mapped to its file name with
  ManifestInterfaceData (Blizzard's own list, so no community listfile is needed), served by the icon cache
  (`/api/item-icons/<name>`, docs/ARCHITECTURE.md).
- **Uploads fill the gaps** (amendment 2): a recipe or item the database doesn't have is stored from the uploaded
  recipe -> item pair (origin `upload`, without a name), until an import has it.

### Item sets (WEB-99)
Built by `src/core/recipes/itemSets.ts` in the same import, written in the same transaction. The item data of an import
before WEB-99 has no sets; they come with the next "Import item data".
- **`item_sets`** (id = `ItemSet.ID`, name, items JSON `[{id, name}]`, bonuses JSON `[{threshold, text}]`): the Forever
  client's `ItemSet` rows with at least one piece among `items`. The pieces in the client's order (`ItemID_0..16`),
  named from ItemSparse, else cmangos' `item_template`; a piece without a name keeps none (the tooltip shows "Item
  <id>"). The bonuses are the set's `ItemSetSpell` rows (`SpellID`, `Threshold`), the spell's description filled in as
  the Use and Equip lines are (WEB-95); a bonus whose text can't be filled is left out, sorted by threshold. Forever's
  own copies of a Classic set (new item IDs, e.g. "Cenarion Raiment" 2142 next to Classic's 205, both in build 70790)
  are rows of their own, so each is a set. 545 sets on build 70790, up to 9 pieces.
- **An item's set** is `items.data.setId`: ItemSparse's `ItemSet`, else the lowest set that lists it (one item, 221785,
  is listed by two sets). The tooltip shows it (`withSets` in `src/server/recipeViews.ts`); nobody's gear is known, so
  the count is always 0.

### Dungeon bosses and their loot (WEB-96)
Built by `src/core/recipes/bosses.ts` in the same import, written in the same transaction (an import with the same
data changes nothing; a new one replaces every row). The item data of an import before WEB-96 stays valid; it gets the
bosses with the next "Import item data".
- **`dungeon_bosses`** (id = `DungeonEncounter.ID`, dungeon_id, wing_id, position, name, final, optional): the Forever
  client's `DungeonEncounter` rows of the base difficulties (`DifficultyID` 0 and 1; the others are Season of
  Discovery's), in `OrderIndex` order per dungeon. The instance's `MapID` is matched to our dungeons
  (`src/core/gamedata/dungeons.ts`, dungeons only, no raids) by the client's map name, a leading "The" ignored. The
  `ID` is the `encounterID` of the game's `ENCOUNTER_END` (the addon's docs/API-FINDINGS.md V35 logged `3353,
  Witherfang` in Ruins of Lordaeron; build 70862 has exactly that row), so it is the key the addon's kill times
  (CF-103 `bossKills`) use. Hand-made in `src/core/gamedata/bosses.ts` (cited from warcraft.wiki.gg): the final boss
  per dungeon ("Cleared" = it died), the optional bosses (not counted in "N of M"), the wing of each Scarlet
  Monastery, Blackrock Spire, Stratholme and Dire Maul boss (the client has one map for each; each wing has its own
  final). Without a hand-made final (Forever's own
  dungeons), or when the client renamed it, the last boss the client lists is the final. 241 bosses on build 70862.
- **`boss_drops`** (boss_id, item_id, position, chance, class_id, subclass_id, classes, quest_id, recipe_id, skill,
  line): the boss's
  own rows in cmangos `creature_loot_template` (its `creature_template` by name, spawned on the instance's map, else
  one spawned nowhere: a summoned boss; plus the creatures of an encounter fought together, e.g. Mograine with
  Whitemane). Reference tables (shared world drops) are left out. Chance in percent, one decimal: cmangos'
  `ChanceOrQuestChance`, negative for a quest drop; a 0 in a loot group shares what the group's other rows leave of
  100 %. Kept: 1 % or more, plus quest items and recipes at any chance (at least 0.1). Sorted highest chance first.
  `classes` = AllowableClass (the client's ItemSparse, else cmangos), null for every class. `quest_id` = the quest that
  asks for a quest drop (`ReqItemId1..4`, lowest ID). `recipe_id` = the recipe a recipe item teaches (as WEB-90); for a recipe drop also `skill` (to learn it: the recipe item's
  RequiredSkillRank, else the recipe's orange, as the recipe drawer shows) and `line` (the profession's skill line),
  for "Can learn" (migration `0031_boss_drop_skill`).
  The dropped items join `items` (names, icons, tooltips). Forever's own dungeons aren't in cmangos: no loot. A few
  encounters have no creature (Blackrock Depths' Ring of Law, The Vault, The Seven): no loot. 1,940 drops on build
  70862.

### Where to get a reagent (WEB-98)
Built by `src/core/recipes/reagentSources.ts` in the same import, written in the same transaction, for every item a
recipe uses. An import before WEB-98 has none: the drawer then shows no sources at all (not "No known source") until
the next "Import item data". **`reagent_sources`** (item_id, kind, position, name, zone, chance, recipe_id,
creature_type, min_level, max_level; migration `0034_reagent_sources`), a few per kind, best first (`position`):
- **`vendor`, `vendor_limited`** (3 each): cmangos `npc_vendor` and `npc_vendor_template` (through
  `creature_template.VendorTemplateId`); `maxcount` > 0 is a limited stock that restocks. One row per NPC name; spawned
  NPCs first, then those whose zone is known, then the NPC's level nearest the reagent's item level. `zone`: the
  first spawn point's zone, the smallest of the Forever client's `UiMapAssignment` rectangles that holds it (Region_0..2
  the minimum x, y, z, Region_3..5 the maximum) whose `AreaTable` row is a zone (`ParentAreaID` 0); inside an instance
  the map's name.
- **`crafted`** (3): the obtainable recipes that make it (`recipes.created_item_id`), the lowest skill first.
- **`skinning`** (1): cmangos `skinning_loot_template` through `creature_template.SkinningLootId`. The creatures whose
  chance is at least half the best one's: their most common type (the client's `CreatureType` name) and their level
  range.
- **`herbalism`, `mining`** (2 each): chest-type objects (`gameobject_template` type 3; `data0` the lock, `data1` the
  loot) whose lock (the client's `Lock`: a key of type 2 is a skill, its index a `LockType`, 2 Herbalism, 3 Mining)
  needs the skill, and whose `gameobject_loot_template` has the reagent. One row per node name, spawned nodes first,
  the best chance first.
- **`drop`** (2): cmangos `creature_loot_template` through `creature_template.LootId`, with reference tables. `chance`
  in percent (two decimals): a row's `ChanceOrQuestChance` (below 0: quest only, left out); a 0 in a loot group shares
  what the group's other rows leave of 100 %; a reference row multiplies its chance into the reference table's. One
  row per creature name, spawned creatures only (when any is), creatures with 3 or more spawn points first (a unique
  NPC with a 100 % cloth drop is no place to farm cloth), then the best chance, then the level nearest the item level.
- None: an item none of these know (disenchanting materials, fished fish, Forever's own items, quest items): no rows,
  "No known source".

The drawer and `/craft` pick at most 3 (`src/core/views/reagentSources.ts`, Nico's order: a vendor without a stock
limit, crafted by someone in the group, skinning, herbalism, mining, a limited vendor, crafted by nobody yet, a drop),
one line per kind except crafted (one per recipe). Build 70862: 588 reagents, 471 with a source, 1,092 rows.

### Talent trees (WEB-100)
Built by `src/core/talents/build.ts` in the same import (and transaction) from the Forever client's tables: SkillLineXTraitTree and SkillRaceClassInfo (which class a TraitTree is), TraitNode, TraitNodeXTraitNodeEntry, TraitNodeEntry, TraitDefinition (the talents, ranks, spells), TraitNodeGroupXTraitNode, TraitNodeGroupXTraitCond and TraitCond (the three trees and the row gates), TalentTab (the trees' names, left to right, and icons), TraitEdge (prerequisites), TraitDefinitionEffectPoints and CurvePoint (a rank's numbers), and SpellMisc with ManifestInterfaceData (icons, as the items'). Forever's talents are this C_Traits tree, which the addon reads; the Vanilla `Talent` table is still in the client but holds Vanilla's trees (docs/WOW-FOREVER.md "Classes and talents").
- **`talent_trees`** (class_file, data; migration `0035_talent_trees`): per class its three trees, each with its own grid (its rightmost column and lowest row: 4 × 7, Destruction 3 × 7, Discipline 4 × 5 on build 70790) and icon, each talent with its TraitNode ID, name (TraitDefinition's override, else the spell's), icon, max ranks, row and column (from PosX / PosY on the 600-unit grid; a tree's first column is its leftmost talent's; 3 nodes of build 70790 sit off the grid and are listed without a place), the points its row needs (TraitCond), its prerequisites (TraitEdge types 2 and 3, within its tree), and its text per rank: the spell's description (WEB-95's `spellText`) with each effect's points from its rank curve (an effect without a curve keeps the spell's points). Warlock's rows, columns, ranks, gates and prerequisites were checked against everloot.app's trees; the texts against the game's Vanilla values (Bane 0.1 to 0.5 sec).
- **Icons** of talents and trees are served by the item icon route (`/api/item-icons/<name>`), which also accepts a name the talent trees hold.
- Data imported before WEB-100 has no talent trees: tooltips are tree-only (A) until the next "Import item data".

- **The addon's loot file** (`npm run export:addon-loot -- <out>`, `scripts/export-addon-loot.ts`,
  `src/core/recipes/addonLoot.ts`): `Data\Loot.lua` for the addon (the shared dungeons contract), keyed by the addon's
  dungeon ids (a wing's own id: smgy, smlib, smarm, smcath, lbrs, ubrs, stratlive, stratud, dmeast, dmwest, dmnorth;
  never the whole-instance `strat` or `dme`; Forever's dungeons "lfg" + activity; dungeons
  the addon has no id for are left out). Deterministic, Lua 5.1 strings. **It is GPL-3.0:** its loot comes from
  cmangos classic-db, so its header carries the GPL-3.0 notice, the cmangos attribution (URL and commit), the Forever
  build and a "generated, don't edit" line. It is generated at release and committed to the addon only; this repo
  commits no generated loot (the sample in `tests/fixtures/addon-loot/` is invented data).
