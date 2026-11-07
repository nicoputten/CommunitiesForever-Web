# Everloot as a boss loot source (WEB-103 spike)

Question (Nico, 2026-11-07): can [Everloot](https://everloot.app) ([code](https://github.com/Everloot/everloot)) be
our boss loot source for WoW: Forever, either replacing cmangos or filling in where cmangos has nothing? We don't
gather drops with our own addon.

Checked on 2026-11-07 against Everloot's repository at commit `b900cb2` and the live API. The data was current as of
`2026-11-07T12:20Z`. Our side is the real item import of Forever build 1.60.1.70862: 241 bosses and 1,940 cmangos
drops. Only endpoints and limits that Everloot publishes were used, without a key, with an honest user agent naming
this repo. That took 11 of the 30 requests an hour that an address may make without a key. Nothing was downloaded
into this repo.

## Answer in short

- **Not now.** Today Everloot has drops for **4 of our 183 classic bosses**, all four in Ragefire Chasm, and for
  **0 of the 58 bosses in Forever's 9 new dungeons**. Only 2 bosses pass Everloot's own three-install rule. The whole
  public drop table is 219 rows from 23 creatures. The loot comes from 7 installs over 3 days.
- **It is the right kind of source, though.** It is observed on Forever itself, it keys bosses by the same encounter
  ID we use, its licence fits our addon's GPL-3.0 file, and it already shows that Forever changed boss loot (below).
- **Recommendation:** fill in later, never replace. Keep cmangos and add Everloot as a second, marked layer ("Forever
  data" next to "Classic data") once it covers enough bosses. A follow-up story with a trigger is in
  [the recommendation](#5-recommendation).

## 1. Access

| What | Without a key | With Nico's free key |
|---|---|---|
| `/api/rollups/drops`: drop rates that 3 or more installs agree on | 30 requests an hour per address, shared with corpus, items and edges; 500 rows a page | 2,000 requests an hour per account; 5,000 rows a page |
| `/api/corpus/public?kinds=…`: every anonymous record, 1- and 2-install ones too | the same 30 an hour | the same 2,000 an hour |
| `/api/health`, `/api/openapi.json`, `/api/items/categories`, `/api/tooltip` | no limit of their own | not needed |
| MCP server, `/api/tools/*` | 200 an hour | 2,000 an hour |
| Bulk export (`corpus.ndjson`, `drops.ndjson`, `edges.ndjson`, `items.ndjson`, made by `web/src/lib/bulk-export.ts`) and the stricter open-data export (`observed/drop-rates`, `observed/bosses`, …, made by `kb/src/open-data/`) | files in Everloot's public bucket, listed on `/database/download` | the same |

- **The key:** `Authorization: Bearer evl_…`. Nico makes it on `/docs/api/keys` after signing in with Battle.net. It
  expires after 7 to 365 days. One account can hold 5 active keys and make 10 a day. Requests are counted per key, and
  Everloot asks what the key is for. We would store it as an environment variable (rule 7) and never commit it.
- **What we hit:** `/database/download` answers scripts with a Cloudflare challenge (403). We did not work around it.
  The API serves the same rows. A 429 comes with `retry-after`, and an import must honour it.
- **Sizes today:** 3,381 loot records in 7 pages (about 950 KB of JSON), 25 encounter records in 1 page, 219 drop
  rates in 1 page and 10,000 NPC sightings (not read). So our whole boss input fits in 9 requests even without a key.
  A key is only needed once the corpus outgrows 30 pages, and is asked for only when copying "all of it" (their
  data policy).
- **Terms:** credit wherever the data appears (section 4). Bulk copying takes a free key, so they know who copies. No
  scraping of pages.

## 2. Shape

A **loot record** is one loot window that one install opened:

```json
{ "kind": "loot", "sourceNpcId": 11517, "lootType": "kill", "sourceEvidence": "loot-api",
  "copper": 9, "items": [{ "itemId": 272998, "count": 1 }], "capturedAt": "2026-11-06T16:17:02Z",
  "installId": "pub-…", "eventId": "…" }
```

- It is keyed by the **creature ID** (`sourceNpcId`) and has no encounter, instance or zone. Objects use
  `sourceObjectId` and `mapId`/`x`/`y` instead. `lootType` is `kill`, `skinning`, `gather`, `fishing`,
  `disenchant` or `container`.
- `installId` is a per-install pseudonym, never a name. The date is `capturedAt`.

A **drop rate** (`/api/rollups/drops`, the same in the open-data `drop-rates`) is
`{ sourceNpcId, itemId, kills, drops, rate, reporters }`.
- `rate` = windows with the item ÷ loot windows. Everloot itself says this is "a share of loot windows, not a
  kill-based drop chance".
- `reporters` is the number of installs, at least 3 before a rate is public. Pairs below that wait in `queued`
  (802 today).

An **encounter record** is `{ encounterId, name, instanceMapId, difficulty, size, success, capturedAt }`.
- `encounterId` is `ENCOUNTER_END`'s ID, the same as our `dungeon_bosses.id`. This was checked: Ragefire Chasm is
  2732–2735 and the Forever dungeon `thanes` is 3493–3496, in both.
- `name` is in the reporter's client language (e.g. "Durgen Martillo Funesto"), so match on the ID, never the name.
- The public records carry no creature IDs. The open-data `bosses` file adds `npcIds` once 3 installs agree.

**Mapping to `dungeon_bosses`:**
- **Encounter:** direct, by ID.
- **Drops:** they are per creature, so we need the encounter's creature(s).
  - Classic bosses: we already have them. WEB-96 matches each boss to cmangos `creature_template` by name, aliases
    included.
  - Forever's own bosses: no creature IDs anywhere we import. They would come from Everloot's open-data
    `bosses.npcIds` or from its NPC sightings, which are in the client language.
- **Caveats:**
  - Several installs in one group each open their own window on the same kill. Two installs reported identical kill
    times here, so windows aren't independent kills and small samples overcount.
  - `rate` is not cmangos' chance. A boss with 4 windows gives 25 % steps.

## 3. Coverage today

We counted bosses with at least one Everloot `kill` loot window on their creature(s), and with a public rate (3+
installs).

| | Bosses | Any Everloot drops | Public rate (3+ installs) | Encounter seen |
|---|---|---|---|---|
| Classic dungeons (cmangos has loot) | 183 | **4** (Oggleflint, Taragaman, Jergosh, Bazzalan) | **2** (Oggleflint, Taragaman) | 4 |
| Forever's 9 new dungeons (thanes, excavation, dalaran, lordaeron, drowned, kroldok, alcaz, blackmaw, shaper) | 58 | **0** | **0** | 4 (thanes, 1 install) |

- Four classic names have no creature to match, here or in our import: Ring of Law, The Seven, The Vault and Ezra
  Grimm.
- All of the loot comes from 7 installs between 2026-11-05 and 2026-11-07. 161 of the 1,937 kill windows are on
  Forever-numbered creatures (IDs of 200,000 and up). 50 of the 450 items looted are Forever's own new items.

**The three bosses asked about:** Everloot has no loot window and no encounter for any of them yet.

| Boss | Encounter | Creature | cmangos (our import) | Everloot |
|---|---|---|---|---|
| Edwin VanCleef (Deadmines) | 2747 | 639 | 10 drops: An Unsent Letter 100 %, Head of VanCleef 100 %, Cape of the Brotherhood 30 %, Corsair's Overshirt 30 %, Cruel Barb 20 %, Blackened Defias Armor 20 %, … | nothing |
| Mutanus the Devourer (Wailing Caverns) | 592 | 3654 | 14 drops: Glowing Shard 100 %, Deviate Hide 80 %, Slime-encrusted Pads, Deep Fathom Ring, Mutant Scale Breastplate 33.3 % each, … | nothing |
| Archmage Arugal (Shadowfang Keep) | 2755 | 4275 | 8 drops: Head of Arugal 100 %, Robes of Arugal 40 %, Belt of Arugal 40 %, Meteor Shard 20 %, … | nothing |

**Where it does have data, it disagrees with cmangos:**

| Boss | Everloot | cmangos |
|---|---|---|
| Oggleflint | 4 windows from 3 installs: Forever item 272998 in 3 of 4; Tigerseye (818), Short-handled Battle Axe (1812) and Forever item 272999 in 1 of 4 each | only cloth, food and world recipes |
| Bazzalan | 3 windows: Forever items 273003 and 273007 | the same |
| Taragaman | his Heart, Cursed Felblade and Crystalline Cuffs | the same |
| Jergosh | Chanting Blade and Robe of Evocation | the same |

So Forever gave at least two Ragefire bosses new loot, which cmangos (Vanilla 1.12) can never know.

The new items (272998, 272999, 273003, 273007) are in the Forever client's `Item` table but not in `ItemSparse`, so
our `items` table has no name or icon for them yet. That gap is ours, whatever the loot source.

## 4. Licence fit

- **CC BY-SA 4.0 into GPL-3.0: yes, one way.** Creative Commons declared GPLv3 a compatible licence for BY-SA 4.0
  (2015, [CC's compatible licenses](https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/)).
  An adaptation of BY-SA 4.0 material may be licensed under GPL-3.0. The addon's generated `Data\Loot.lua`, already
  GPL-3.0 because of cmangos, can hold Everloot drops. Attribution (BY-SA §3(a)) still applies. The reverse is not
  allowed: cmangos rows cannot go into a CC BY-SA file.
- **The credit line** Everloot asks for, in `docs/DATA_POLICY.md` "Using our data" and in every API answer's
  `attribution` field and `X-Everloot-Credit` header:
  > Data from Everloot (https://everloot.app), CC BY-SA 4.0.
- **Where it goes:**
  - `Data\Loot.lua`'s header, next to the cmangos line, with the data's date.
  - On the site, wherever Everloot drops appear: the Bosses & loot box (WEB-102), as the "Forever data ⓘ" mark's
    text with the link, and the recipe or item tooltip if it shows an Everloot rate.
  - `docs/SOURCE-DATA.md` "Licence and attribution".
  - The site is behind a login, but the credit goes there anyway: it is the licence's condition and cheap.
- **TRADEMARKS.md:** the name and logo are not licensed. We may say "data from Everloot" and link to it, but no logo,
  and nothing that looks like an official Everloot product.
- **THIRD_PARTY.md:**
  - Everloot's game-file layer (items, icons, tooltip text) is Blizzard's and outside CC BY-SA. We only need the
    observed layer (loot records, rates, encounters).
  - Everloot's lore archive is CC BY-SA from the Warcraft Wiki. We don't use it.
- **AGPL-3.0 code:** irrelevant as long as we only read their API and copy no code.

## 5. Recommendation

**Don't replace cmangos.** It has loot for all 183 classic bosses, and Everloot has 4.

**Fill in later, as a second marked layer.** It is the only Forever-observed source we know of, it already catches
Forever's loot changes, and it fits our model (encounter ID) and our licence. Today it would add drops for 4
bosses, one of them a final, and nothing for Forever's own dungeons. That doesn't justify the work yet.

**Proposed follow-up (a story, once the trigger is met):** "Forever loot from Everloot".
- **Trigger:** Everloot's public rates cover at least a quarter of our bosses, or any of Forever's 9 new dungeons.
  This spike's script can be re-run in a minute.
- **Import:** read `/api/rollups/drops`, plus `/api/corpus/public?kinds=encounter`, or the open-data `bosses.npcIds`
  for Forever's own bosses, during "Import item data". That is about 2 to 10 requests, with an optional
  `EVERLOOT_API_KEY` in `.env.example` and retry on 429.
- **Map:**
  - Encounter ID gives the boss.
  - The creature IDs come from cmangos for the classic bosses and from Everloot's `npcIds` for Forever's own.
  - Each drop row gets the creature's rate.
- **Merge:**
  - Keep cmangos rows.
  - Add Everloot items cmangos doesn't list.
  - Where both list an item, show cmangos' chance, plus Everloot's rate and sample size once there are at least 3
    installs.
- **Schema:** a new migration. Either `boss_drops.source` (`cmangos`/`everloot`/`both`) plus `everloot_rate`,
  `everloot_windows` and `everloot_installs`, or a separate `boss_drops_observed` table.
- **Addon:** `Data\Loot.lua` gains the Everloot credit and optional `seen`/`windows` per drop. That is a format
  change the addon must read, so it pairs with an addon story.
- **Site:** the "Forever data ⓘ" mark next to "Classic data", with the credit line. This is a design change, so it
  needs Nico's OK on the board (rule 12).
- **Tests:** the importer's mapping, the merge and the attribution, with invented fixture rows.

**Cost:** about one story of 1–2 days for the import, the merge, the migration and the Lua header. Add a small
design change for the mark and an addon story for the new fields. The items gap (Forever item IDs missing from
`ItemSparse`) is a separate, smaller story and worth doing first: Everloot's drops name items we can't show yet.

## How the numbers were made

- **Everloot:**
  - `GET /api/rollups/drops?limit=500`: all 219 rates, 1 page.
  - `GET /api/corpus/public?kinds=encounter&limit=500`: 25 records.
  - `GET /api/corpus/public?kinds=loot&offset=0…3000&limit=500`: 3,381 records.
  - Every answer carried the CC BY-SA 4.0 `attribution`.
- **Ours:**
  - `dungeon_bosses` and `boss_drops` from the real "Import item data" of build 1.60.1.70862.
  - Classic bosses matched to cmangos `creature_template` by name, with WEB-96's aliases, without the map filter
    (it makes no difference here).
- **Join:** kill loot windows whose `sourceNpcId` is one of the boss's creatures, and encounter records with
  `success` on the boss's ID.
- **Where the data was kept:** the downloads and the script stayed outside this repo. No install pseudonym or
  player data is copied here.
