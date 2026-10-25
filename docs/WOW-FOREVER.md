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
| New combinations for the old races: Orc Mage, Troll Warlock, Undead Paladin, Human Hunter, Gnome Priest, Dwarf Shaman | Official for Undead Paladin (trailer); the rest unverified | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |
| Racials reworked (e.g. weapon specialisations replaced) | Unverified | [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |

The site: the faction comes from the race (Skyborne: by raceID) and also from `Char.faction`. Faction must never be inferred from class.

## Classes and talents
| Change | Status | Source |
|---|---|---|
| Still the nine Vanilla classes, `classFile` tokens as in Vanilla (`UnitClassBase` → `"PALADIN"`) | Confirmed (beta client) | API-FINDINGS |
| Talents: one C_Traits tree per class holding the three Vanilla trees side by side; one specialization per class; Forever has new and changed talents | Confirmed (beta client) | API-FINDINGS V20, V29, V30 |

## Professions
| Change | Status | Source |
|---|---|---|
| The same twelve professions and skill line IDs: Mining 186 and Cooking 185 (beta), First Aid 129, Fishing 356 | Confirmed (beta client) for these four | API-FINDINGS V7, CF-12; `tests/fixtures/real/` |
| Skill 1–300, caps 75/150/225/300 (`max = 75`, `150` seen on the beta) | Confirmed (beta client) for 75 and 150; the rest unverified | API-FINDINGS; [mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic) |
| 600+ new recipes; **Camping**: every profession builds three camp objects, the first at skill 20 (quests "Camping 101: Mining", area "Camping"). Camping is part of the professions, not a profession of its own | Official (600+ recipes, per the guides citing Blizzard); camping quests seen in the real file | `tests/fixtures/real/`; [wowforeverguides](https://wowforeverguides.com/professions), [conquestcapped](https://conquestcapped.com/guides/wow-forever/wow-forever-professions/) |
| Healing potions moved from Alchemy to First Aid; primaries give the crafter a personal bonus | Unverified | [masterofwarcraft](https://www.masterofwarcraft.net/2026/09/wow-forever-whats-new-changes-classic-guide.html) |

## Zones
| Change | Status | Source |
|---|---|---|
| New zones: **Zephras Isle** (Skyborne start, 1–12), **The Riverglades** (east coast of the Eastern Kingdoms, between Burning Steppes, Redridge, Swamp of Sorrows and Badlands; mid 30s–40s), **Shen'dralas** (Kalimdor), and **Mount Hyjal** (now playable) | Official (names); locations unverified | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [wowguide.net](https://wowguide.net/en/guides/wow-forever-riverglades-zone) |
| The Vanilla zones stay, with new quests | Official | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with) |
| Zone text comes from `GetRealZoneText` / the community member's `zone`, English, as in Vanilla; inside an instance it is the instance name | Confirmed (beta client) | API-FINDINGS V35 |

Where the new zones sit, and how our map (`src/core/map/zones.json`, WEB-31) draws them. The source SVGs have no shape for them: the outlines are hand-drawn in `tools/map/build_zones.py` (`EXTRA_ZONES`) from these location texts, so the exact borders are ours.

| Zone | Location | Status | Source | On our map |
|---|---|---|---|---|
| The Riverglades | East coast of the Eastern Kingdoms, between Redridge, Burning Steppes, Badlands and Swamp of Sorrows; a gap that was off-limits in classic; about the size of Stranglethorn Vale; port town Powderfuse Port (boat from Tanaris), a road forks off in Redridge | Unverified | [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [wowguide.net](https://wowguide.net/en/guides/wow-forever-riverglades-zone) | New land east of those four zones, pushing the coast out |
| Shen'dralas | Central Kalimdor, south-east of Desolace between Feralas and Mulgore, entered from Desolace through the Valley of Bones; roughly where retail's Lake Dumont is. Another guide puts it south of Desolace, north of Dire Maul | Unverified (beta 1.60.1) | [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Shen'dralas), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones) | Carved from northern Feralas over the source's Lake Dumont, bordering Desolace and Mulgore |
| Zephras Isle | A flying island in Skywall, the elemental plane of air, not on Azeroth; skycutters to Dalaran (Alliance) and Thunder Bluff (Horde) | Official (Skywall); layout unverified | [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones), [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Zephras_Isle), [Warcraft Tavern](https://www.warcrafttavern.com/forever/guides/skyborne/) | An inset island in the sea between the continents, south of the Maelstrom (`cont` K) |
| Mount Hyjal | Kalimdor; the endgame leveling zone, after Archimonde's defeat | Official (playable); position unverified | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with), [lfcarry](https://lfcarry.com/guides/wow-forever-new-zones) | The source's Mount Hyjal shape, now a zone |
| Thousand Needles | Dry canyon and mesas, as in Vanilla (the Cataclysm flood is not part of Forever) | Official (the Vanilla zones stay) | [Game Informer](https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with) | The source's lake (an inlet with mesa islands) filled in |

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
- Boss loot reworked: unique boss items at least Rare quality. Unverified ([mmonster](https://mmonster.co/wow-forever/guides/articles/forever-vs-classic)).

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
- **Dungeon levels:**
  - The Vanilla dungeons use the addon's `Dungeons.STATIC`.
  - The four new dungeons the beta Group Finder lists use its ranges, which is what the addon shows in game.
  - The other five new dungeons use Blizzard's article.
- **Raids:** only the announced ones: Onyxia's Lair, The Barrow Deeps and Hyjal Summit. Molten Core, Blackwing Lair, Zul'Gurub, the Ahn'Qiraj raids and Naxxramas come back when Blizzard announces them.
- **Zones:**
  - Mount Hyjal, The Barrow Deeps and Hyjal Summit resolve to the Mount Hyjal zone.
  - The Riverglades (also "Riverglades") and Krol'dok Stronghold resolve to The Riverglades, Shen'dralas and Zephras Isle to their zones (WEB-31, 2026-10-25): hand-drawn shapes, Zephras Isle as an inset island because Skywall is not on Azeroth. Placements are unverified until the launch client shows the zones.
- **Battlegrounds** (Warsong Gulch, Arathi Basin, Alterac Valley, Darkspear Islands) resolve to "battleground"; other unknown text resolves to "elsewhere".
- **Rulesets:** shown as PvP or PvE. The PvP realms are the beta realm and "Forever PvP".
