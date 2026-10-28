# Claude Design prompt: Doomsday (goals, feats and the ladder)

The prompt Nico gave the design canvas on 2026-10-28; the boards it produced are `design/boards/doomsday-*` and `roster-cards-doomsday` here, `design/boards/bot-doomsday-*` in the bot repo and `docs/design/doomsday-2026-10/` in the addon repo. The designer named the feature **Doomsday**. Decisions made after the boards (19:00 reset as a setting, computed goals, the crown without points) are in the addon repo's `docs/DOOMSDAY.md`, which wins over this prompt and the boards.

Paste everything below the line into the Doombringers canvas. This replaces the earlier milestone section (section 1) and the PvP ladder section (section 3) of the recap v2 prompt, and the separate ladder and dailies prompts. The new recap cards (section 2 of the recap v2 prompt) stay as they are.

---

We're building **one new feature** for Doombringers that ties together three ideas we first designed apart: **daily and weekly goals**, **feats** (one-time achievements), and a **PvP ladder**. It lives in all three places: the **in-game addon**, the **website** (wow.vestras.nl) and the **Discord bot**. The group plays WoW: Forever (Vanilla content, level cap 60) on the **PvP ruleset**. Both factions can be in the group, but we mostly play Horde.

**Important: don't change any existing board.** Duplicate each board you build on and work in the copy. New screens get new boards.

Use the existing design system everywhere (Night over Azeroth: tokens, Marcellus SC / Marcellus / Inter, gold trim, class colours, data age scale, 44 px touch targets, reduced motion). Discord screens use Discord's real UI (dark theme, embeds, buttons), as on the existing bot boards. In-game screens use the addon's widget kit and its "what WoW supports" board.

## Step 1: the name (start here)

