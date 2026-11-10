# WoW: Forever: biggest changes from Vanilla

What the site needs to know about how World of Warcraft: Forever differs from Vanilla (1.12) and Classic Era. This is the reference for game data (CLAUDE.md rule 10): `src/core/gamedata` follows it, and every table names its source.

Status per claim:
- **Confirmed (beta client)**: verified with the addon on the beta client (`CommunitiesForever/docs/API-FINDINGS.md`, build `1.60.1 70450`, Oct 15 2026) or seen in Nico's real file (`tests/fixtures/real/`).
- **Official**: stated by Blizzard (news.blizzard.com, Blizzard forums).
- **Unverified**: fan sites or datamined client data only. Treat as provisional until the beta client or Blizzard confirms it.

Launch: November 4, 2026; the first raids open December 9, 2026 ([Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [Blizzard raid overview](https://news.blizzard.com/en-us/article/24303009/world-of-warcraft-forever-raid-overviewlocations-raid-sizes-and-attunement)). Official.

## Realms and rulesets
| Change | Status | Source |
|---|---|---|
| No realm list. There is one mega-realm per ruleset per region; GUIDs on one mega-realm carry different server IDs (`Player-4613-…`, `Player-4619-…`) | Confirmed (beta client) | API-FINDINGS V35; `tests/fixtures/real/` |
| Rulesets: Normal, PvP, Roleplaying and Roleplay-PvP; Hardcore after launch | Unverified | [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |
| Realm name on the beta: "Classic Beta PvP" (`GetRealmName`) and "CAMWOW EU4 Realm 2 PvP" (`Char.realm` in the real file) | Confirmed (beta client) | API-FINDINGS; `tests/fixtures/real/beta-2026-10.lua` |
| Launch PvP realm name: "Forever PvP" | Nico, 2026-10-25 | |
| Character names have two parts (first + last), unique per region | Confirmed (beta client) | API-FINDINGS (`UnitName`) |
| On the PvP ruleset all of an account's characters belong to one faction | Unverified | [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |

## Level cap
| Change | Status | Source |
|---|---|---|
| Level cap 60, no level scaling, no flying | Official (content covers 1–60); scaling and flying unverified | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |
| Talent points: one per level from 10 (level − 9, 51 at 60); a tree's deepest talent needs 31 points | Vanilla rule, kept by the site (`src/core/gamedata/levels.ts`, docs/DESIGN.md §8); not confirmed for Forever's changed talents | [warcraft.wiki.gg Talent](https://warcraft.wiki.gg/wiki/Talent) |

## Races
| Change | Status | Source |
|---|---|---|
| New race **Skyborne** (shen'dorei, "hidden people"), neutral: the player picks Alliance or Horde at creation. Starting zone Zephras Isle, levels 1–12 | Official | [Blizzard forums: Meet the New Skyborne](https://us.forums.blizzard.com/en/wow/t/wow-forever-meet-the-new-skyborne/2358236) (Sep 22, 2026) |
| Skyborne raceIDs: **95** "High Order Skyborne" (Alliance), **96** "Windshaper Skyborne" (Horde), race token `Skyborne` | Unverified (datamined: ChrRaces and CharBaseInfo, build 1.60.1.70374, wago.tools) | [nazumods/wow#1000](https://github.com/nazumods/wow/pull/1000), [wow4ever.quest](https://wow4ever.quest/en/races/skyborne-windshapers) |
| Skyborne classes: Druid, Hunter, Mage (Alliance only), Rogue, Shaman (Horde only), Warrior | Unverified | [mobalytics](https://mobalytics.gg/wow-forever/guides/wow-forever-race-class-combinations), [Icy Veins](https://www.icy-veins.com/wow-forever/news/all-new-race-and-class-combos-and-racial-abilities-in-wow-forever-official/) |
| Hunt targets from pool version 6 (WEB-108, addon CF-118): High Order Skyborne (95, Alliance) Warrior, Hunter, Rogue, Mage, Druid; Windshaper Skyborne (96, Horde) Warrior, Hunter, Rogue, Shaman, Druid; 28 race and class targets per faction in all | Unverified (game files, build 1.60.1.70862) | [Everloot class_races](https://everloot.app/classes/mage) (checked 2026-11-10) |
| New combinations for the old races: Orc Mage, Troll Warlock, Undead Paladin, Human Hunter, Gnome Priest, Dwarf Shaman | Official for Undead Paladin (trailer); all six in the game files of build 1.60.1.70862 (the addon's CF-116); the Doomsday Hunt draws these 23 combinations per faction from pool version 5 (WEB-106, `src/core/doomsday/rules.ts`) | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic), [CommunitiesForever#263](https://github.com/nicoputten/CommunitiesForever/pull/263) |
| Racials reworked (e.g. weapon specialisations replaced) | Unverified | [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |

The site: the faction comes from the race (Skyborne: by raceID) and also from `Char.faction`. Faction must never be inferred from class.

## Classes and talents
| Change | Status | Source |
|---|---|---|
| Still the nine Vanilla classes, `classFile` tokens as in Vanilla (`UnitClassBase` → `"PALADIN"`) | Confirmed (beta client) | API-FINDINGS |
| Talents: one C_Traits tree per class holding the three Vanilla trees side by side; one specialization per class; Forever has new and changed talents | Confirmed (beta client) | API-FINDINGS V20, V29, V30 |
| The talent trees (WEB-100): the class's TraitTree (SkillLineXTraitTree) holds three node groups without a condition, one per tree, left to right as TalentTab's OrderIndex (Warlock: Affliction, Demonology, Destruction); 4 columns × 7 rows of 600 units per tree, rows gated 5 points apart (TraitCond). Destruction has 16 talents, 3 columns used (Destructive Reach, Molten Skin, Bane of Havoc, Fire and Brimstone are new). The Vanilla `Talent` / `TalentTab` rows are still in the client (Vanilla's trees, rank spells that no longer exist): only the tree names are read from TalentTab. Hunter has 2 nodes and Priest 1 far off the grid (PosX 102800, PosY 39300 / 21300) | Found in game files, build 1.60.1.70790; same layout as everloot.app/tools/talents (build 70862) | wago.tools DB2 `wowf` 1.60.1.70790; [everloot.app talents](https://everloot.app/tools/talents/warlock) |
| A talent has one spell for all its ranks (Improved Shadow Bolt's Vanilla rank 3 spell 17801 is gone from the client). A rank's numbers come from TraitDefinitionEffectPoints (OperationType 0, set) and its Curve: CurvePoint Pos_0 = rank, Pos_1 = the effect's points (Improved Shadow Bolt 4, 8, 12, 16, 20; Bane 0.1 to 0.5 sec; Cataclysm 3, 6, 10 %: not always linear). The spell's own SpellEffect points are the top rank's | Found in game files, build 1.60.1.70790 | wago.tools DB2 `wowf` 1.60.1.70790 (TraitDefinitionEffectPoints, CurvePoint, SpellEffect) |
| Prerequisites (WB101 arrows): TraitEdge from the needed talent to the one it opens; Type 2 (sufficient: one of them is enough) for 84 edges, Type 3 (required) for 2, Type 0 (a visual line) for 13 (all trees, not only classes). In the 9 class trees every requirement edge runs straight down (72) or across (2, Paladin). The site counts a prerequisite once it has every rank, the Vanilla rule (and C_Traits' "a parent fully purchased") | Edges found in game files, build 1.60.1.70790; the full-rank rule is Vanilla's, unconfirmed for Forever | wago.tools DB2 `wowf` (TraitEdge); [warcraft.wiki.gg Talent](https://warcraft.wiki.gg/wiki/Talent) |
| Grid per tree (rightmost column × lowest row used): every tree 4 × 7, except Warlock Destruction 3 × 7 and Priest Discipline 4 × 5 | Found in game files, build 1.60.1.70790 | wago.tools DB2 `wowf` (TraitNode) |
| Icons: a talent's is its spell's SpellMisc.SpellIconFileDataID (TraitDefinition.OverrideIcon where set), a tree's TalentTab.SpellIconID, named through ManifestInterfaceData; every talent of the nine classes has one | Found in game files, build 1.60.1.70790 | wago.tools DB2 `wowf` |
| TalentTab has no tree descriptions (Description_lang empty) | Found in game files, build 1.60.1.70790 | wago.tools DB2 `wowf` |

## Professions
| Change | Status | Source |
|---|---|---|
| The same twelve professions and skill line IDs: Mining 186 and Cooking 185 (beta), First Aid 129, Fishing 356 | Confirmed (beta client) for these four | API-FINDINGS V7, CF-12; `tests/fixtures/real/` |
| Skill 1–300, caps 75/150/225/300 (`max = 75`, `150` seen on the beta) | Confirmed (beta client) for 75 and 150; the rest unverified | API-FINDINGS; [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |
| 600+ new recipes (the client has 926 recipes that Classic Era lacks, WEB-90: `docs/SOURCE-DATA.md` "Item database"); **Camping**: every profession builds three camp objects, the first at skill 20 (quests "Camping 101: Mining", area "Camping"). Camping is part of the professions, not a profession of its own | Official (600+ recipes, per the guides citing Blizzard); camping quests seen in the real file | `tests/fixtures/real/`; [wowforeverguides](https://wowforeverguides.com/professions), [conquestcapped](https://conquestcapped.com/guides/wow-forever/wow-forever-professions/) |
| Healing potions moved from Alchemy to First Aid (First Aid's Minor to Major Healing Potion, spells 1244431–1244436; Alchemy keeps "Discolored" healing potions); primaries give the crafter a personal bonus | Healing potions: datamined (client data, build 1.60.1.70790, WEB-90); the bonus unverified | [masterofwarcraft](https://www.masterofwarcraft.net/2026/09/wow-forever-whats-new-changes-classic-guide.html) |

## Zones
| Change | Status | Source |
|---|---|---|
| New zones: **Zephras Isle** (Skyborne start, 1–12), **The Riverglades** (east coast of the Eastern Kingdoms, between Burning Steppes, Redridge, Swamp of Sorrows and Badlands; mid 30s–40s), **Shen'dralas** (Kalimdor), and **Mount Hyjal** (now playable) | Official (names); Mount Hyjal, The Riverglades and Shen'dralas located on Forever's continent maps (WEB-77), Zephras Isle's layout unverified | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [wowguide.net](https://wowguide.net/en/guides/wow-forever-riverglades-zone) |
| The Vanilla zones stay, with new quests | Official | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with) |
| Zone text comes from `GetRealZoneText` / the community member's `zone`, English, as in Vanilla; inside an instance it is the instance name | Confirmed (beta client) | API-FINDINGS V35 |
| The continent maps are Vanilla's: Vanilla coasts and zone borders, plus Mount Hyjal, The Riverglades and Shen'dralas. No Uldum, no Grim Batol area; Quel'Thalas is land north of Eastern Plaguelands without a zone; Alterac Mountains has its own border | Confirmed (Forever's in-game maps) | warcraft.wiki.gg [Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison) (`WorldMap-Kalimdor_c60.jpg`, `WorldMap-EasternKingdoms_c60.jpg`) |

Where the new zones sit, and how our map (`src/core/map/zones.json`) draws them. Since WEB-77 the map's coasts and zone borders are traced from Forever's continent maps ([Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison), `tools/map/README.md`), so the Riverglades, Shen'dralas and Mount Hyjal have Forever's own shapes; until then (WEB-31) they were hand-drawn from the location texts. Zephras Isle is on no continent map and stays hand-drawn (`EXTRA_ZONES` in `tools/map/build_zones.py`). Quel'Thalas, land without a zone on Forever's map, is drawn as terrain like Gilneas.

| Zone | Location | Status | Source | On our map |
|---|---|---|---|---|
| The Riverglades | East coast of the Eastern Kingdoms, between Redridge, Burning Steppes, Badlands and Swamp of Sorrows; a gap that was off-limits in classic; about the size of Stranglethorn Vale; port town Powderfuse Port (boat from Tanaris), a road forks off in Redridge | Confirmed (Forever's continent map draws it there) | [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [wowguide.net](https://wowguide.net/en/guides/wow-forever-riverglades-zone), [Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison) | Forever's shape: east of Burning Steppes, south of Badlands, north of Redridge and Swamp of Sorrows, out to its own east coast |
| Shen'dralas | Central Kalimdor, south-east of Desolace between Feralas and Mulgore, entered from Desolace through the Valley of Bones; roughly where retail's Lake Dumont is. Another guide puts it south of Desolace, north of Dire Maul | Position from Forever's continent map; its small bordered area between Desolace, Mulgore and Feralas is taken to be Shen'dralas (not labelled there) | [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Shen'dralas), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison) | Forever's shape: that small area between Desolace, Mulgore and Feralas |
| Zephras Isle | A flying island in Skywall, the elemental plane of air, not on Azeroth; skycutters to Dalaran (Alliance) and Thunder Bluff (Horde) | Official (Skywall); layout unverified | [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Zephras_Isle), [Warcraft Tavern](https://www.warcrafttavern.com/forever/guides/skyborne/) | An inset island in the sea between the continents, south of the Maelstrom (`cont` K) |
| Mount Hyjal | Kalimdor; the endgame leveling zone, after Archimonde's defeat | Official (playable); position from Forever's continent map | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison) | Forever's shape: the bordered area between Felwood, Winterspring, Azshara and Ashenvale |
| Thousand Needles | Dry canyon and mesas, as in Vanilla (the Cataclysm flood is not part of Forever) | Official (the Vanilla zones stay) | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with) | Forever's shape: dry, from Feralas to the east coast (the Shimmering Flats) |

## Dungeons
Nine new five-player dungeons next to the Vanilla ones ([Blizzard: Explore the New Dungeons](https://news.blizzard.com/en-us/article/24301455/explore-the-new-dungeons-of-world-of-warcraft-forever), official):

| Dungeon | Blizzard levels | Beta Group Finder levels (confirmed) | Location (Blizzard) |
|---|---|---|---|
| Hall of Thanes | 13–18 | 13–20 (activity 1984, map 3065) | Dun Morogh, beneath Ironforge |
| Ruins of Lordaeron | 15–20 | 15–22 (activity 1982, map 2999) | Tirisfal Glades, above the Undercity |
| Excavation Site | 24–29 | "Excavation Site: Wetlands" 26–33 (activity 1981, map 2998) | Wetlands, above Whelgar's Excavation |
| City of Dalaran | 28–33 | 28–35 (activity 1983, map 2959) | Alterac Mountains |
| The Drowned City | 35–40 | | off the coast of Stranglethorn Vale, west of Grom'gol |
| Krol'dok Stronghold | 40–45 | | The Riverglades |
| Alcaz Prison | 48–53 | | Alcaz Island, Dustwallow Marsh |
| Blackmaw Hold | 55–60 | | Azshara |
| Shaper's Terrace | 58–60 | | northern hills of Un'Goro Crater |

- The beta Group Finder (API-FINDINGS V46, Oct 18) listed 29 dungeon activities: the Vanilla ones plus the first four above. The addon takes its runtime ranges from it (`Dungeons.applyGroupFinder`).
- Inside Ruins of Lordaeron, `GetInstanceInfo()` names it "Ruins of Lordaeron" (instanceID 2999). Confirmed (beta client).
- Bosses per dungeon (for Doomsday's "Clear every boss of a dungeon"): the site uses the addon's `Goals.BOSSES` (from the game's DungeonEncounter table, Classic Era, checked 2026-10-28) as `DUNGEON_BOSSES` in `src/core/doomsday/rules.ts`. Dungeons with wings or optional bosses and Forever's new dungeons have no count until launch; no progress shows for them.
- Boss loot reworked: unique boss items at least Rare quality. Unverified ([mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic)).
- Bosses on the Forever client (WEB-96, build 1.60.1.70862, its DungeonEncounter table): every Vanilla dungeon and all nine new ones have a boss list; map names "The Shaper's Terrace" and "The Hall of Thanes" carry a "The". `ENCOUNTER_END`'s encounterID is DungeonEncounter.ID (`3353, Witherfang` in Ruins of Lordaeron, API-FINDINGS V35). Final and optional bosses: `src/core/gamedata/bosses.ts` (warcraft.wiki.gg). The client's GroupFinderActivity names the wings: 813 "Dire Maul (East)" (54-60), 814 "Dire Maul (West)" (56-60), 815 "Dire Maul (North)" (56-60), 816 "Stratholme (Main Gate)" and 1603 "Stratholme (Service Gate)" (58-60). Loot shown is Classic 1.12's (cmangos), so the rework above isn't reflected; Forever's new dungeons have no loot data yet. Since WEB-102 the site plans and shows these wings as dungeons of their own with those ranges (`src/core/gamedata/dungeons.ts`, Nico 2026-11-07); a dungeon fits a character from 2 levels below its minimum (the addon's rule, CF-106).

## Raids
| Raid | Size | Location | Status | Source |
|---|---|---|---|---|
| The Barrow Deeps | 10 | beneath Mount Hyjal, entrances through Mount Hyjal, Winterspring and Blackmaw Hold | Official | [Blizzard raid overview](https://news.blizzard.com/en-us/article/24303009/world-of-warcraft-forever-raid-overviewlocations-raid-sizes-and-attunement) |
| Hyjal Summit | 20 | summit of Mount Hyjal, near Nordrassil | Official | same |
| Onyxia's Lair | 40 | Dustwallow Marsh (Drakefire Amulet in the bags) | Official | same |

All level 60, opening December 9, 2026. Molten Core, Blackwing Lair, Zul'Gurub, Ahn'Qiraj and Naxxramas are not announced for Forever; two more new raids are said to follow in spring 2027 (unverified, [lfcarry](https://lfcarry.com/guides/wow-forever-raids)).

## Battlegrounds
| Change | Status | Source |
|---|---|---|
| New battleground **Darkspear Islands** | Official | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with) |
| Battlegrounds mix rulesets (except Hardcore) | Unverified | [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |

## What this means for the site
Decided by Nico (2026-10-25) where the sources leave a choice:
- **Races:** Skyborne under both raceIDs (95 Alliance, 96 Horde). Marked unverified until an upload shows a Skyborne character.
- **Professions:** no new skill line. Camping is quest and recipe content, not a profession.
- **Roles per class** (WEB-47, `CLASS_ROLES` in `src/core/gamedata/classes.ts`, decided with Nico 2026-10-27): Warrior tank and damage; Paladin and Druid tank, healer and damage; Priest and Shaman healer and damage; Mage, Warlock, Hunter and Rogue damage. As in Vanilla; Forever announced no change to class roles.
- **Dungeon levels:**
  - The Vanilla dungeons use the addon's `Dungeons.STATIC`.
  - The addon's dungeon ids (WEB-44, for the planned runs file): the Vanilla ones as `Dungeons.STATIC` (Blackrock Spire is `lbrs` and `ubrs` there; the site's one Blackrock Spire is sent as `lbrs`), the four new dungeons the beta Group Finder lists as `lfg` plus their activity (`lfg1984` Hall of Thanes, `lfg1982` Ruins of Lordaeron, `lfg1981` Excavation Site, `lfg1983` City of Dalaran). The other five new dungeons have no addon id yet and are sent with the site's id and their name.
  - Scarlet Monastery is four dungeons for who fits (WEB-32): Graveyard 26–36, Library 29–39, Armory 32–42, Cathedral 35–45, the addon's `Dungeons.STATIC` entries `smgy`, `smlib`, `smarm` and `smcath` (Group Finder activities 805, 829, 827, 828). Forever announced no change to them; the beta Group Finder findings (API-FINDINGS V46) list no other ranges. The client's zone text is "Scarlet Monastery" in every wing, so the map keeps one place.
  - The four new dungeons the beta Group Finder lists use its ranges, which is what the addon shows in game.
  - The other five new dungeons use Blizzard's article.
- **Raids:** only the announced ones: Onyxia's Lair, The Barrow Deeps and Hyjal Summit. Molten Core, Blackwing Lair, Zul'Gurub, the Ahn'Qiraj raids and Naxxramas come back when Blizzard announces them.
- **Zones:**
  - Mount Hyjal, The Barrow Deeps and Hyjal Summit resolve to the Mount Hyjal zone.
  - The Riverglades (also "Riverglades") and Krol'dok Stronghold resolve to The Riverglades, Shen'dralas and Zephras Isle to their zones (WEB-31, 2026-10-25). Since WEB-77 the Riverglades and Shen'dralas have the shapes of Forever's continent maps; Zephras Isle stays a hand-drawn inset island because Skywall is not on Azeroth.
- **Battlegrounds** (Warsong Gulch, Arathi Basin, Alterac Valley, Darkspear Islands) resolve to "battleground"; other unknown text resolves to "elsewhere".
- **Rulesets:** shown as PvP or PvE. The PvP realms are the beta realm and "Forever PvP".
