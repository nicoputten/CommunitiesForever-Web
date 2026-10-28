# Milestones and the weekly recap

The full catalogue, for review. The source of truth is the code: milestones in `docs/BOT-API.md` and `src/core/milestones`, the recap in `src/core/recap/cards.ts` (when a card shows) and `texts.ts` (its phrasings). Change this file together with them. Each card has 3 phrasings; one example is shown per card.

## 1. Milestones (posted by DoomBot after an upload)

| Kind | When | Card image |
|---|---|---|
| Level | A level up crosses 10, 20, 30, 40 or 50. Only the highest one counts (18 → 31 gives 30). | no |
| Max level | Reaching 60 (never also a Level milestone) | yes |
| Profession cap | A profession reaches the cap of its training rank: 75/75, 150/150, 225/225 or 300/300. Training a higher cap doesn't count. | at 300 only |
| New character | A character the group didn't know yet | at level 60 only |

The site's first upload makes no milestones. Milestones from uploads a few minutes apart are grouped into one Discord message.

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

### Social
| ID | Name | When | Example |
|---|---|---|---|
| F1 | Duo of the week | two friends with at least 2 runs together | "Duo of the week: A and B" |
| F2 | Shared quest jackpot | two friends with at least 5 quests in common | "A & B share 7 quests" |
| F3 | Ghost town | a character not seen for at least 14 days | "Ghost town: Darkshore" |
| F13 | Group suggestion | a dungeon at least 3 friends have a character in range for | "Group idea: Shadowfang Keep" |

### Fun
| ID | Name | When | Example |
|---|---|---|---|
| F4 | First footsteps | the first time anyone in the group saw a zone | "{character} discovered Badlands" |
| F6 | Homebody | a character played at least 3 days, all in one zone | "Homebody: {character}" |
| F9 | Most loyal alt | a character played at least 4 days | "Most loyal alt: {character}" |
| F10 | Longest streak | a friend played at least 3 days in a row | "Longest streak: {friend}" |
| F11 | Fresh face | a new character | "Fresh face: {character}" |
| F12 | Who am I? | at least 3 characters with known race and class | a riddle (race and class, level band, best profession, last zone) with the answer as a spoiler |

### Not built yet (need data the addon doesn't record)
A7 Social butterfly, S11 Biggest group night, F5 Road trip, F7 Night owl, F8 Early bird.

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

## 7. Closing lines
"See you next week." · "Until next Sunday." · "Have a good week in Azeroth." · "Same time next week."
