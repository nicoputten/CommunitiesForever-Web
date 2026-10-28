# Claude Design prompt: recap v2 (PvP, danger, loot) and the PvP ladder

Paste everything below the line into the Doombringers canvas. The stories are web WEB-55 to WEB-59, bot BOT-14 and BOT-15 and addon CF-52 to CF-56; the ladder's rules are in the addon's `docs/LADDER.md`. The full current catalogue is `docs/RECAP.md`.

---

We're adding **PvP, danger and loot** to Doombringers' milestones and weekly recap, plus a new **PvP ladder**. The group plays on the **PvP ruleset** of WoW: Forever (Vanilla content: level 60 cap, Vanilla honor ranks, Warsong Gulch, Arathi Basin, Alterac Valley, world PvP in Stranglethorn Vale and Hillsbrad Foothills). Both factions can be in the group.

**Important: don't change any existing board.** Duplicate each board you build on and work in the copy, named "<original name> · recap v2" (for example "Discord bot · weekly recap · recap v2"). New screens get new boards.

Use the existing design system everywhere (Night over Azeroth: tokens, Marcellus SC / Marcellus / Inter, gold trim, class colours, data age scale, 44 px touch targets, reduced motion). Discord screens use Discord's real UI (dark theme, embeds), as on the existing bot boards. In-game screens use the addon's widget kit and its "what WoW supports" board.

## Rules (binding)

1. **Privacy:** never BattleTags or Discord IDs. Friends by display name, characters by full name (first and last name, e.g. "Ves Doombringer"). All example names are made up.
2. **Gold is never shown as an amount**, anywhere. Only relatively: "the biggest spender", "bought something shiny", "the richest week".
3. **No pronouns** in recap texts ("Somebody pay a visit.", never "visit her").
4. A card shows only when the week has data for it. Design the full set, but a normal week shows an award and up to 4 cards (stat, progress, social, fun).
5. Light humour, the tone of the current recap: proud of the grind, gently teasing about deaths. Never mean.

## 1. New milestone posts (Discord; copy "Discord bot · milestones & group asks")

Milestones from one upload are grouped into one post, as now. Add these kinds:
- **Honorable kills:** the first honorable kill, then 100, 1,000 and 5,000. ("Ves Doombringer reached 1,000 honorable kills")
- **PvP rank:** a new rank, with the Vanilla rank title and its insignia per faction (Horde: Scout … High Warlord; Alliance: Private … Grand Marshal). ("Ves Doombringer is now a Stone Guard")
- **First epic item:** a character's first purple item, with the item name in epic purple. ("Lia Thornwhisper looted a first epic: Bonereaver's Edge")
- **Mount:** riding at 75 ("Tok Ironhide no longer walks"), and the **epic mount** at riding 150.

Card images, 800 × 400 like the existing `level-60` and `profession-300`, for: **new PvP rank** (insignia, character, class colour), **first epic item** (item name in purple, a subtle glow) and **epic mount**. Show one mixed post with 4 milestones too.

## 2. New weekly recap cards (Discord; copy "Discord bot · weekly recap")

Show each card as it appears in the recap embed, with sample data. One example per card is enough; each card later gets 3 phrasings.