The feature needs a name. The working name is **"DoomPoints"**, which is also what we call the points. Propose **5 names** for the feature as a whole, each with a one-line pitch and a small wordmark or emblem sketch. Use our group name (Doombringers) and Vanilla WoW flavour, keep the tone light, and avoid "Achievements" (Blizzard's own system has that name). Examples to beat: DoomPoints, the Doom Board, the Doom Ledger, Hall of Doom. Then use your favourite in every screen below. We'll pick the final one from your options.

## Rules (binding)

1. **Privacy:** never BattleTags or Discord IDs. Friends by display name, characters by full name (first and last name, e.g. "Ves Doombringer"). All example names are made up (Ada, Bob, Mira, Tok…).
2. **Gold is never shown as an amount.**
3. **Recommend, never restrict:** goals are suggestions with points, never conditions to play.
4. **Two tracks, never added together:**
   - **PvE points:** quests, levels, dungeons, professions, playing together.
   - **PvP points:** kills, duels, the hunt.
   
   They're always shown side by side ("PvE 85 · PvP 240"), and each track has its own ranking. A friend who never does PvP is never ranked against gankers.
5. **Everything counts per friend:** any of your characters counts, and progress adds up across characters.
6. **Times:** the day resets at **09:00**, and the week resets on **Sunday at 09:00** (our own schedule, not the game's weekly reset or its honor system). Show "resets in 3 h 12 m" where it matters.
7. Light humour. Proud of the grind, teasing about deaths, never mean.

## The three parts

### A. Goals: the goal board (repeating)
Every day at 09:00 the group gets the same goals, picked automatically:
- **Today:**
  - **3 PvE dailies**, e.g. "Finish 10 quests", "Run a dungeon with a friend", "Raise Cooking, First Aid or Fishing", "Play 2 of your characters", "Gain a level on an alt".
  - **2 PvP goals:**
    - **the Hunt:** today's enemy race and class, e.g. "Hunt: Night Elf Druids"
    - **a Skirmish**, e.g. "Lone wolf: 3 solo kills", "Punch up: 2 kills on higher-level players", "Front line: 5 kills in Arathi Highlands"
  - Plus an open **Duel** slot: your first duel with each friend that day.
- **This week:**
  - **3 PvE weeklies**, e.g. "Run 3 different dungeons", "Gain 3 levels", "Group with 3 different friends", "Reach a profession cap".
  - **1 PvP Weekly bounty**, e.g. "A kill of every enemy class", "A spree of 10 without dying", "Kills on 5 days".

**Points:** 5 per daily and 15 per weekly, in both tracks. PvP also gets points per kill: 0 for a victim 4+ levels below, 1 near your level, 2 for 3+ above, 3 for a skull, +1 when solo.

**First to finish:** the first friend to finish all of today's dailies gets a bonus (+3) and a "first" mark for the day. Also design a version without the bonus, only the mark, so we can compare.

**Streak:** days in a row on which you finished at least one goal, in either track. Show the current streak and the best ever.

**A goal you can't do** (e.g. "Gain a level" when all your characters are 60) is swapped for another one for you only. Show the swap subtly (a small mark, the original goal in a tooltip).

**The board** is the heart of the feature: **everyone's goals in one view, crossed out as friends finish them**. Friends are rows and today's goals are columns. A finished goal gets a check and is struck through, with the time it was done. Show the "first to finish" mark, the streaks, and each friend's PvE and PvP points for today and this week.

### B. Feats (one time, posted as "Feat unlocked")
Permanent achievements per character. Feats give **no points**: they are for bragging. Each is posted once in Discord, and some get a card image (800 × 400, like the existing `level-60` card).
- **PvP rank**, every rank 1–14 (only a new highest rank). The game's rank followed by our title, for example "Ves Doombringer is now a Stone Guard, a.k.a. *Mailbox Menace*". Our titles:
  1. Fresh Meat
  2. Accidental Flagger
  3. Lowbie Botherer
  4. Corpse Camper
  5. Spirit Healer's Pen Pal
  6. Mailbox Menace
  7. Flag Hugger
  8. Honor Goblin
  9. Queue Dweller
  10. Crossroads Landlord
  11. Hillsbrad Housing Crisis
  12. Last Seen Questing at Launch
  13. Sleep Is for the Dishonorable
  14. Grass: Untouched
  
  No kills yet: "Conscientious Objector" (shown, never posted). Card images from rank 6, and a special image for rank 14.
- **Honorable kills:** the first ("First blood"), then 100, 1,000, 5,000 and 10,000 (10,000 has a card).
- **Duel wins:** 10, 50, 100. **First battleground win** in each of Warsong Gulch, Arathi Basin and Alterac Valley. **100 deaths:** "A spirit healer's best friend".
- **First epic item** (the item name in epic purple, its slot and level; card). **Mount** (riding 75) and **epic mount** (riding 150, card), with "the 3rd mount in the group".
- **Professions:**
  - **First catch.**
  - At 300: **Head Chef**, **Field Medic** and **Fish Whisperer**.
  - **Jack of all trades:** two professions plus Cooking, First Aid and Fishing at 300 (card).
  - **Iconic items,** each with its own card:
    - Arcanite Reaper
    - the first Arcanite transmute
    - the first Mooncloth
    - the Devilsaur set
    - joining the Stranglethorn Fishing Extravaganza
    - winning it
- **"First in the group"** badge on a feat nobody in the group had before (the first kill, the first rank 6, the first epic, the first mount, the first to 60, …).
- Feats from one upload are grouped in one post. Design a post with 1 feat, and one with 4 feats including a "First in the group".

### C. Ladder (ranking)
- **Week:** friends ranked by this week's points, PvE and PvP each with its own ranking. Rows can be expanded to show the split per character. Show the movement since last week (▲2, ▼1, new).
- **All time:** totals since the start. **Only the website and Discord keep all-time totals**; the addon shows this week only.
- **PvP details:**
  - kills this week, PvP rank with insignia, kills by zone
  - **duels:** wins and losses, a head-to-head grid between friends, and an Elo rating (site and Discord only)
  - **battlegrounds** as a separate block: wins, losses and kills per battleground. These never count toward the week's PvP kills.
- **PvP Virgin:** a friend whose characters have never killed anyone gets a playful label.

## Screens to make

### In game: one new tab in the addon window (next to Friends, Activity, Dungeons)
- **Today:** your 5 goals with progress ("7/10") or a check, the time to the reset, the swap mark and the Duel slot.
- **Week:** your weeklies, your points this week (PvE and PvP), your streak.
- **Board:** everyone's goals for today, crossed out.
- **Ladder:** this week only, PvE and PvP.
- **Feats:** your characters' feats.
- A chat line when you finish a goal: "Daily done: Finish 10 quests (+5 PvE, 2 of 3 today)". A toast for "First to finish today!".
- States: no goals done yet, everything done, a friend without the addon.

### Website (desktop 1440 and phone 375)
- **One page** for the feature, with Today, Week, Board, Ladder (week and all time), Feats (per friend and the whole group's feats, newest first) and the PvP details.
- **The roster** shows each friend's points this week and their streak.
- **A 12-week heatmap** per friend (goals done per day).
- States: empty (the first day), loading, only one friend with data.

### Discord
- **The daily board post** at 09:00: today's goals (PvE and PvP), with each friend as a line. The bot **edits the post during the day** as friends finish goals: names get crossed out, and the first to finish gets a crown. Show it at 09:00, at midday with some done, and at the end of the day.
- **The weekly PvP leaderboard post** on Sunday at 09:00: the week's top 5 for PvP (and PvE), movement, duel champion, battleground block, "PvP Virgin of the week" if anyone qualifies.
- **"Feat unlocked" posts** (from part B).
- **A command** (named after the feature, e.g. `/doom`): an ephemeral reply with your goals today, your points this week and all time, and your place on both ladders.
- **The weekly recap** gets one section with the feature's points of the week (the most devoted friend, the perfect week).
