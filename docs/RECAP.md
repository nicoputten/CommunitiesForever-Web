# Milestones and the weekly recap

The full catalogue, for review. The source of truth is the code: milestones in `docs/BOT-API.md` and `src/core/milestones`, the recap in `src/core/recap/cards.ts` (when a card shows) and `texts.ts` (its phrasings). Change this file together with them. Each card has 3 phrasings; one example is shown per card.

## 1. Feats (posted by DoomBot after an upload, "Feat unlocked")
Every milestone is a feat (WEB-56, Doomsday). The site keeps every character's feats (`feats` table) with the upload that brought them; the code is `src/core/doomsday/feats.ts` (kinds, thresholds, texts) and `src/core/bot.ts` (the four kinds of WEB-38). The bot API event type stays `milestones`. No points. Texts written by Claude with Nico's go-ahead (2026-10-28), for Nico to edit.

| Kind | When | Text (title · line · flavour) | Card image | First in the group |
|---|---|---|---|---|
| `level` | A level up crosses 10 … 50; only the highest one counts (18 → 31 gives 30) | Level 30 · Reached level 30 | no | no |
| `maxLevel` | Reaching 60 (never also `level`) | Level 60 · Reached the level cap · The real game starts now. | yes | yes |
| `professionCap` | A profession reaches the cap of its training rank (75/75 … 300/300); training a higher cap doesn't count. At 300 Cooking, First Aid and Fishing get a title: Head Chef, Field Medic, Fish Whisperer | Cooking 300 · Cooking at its cap · Head Chef | at 300 | no |
| `newCharacter` | A character the group didn't know yet | New character · Joined the group | at level 60 | no |
| `honorKills` | Lifetime honorable kills (`pvp.hk`) cross 1, 100, 1,000, 5,000, 10,000; one feat for the highest crossed | First blood: Ves Doombringer · The first honorable kill · It begins. / 1,000 honorable kills / 10,000 kills · Ten thousand. Honorably. · Hillsbrad will never be the same | at 10,000 | the first kill |
| `pvpRank` | A new highest rank ever (1 to 14), never on decay or regaining a rank | Stone Guard (the official rank for the faction) · a.k.a. Mailbox Menace (rank titles: `DOOMSDAY.md`); 14: "the summit. Please go outside." | from rank 6; 14 its own | rank 6 or higher |
| `duelWins` | Duel wins (`pvp.duelsWon`, else the feed's duels) cross 10, 50, 100 | 10 duel wins · Slapping friends, professionally. / Nobody asked for a rematch. / Unbothered. | no | no |
| `bgFirstWin` | The first win in Warsong Gulch, Arathi Basin or Alterac Valley (feed `runs`) | First win · First win in Warsong Gulch | no | no |
| `deaths100` | 100 deaths (`pvp.deaths`, else the feed's deaths), once | A spirit healer's best friend · 100 deaths · Same time next week? | no | no |
| `firstEpic` | A character's first epic item (feed `loot.epic`); later epics go into the recap | the item's name in epic purple · First epic · Two-Hand · looted at level 42 | yes | yes |
| `mount` | Riding 75 | First mount · The 3rd mount in the group · Walking is for lowbies. | no | yes |
| `epicMount` | Riding 150 (a jump straight to 150 holds the mount silently) | Epic mount · The 1st epic mount in the group · Gold spent: none of your business | yes | yes |
| `firstCatch` | Fishing above rank 1 | First catch · Fishing past rank 1 · It was a boot. Probably. | no | no |
| `jackOfAllTrades` | Two primary professions plus Cooking, First Aid and Fishing, all at 300 | Jack of all trades · Cooking, First Aid, Fishing at 300 · plus Mining and Blacksmithing | yes | yes |
| `notableItem` | The first item of the addon's watch list (feed `notable`, CF-53) | Arcanite Reaper · Crafted at last · Somebody pay a visit. / Arcanite Bar · The first Arcanite transmute / Mooncloth · The first Mooncloth / Devilsaur leather · Devilsaur gear crafted / Fishing Extravaganza · Joined the Fishing Extravaganza / Extravaganza winner · Won the Fishing Extravaganza | yes, each | yes, each |

Rules:
- The site's first upload makes no posts, and a rebuild never makes events again.
- What a character already had when its data first arrives (a friend updated the addon, a new character, the site's first upload) is held as "already had": shown on the feats page as before tracking, never posted, never First in the group (Nico, 2026-10-28).
- First in the group: no character in the group held that feat before (already-had ones included). One per feat per upload.
- A post of several feats gets one card image, the most special one's: rank 14, 10,000 kills, Jack of all trades, the Extravaganza won, other watch-list items, epic mount, first epic, ranks 13 to 6, level 60, profession 300 (Nico, 2026-10-28).
- Feats from uploads a few minutes apart are grouped into one Discord message (the bot). No pings.

## 2. Weekly recap: how a week is built

- Posted once a week (default Sunday 13:00 in the admin's time zone).
- Order: headline, the week's numbers (levels, friends played, runs, new characters), the award ("Doombringers of the week · The Grinder"), up to 4 cards (one each of stat, progress, social, fun), a challenge for next week, a closing line.
- A card is a candidate only when the week meets its threshold. It wins on its score: this week's value against its average in earlier weeks, times the card's weight.
- A card or challenge isn't used again within 4 weeks. Awards have no cooldown.
- At most one card per friend, and the award winner gets no other card.
- **Quiet week** (under 3 levels in total): a short recap with no award and one card.
- Every 10th week is a **season finale**: Hall of fame always wins the award, and Season stats always shows.
- Names are display names and full character names. Never BattleTags, never pronouns.

## 3. Awards (one per week, "<site> of the week")

| ID | Name | Measures, per friend | Minimum | Example title |
|---|---|---|---|---|
| A1 | The Grinder | levels gained | 2 levels | "{friend} gained 7 levels" |
| A2 | Tourist | zones seen | 3 zones | "{friend} toured 9 zones" |
| A3 | Altoholic | characters played | 2 characters | "{friend} played 4 characters" |
| A4 | Crafter of the week | profession skill points | 10 points | "{friend} earned 45 skill points" |
| A5 | Quest machine | quests handed in | 5 quests | "{friend} finished 38 quests" |
| A6 | Dungeon diver | dungeon and raid runs | 2 runs | "{friend} cleared 5 dungeon runs" |
| A8 | The Comeback | days away before this week | 14 days | "Look who's back: {friend}" |
| A9 | Most improved | best item-level gain on one character | 5 item levels | "{friend} geared up by 8 item levels" |
| A10 | Hall of fame | levels over the 10-week season | every 10th week | "{friend} tops the season with 112 levels" |
| A11 | Warmonger | honorable kills (feed `kills`) | 25 | "Ves Doombringer took 142 honorable kills" |
| A12 | Battlemaster | battleground wins (feed `runs`, `kind` pvp) | 3 | "6 battleground wins for Ada" |
| A13 | Loot goblin | rare and epic items (feed `loot`) | 4 | "Bob looted 9 blues and 1 purple" |
| A14 | Duelist | duels won (feed `duels`) | 5 | "Ada won 11 duels" |
| A7 | Social butterfly | different friends grouped with (feed `groups`; redefined, Nico 2026-10-29) | 3 | "Bob grouped with 6 friends" |

The award line also names a runner-up when there is one.

## 4. Cards

### Stat
| ID | Name | When | Example |
|---|---|---|---|
| S1 | Zone of the week | the zone most friends were seen in, at least 2 friends | "Everyone went to Stranglethorn Vale" |
| S2 | Class census | at least 3 classes in the group | "Class census: Warriors on top" |
| S3 | Faction split | always | "6 Horde vs 4 Alliance" |
| S4 | Level sum | at least 1 level gained | "312 levels in total, 41 gained this week" |
| S5 | Map coverage | at least 1 new zone seen | "The map fills in: 31 of 45" |
| S6 | Talent fashion | the same spec on at least 2 characters | "Talent trend: Frost" |
| S7 | Busiest evening | at least 3 friends on one day | "Thursday night is game night" |
| S8 | Top dungeon | the same dungeon run at least twice | "Top dungeon: Deadmines" |
| S9 | Healer / tank census | at least 1 tank or healer (weighs more when the count changed) | "Role call: 2 tanks and 3 healers" |
| S10 | Quest log hoarder | one character with at least 15 quests in its log | "Quest log hoarder: {character}" |
| S12 | Season stats | every 10th week (always shown) | "112 levels in 10 weeks" |
| S13 | Bloodbath zone | a zone with at least 20 honorable kills | "Stranglethorn Vale: 87 honorable kills" |
| S14 | Battleground of the week | at least 3 games in one battleground, with wins and losses | "Warsong Gulch, 7 games: 4 won, 3 lost" |
| S15 | Deadliest zone | at least 5 deaths in one zone | "Badlands claimed 9 lives" |
| S11 | Biggest group night | the realm day with the most friends in groups together, at least 4 | "Friday: 7 friends grouped up" |

### Progress
| ID | Name | When | Example |
|---|---|---|---|
| P1 | Race to 60 | at least 3 characters | "Race to 60: A 48 · B 45 · C 41" |
| P2 | Prediction | the fastest climber below 60 gained at least 2 levels | "{character} reaches 60 in about 6 weeks" |
| P3 | Prediction check | 4 weeks after a Prediction | "Was the prediction right? yes" |
| P4 | Mount countdown | a character at level 35–39 | "{character} is 3 from a mount" |
| P5 | Halfway club | a character crossed level 30 | "Halfway club: {character}" |
| P6 | Max-level club | a character reached 60 | "{character} joins the max-level club" |
| P7 | Gap alert | a crafting profession where nobody is past 175 | "Still nobody past Enchanting 175" |
| P8 | Gap closed | someone got past 175 in such a profession (from week 2) | "Gap closed: Enchanting" |
| P9 | Crafting race | two friends' characters within 10 points in a crafting profession, both gaining this week | "Crafting race: Tailoring" |
| P10 | Profession completionist | a character with both primary professions at cap | "Completionist: {character}" |
| P11 | Gear jump | a character gained at least 5 item levels | "Gear jump: {character}" |
| P12 | Then vs now | from week 5 (weighs much more in a finale) | "Since week 1: from 40 to 312 levels" |
| P13 | On this week last month | at least 2 characters in another zone than a month ago | "{character} moved on from Westfall" |
| P14 | Rank race | two friends' characters at the same PvP rank, this week's honor within 10% (Nico, 2026-10-29) | "Stone Guard vs Stone Guard: Ves Doombringer leads" |

### Social
| ID | Name | When | Example |
|---|---|---|---|
| F1 | Duo of the week | two friends with at least 2 runs together | "Duo of the week: A and B" |
| F2 | Shared quest jackpot | two friends with at least 5 quests in common | "A & B share 7 quests" |
| F3 | Ghost town | a character not seen for at least 14 days | "Ghost town: Darkshore" |
| F13 | Group suggestion | a dungeon at least 3 friends have a character in range for | "Group idea: Shadowfang Keep" |
| F14 | Revenge | a character with at least 3 deaths to players and at least 10 honorable kills | "Lia Thornwhisper died to players 6 times, then took 31 kills" |
| F15 | Duel rivals | a pair of friends dueled at least 4 times (each side's records counted once), with the score | "Ada vs Bob: 5–3 in duels" |

### Fun
| ID | Name | When | Example |
|---|---|---|---|
| F4 | First footsteps | the first time anyone in the group saw a zone | "{character} discovered Badlands" |
| F6 | Homebody | a character played at least 3 days, all in one zone | "Homebody: {character}" |
| F9 | Most loyal alt | a character played at least 4 days | "Most loyal alt: {character}" |
| F10 | Longest streak | a friend played at least 3 days in a row | "Longest streak: {friend}" |
| F11 | Fresh face | a new character | "Fresh face: {character}" |
| F12 | Who am I? | at least 3 characters with known race and class | a riddle (race and class, level band, best profession, last zone) with the answer as a spoiler |
| F16 | Most deaths | at least 6 deaths for one character, with the runner-up | "A spirit healer knows Tok Ironhide by name: 12 deaths" |
| F17 | Fell to their death | at least 1 falling death | "Lia Thornwhisper trusted the cliff. The cliff said no." |
| F18 | Died by fire | at least 1 death by fire or lava | "The campfire won." |
| F19 | Untouchable | at least 5 levels and 0 deaths, only for characters whose deaths are known every day | "9 levels and not a single death for Ana Brightwater" |
| F20 | Big spender | at least 50 gold spent in one realm day (Nico, 2026-10-29); never an amount | "Bob's purse got a lot lighter. Something shiny was bought." |
| F21 | Purple rain | at least 1 epic item, with the items and characters | "2 epic items this week" |
| F22 | Marathon | a play session of at least 5 hours | "Tok Ironhide played 7 hours straight on Saturday" |
| F7 | Night owl | played after 01:00 (until 05:00) in the friend's own time zone, the most nights | "Ves Doombringer was still out at 03:12" |
| F8 | Early bird | logged in before 07:00 (from 05:00) in the friend's own time zone, on the most days | "Ada logged in at 06:40. Coffee first?" |

### Not built yet (need data the addon doesn't record)
F5 Road trip.

Recap v2 cards (recap v2, WEB-57; the boards `bot-recap-v2*` in the bot repo, thresholds as their "Shows when", Nico 2026-10-29) show only with the addon's new feed fields (CF-52, CF-53): a week without them shows none of them.

## 5. Headlines (one per week, picked by what the week was about)

| Kind | Example |
|---|---|
| first | "The first week of the {site}" |
| sixty | "The week {character} hit 60" |
| club | "Another 60: {character}" |
| levels | "{levels} levels and a lot of {zone}" |
| alts | "Alts, alts everywhere" |
| quiet | "A quiet week in Azeroth" |
| dungeons | "Dungeon week" |
| crafters | "The crafters' week" |
| tourists | "{zones} zones in seven days" |
| season | "{weeks} weeks of {site}" |
| pvp | "Blood in {zone}": at least 200 honorable kills, one zone with at least 40% of them (WEB-57) |
| danger | "A week of spirit healers": at least 25 deaths and at least 1.5 times the average of the last 4 weeks (WEB-57) |

The PvP and danger headlines come after the first week and a new 60, before a quiet week.

## 6. Challenges for the coming week

| Kind | Example |
|---|---|
| everyoneTo10 | "Everyone to level 10" |
| professionPair | "Train a second profession" |
| groupDungeon | "Run {dungeon} with three {site}: {names} all fit." |
| closeGap | "Get someone to {profession} 150" |
| threeEvenings | "Log in on 3 evenings" |
| scarlet | "All four wings of Scarlet Monastery" |
| craftForFriend | "Craft something for a friend" |
| sixtyDungeon | "Run a level 60 dungeon" |
| newZone | "Visit a zone nobody saw yet" |
| nextSeason | "Pick next season's goal" |
| nextTen | "Get {character} to level {target}" |
| questZone | "Finish 10 quests in {zone}" |
| bgGroup | "Win 3 battlegrounds as a group": after a week with at least 3 battleground games (WEB-57) |
| kills25 | "Each of you gets 25 honorable kills": after a PvP headline week |
| tarrenMill | "Take back Tarren Mill": Hillsbrad Foothills in the week's top 3 zones by honorable kills (kills are per zone; Nico, 2026-10-29) |
| duelEveryone | "Duel every friend once": after a Duel rivals card |
| noDeaths | "A week without dying": after a danger headline week |

## 7. Closing lines
"See you next week." · "Until next Sunday." · "Have a good week in Azeroth." · "Same time next week."

## 8. Doomsday (WEB-58)
The recap's Doomsday section (the bot's `recap.doomsday`, docs/BOT-API.md), computed from the stored goals over the recap's week (`recapSection`, `src/core/doomsday/posts.ts`). Left out when nobody has Doomsday data. It replaces the dailies workshop's A15 and F23 and the ladder workshop's "Ladder of the week" line.

| Part | What |
|---|---|
| Most devoted | The friend with goals done on the most Doomsday days of the week |
| Perfect week | Friends who did every PvE daily on every day they played, on at least 4 days |
| Points | The top 3 per track (PvE and PvP, never summed); a PvP Virgin isn't in the PvP list |
| Crowns | The crowns per friend that week, most first |