**Awards** ("Doombringers of the week · <name>", with the award header image: the winner's class disc):
- **Warmonger:** the most honorable kills. "Ves Doombringer took 142 honorable kills"
- **Battlemaster:** the most battleground wins. "6 battleground wins for Ada"
- **Loot goblin:** the most rare and epic items. "Bob looted 9 blues and 1 purple"
- **Duelist:** the most duel wins. "Ada won 11 duels"
- **Social butterfly:** grouped with the most different friends. "Bob grouped with 6 friends"

**Stat cards:**
- **Bloodbath zone:** the zone with the most kills (with the zone's map crop, like Zone of the week). "Stranglethorn Vale: 87 honorable kills"
- **Battleground of the week:** "Warsong Gulch, 7 games: 4 won, 3 lost"
- **Deadliest zone:** "Badlands claimed 9 lives"
- **Biggest group night:** "Friday: 7 friends grouped up"

**Progress card:**
- **Rank race:** "Stone Guard vs Stone Guard: Ves Doombringer leads Tok Ironhide by a hair"

**Social cards:**
- **Revenge:** "Lia Thornwhisper died to players 6 times, then took 31 kills"
- **Duel rivals:** "Ada vs Bob: 5–3 in duels"

**Fun cards:**
- **Most deaths:** "A spirit healer knows Tok Ironhide by name: 12 deaths"
- **Fell to their death:** "Lia Thornwhisper trusted the cliff. The cliff said no."
- **Died by fire:** "The campfire won. Ves Doombringer got too cosy." (also lava)
- **Untouchable:** "9 levels and not a single death for Ada's Ana Brightwater"
- **Big spender:** no amounts. "Bob's purse got a lot lighter. Something shiny was bought."
- **Purple rain:** "2 epic items this week: Bonereaver's Edge, Robe of Volatile Power"
- **Marathon:** "Tok Ironhide played 7 hours straight on Saturday"
- **Night owl:** "Ves Doombringer was still out at 03:12"
- **Early bird:** "Ada logged in at 06:40. Coffee first?"

**Headlines:** a **PvP week** ("Blood in Stranglethorn") and a **danger week** ("A week of spirit healers").

**Challenges:** "Win 3 battlegrounds as a group", "Each of you gets 25 honorable kills", "Take back Tarren Mill", "Duel every friend once", "A week without dying".

Make two complete sample recaps: a **PvP week** (Warmonger award, Bloodbath zone, Rank race, Duel rivals, Fell to their death, the Tarren Mill challenge) and a **danger and loot week** (Loot goblin award, Deadliest zone, Revenge, Purple rain, Died by fire).

Small **icons** for the new card types, in the style of the existing recap icons: crossed swords (PvP), a skull (deaths), a falling figure (fall), a flame (fire), a purple gem (epic), a horse (mount), a moon (night owl), a sun (early bird).

## 3. PvP ladder (new boards)

A friendly competition inside the group: who hunts the most Alliance this week? Stories: web WEB-58 and WEB-59, addon CF-54 to CF-56, bot BOT-15. The group plays Horde, but every screen must also work for an Alliance character (then the enemy is Horde). Use the boards' existing look; this is the group's own scoreboard, not a tournament site: proud, a bit cheeky, readable at a glance.

### How it works (so the screens make sense)
- The points are called **DoomPoints PvP**. The group's dailies and weeklies (a separate design) give **DoomPoints PvE**. Wherever DoomPoints show for a friend or character, the two stand side by side, for example "DoomPoints · PvE 34 · PvP 1,210". They're never added up and never ranked together. The ladder ranks by PvP only, but **leave room for the PvE number** next to it (in the ranking rows, the character card and the `/ladder` embed).
- **DoomPoints PvP per world kill**, by the victim's level compared with yours:
  - 4 or more levels below: 0
  - around your level (3 below to 2 above): 1
  - 3 or more above: 2
  - skull (??): 3
  - unknown level: 1
  - **Solo** (you were not in a group): +1
- Kills of the same enemy count at most 3 times a day.
- **Battleground kills don't count here.** Battlegrounds are a separate block with their own score.
- **Goals:** the same for every friend, drawn by the date.
  - **Hunt** (daily): an enemy race and class, for example "Night Elf Druid". +5 per kill (at most 3), +1 if only the race or only the class matches.
  - **Class hunt** (daily, different per own class): for example "Mages hunt Human Warlocks today". +2 per kill, at most 3.
  - **Daily** (one per day): for example "Front line: 5 kills in Stranglethorn Vale", "Punch up: 2 kills on higher-level players", "Lone wolf: 3 solo kills", "Untouchable: 5 kills without dying", "Variety: 3 different classes", "Ranked bounty: kill a player with a PvP title". +5.
  - **Duel** (daily): duel a friend. Win +3, loss +1.
  - **Streak** (weekly): a kill on 5 of 7 days. +15.
  - **Class weekly** (different per own class): for example "Warriors: 10 Paladins". +20.
  - **Weekly bounty** (changes every week, the big one): for example "Every Alliance class at least once", "25 kills in Arathi Highlands", "A spree of 10". +30.
- **Views:**
  - **This week:** DoomPoints PvP, which reset on the weekly reset day
  - **Last week**
  - **Lifetime:** the game's honorable kills and the PvP rank, plus all-time DoomPoints PvP on the site
  - **Duels:** wins and losses, a head-to-head grid between friends, and on the site an Elo-like duel rating
  - **Battlegrounds:** wins, losses and kills per battleground
- The ladder ranks **friends** (the sum of their characters). Each friend expands to their characters.
- **PvP Virgin:** the title of a character, or a friend, without a single honorable kill. Make it a badge we can laugh at, not a shame.
- **Killing spree:** 5 and 10 kills without dying show as badges in the activity feed.
- **No ladder data yet:** a friend whose addon doesn't send kills yet shows their lifetime kills and a quiet "no ladder data yet", never 0 points.

Sample data for every screen:
- Friends: Ada (Ves Doombringer, Ana Brightwater), Bob (Tok Ironhide), Cy (Lia Thornwhisper), Dee (two low alts, a PvP Virgin)
- Enemies: Kel Stormbrand (Human Warlock, rank 3 Sergeant), Mira Dawnleaf (Night Elf Druid)
- Today's Hunt: "Night Elf Druid"; the Class hunt for Mages: "Human Warlock"
- The week's bounty: "Every Alliance class at least once" (Ada 6/8)

### Website: the "Ladder" page (desktop 1440 and phone 375)
- Tabs or segments: This week · Last week · Lifetime · Duels · Battlegrounds.
- **Ranking rows:**
  - place, with gold, silver and bronze for the top 3
  - the friend, with the class discs of their characters
  - DoomPoints PvP (with the PvE number beside it, smaller), kills, a solo share
  - movement since last week (▲2, ▼1, new)
  - expanded: each character (class colour, level, PvP rank with insignia, points, kills)
- **Goals panel**, prominent, next to or above the ranking:
  - today's Hunt (race and class, with a hint of the race and class icons) and the Daily
  - the Class hunt per class the group plays
  - the Duel of the day
  - this week's Streak, Class weekly and Weekly bounty, with a countdown to the reset
  - for each goal, who has done it (class discs) and progress ("1/3")
- **Duels:** a head-to-head grid of the friends (wins–losses per pair, the reigning champion highlighted), the Elo per friend, this week's duels.
- **Battlegrounds:** Warsong Gulch, Arathi Basin and Alterac Valley as cards with wins, losses and kills this week, and the battleground ranking.
- **Lifetime:** honorable kills and rank (Horde: Scout … High Warlord; Alliance: Private … Grand Marshal, with the insignia), all-time DoomPoints PvP.
- States:
  - empty: "Nobody has drawn blood yet"
  - only one friend with data
  - a friend with "no ladder data yet"
  - a PvP Virgin row
  - loading

### In game: the addon's "Ladder" tab and the character card
- A **Ladder** tab in the addon window next to Friends, Activity and Dungeons, at the window's size (880 × 600). It has:
  - segments for Week, Lifetime, Duels and Battlegrounds
  - a compact ranking with your own row highlighted, friends expandable to characters
  - on the right, a **goals panel for the character you are on**: today's Hunt, Class hunt, Daily and Duel, and this week's Streak, Class weekly and Weekly bounty, with progress (for example "Human Warlock 1/3") and the points each gives
  
  Use the widget kit and the "what WoW supports" board (no web-only effects).
- The **character card** (Friends tab) gets a PvP line: lifetime honorable kills, rank with insignia, this week's DoomPoints (PvE and PvP side by side) and place. Or the **PvP Virgin** badge.
- The **Activity** tab: a killing-spree chip (5 and 10) on an entry.

### Discord
- `/ladder` reply (ephemeral embed): the top 5 friends of this week with DoomPoints PvP and movement, the asker's own place, and today's Hunt and the week's bounty. Options `view: week | lastweek | lifetime | duels | battlegrounds`; show each view.
- The weekly recap's **Ladder of the week** line: the winner and the top 3 ("Ada took the ladder with 214 DoomPoints PvP; Bob and Cy close behind").
- Small icons: a ladder or podium, a crosshair for the Hunt, a bounty poster, crossed swords for duels, a flame for a spree, and a PvP Virgin badge.
