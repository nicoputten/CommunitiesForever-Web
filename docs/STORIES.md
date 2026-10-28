# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-27): WEB-44, then Runs v2 (WEB-47, WEB-48, WEB-49 with WEB-50 merged in), WEB-43, WEB-42 (done), WEB-45. The order across the repos is under E7.

## Every UI story
- Build the screen in our Next.js app with the tokens from `src/styles/tokens.css` and real data through the view models. The board in `design/boards/` is a **visual reference only**: match its spacing, type and colours, never copy its markup or runtime.
- Always the design system (CLAUDE.md rules 11 and 12): no raw values outside the tokens, design system components first. A deviation only after Nico said so, recorded in `docs/DESIGN.md` "Deviations".
- The screen gets its design checks (WEB-30): computed-style checks for its key elements, accessibility scan, screenshot baselines at desktop and phone size.
- Accessible: semantic HTML, visible focus states, keyboard use, 44 px touch targets, contrast as in `docs/DESIGN.md`, `prefers-reduced-motion` honoured.
- Works at 375 px (phone) and 1440 px (desktop canvas); page max-width 1280.
- Empty, loading and error states of the screen are part of the story.
- Playwright test for the main flow at desktop and phone size; screenshots of both in the PR next to the board.

## E3 Access and hosting

## E4 Design foundations

## E5 Screens

## E6 Later

## E7 Discord bot and planned runs
The bot lives in its own public repo, [CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord) (BOT-01..07). The site is its only data source: it decides milestones, runs, the recap and who is linked; the bot formats and posts (decided with Nico, 2026-10-27). Design: the canvas's §12 "Discord bot" and the planned-runs boards (`design/README.md`; the flow: `runs-flow`).

**Planned runs** (decided with Nico, 2026-10-27): two kinds of group. *Ask now* lives in the game (addon CF-27) and is answered within minutes; with "Also post on Discord" it reaches the site after a `/reload` and the bot posts it. A *planned run* is owned by the site, posted and answered in Discord, reaches the game through the uploader (`Runs.lua`) and friends' addons, and ends in an invite in the game at start time. The in-game calendar is out of the flow. Times are stored in UTC and shown in each viewer's own time zone. Any linked friend can plan; organisers edit and delete their own runs, the admin can delete any run (one admin, `ADMIN_BATTLETAG`; the board's "Admins: Nico, Mira" is not built). Reminders mention only those who answered I'm in or Maybe.

Order (2026-10-27; WEB-32, WEB-38, WEB-40 and WEB-46 are done): WEB-44, Runs v2 (WEB-47 first, then WEB-48, then WEB-49 with WEB-50 merged in), WEB-43, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### Runs v2 (WEB-47 to WEB-49)
Nico tested Runs on the live site (27 Oct 2026) and the design came back as "Runs v2" (Nico, 2026-10-27): any character can join, the role is picked apart from the character, the organiser can move people, and styled dropdowns replace every native one. Boards: `runs-v2-findings` (the 15 issues, each with what was seen and the fix), `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`. They are newer than `runs`, `run-detail` and `run-create` where they overlap. Done for all four when none of the 15 findings can be reproduced, at 1440 and 375 px. Decided with Nico: four stories, right after WEB-44 and before WEB-43; the dropdown is built in house (ARIA listbox and combobox, no new dependency); account names on the boards were replaced with made-up ones (characters are fine).


### Backlog (unordered, not yet stories)
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
- Dungeon catalogue: every dungeon with who cleared it, the group's first clear as a feat (Nico, 2026-10-28: brainstorm after E8 Doomsday, then designs).
- The class per name in recap cards (award winners, the cards' characters), so the bot can put its class icon before them (bot BOT-11 left the recap without icons for lack of it).

## E8 Doomsday (decided with Nico, 2026-10-28)
Daily and weekly goals, points per track (PvE and PvP, never added together), a streak, a crown, feats and a ladder, in the game (addon E15), on the site and in Discord (bot "Doomsday"). **The rules are in the addon repo's `docs/DOOMSDAY.md`**, the one description for all three; read it first. It replaces the three workshop designs (milestones, PvP ladder, dailies and weeklies; their PRs were closed unmerged), and the recap v2 data and cards are part of it.

Boards (`design/README.md`, "Doomsday"):
- `doomsday-names`, `doomsday-rules`
- `doomsday-today`, `doomsday-ladder`, `doomsday-feats`, `doomsday-phone`
- `roster-cards-doomsday`, `doomsday-feat-cards`

The bot's boards are in its repo, the addon's in `docs/design/doomsday-2026-10/` there. Where a board and `DOOMSDAY.md` disagree, `DOOMSDAY.md` wins:
- the reset is **19:00** (a setting), not 09:00
- goals are computed, not delivered
- the crown gives no points (version B)

The design prompt is `docs/DESIGN-PROMPT-DOOMSDAY.md`.

Key decisions:
- **Single source of truth:** uploads stay it. The addon decides when a goal is done and sends the time (`goals`, CF-56), because the Doomsday day (19:00 to 19:00) doesn't line up with the feed's realm days. The site stores and counts. Kill points the site computes itself from the raw kills (`pvpKills`, CF-55), against the addon's golden file.
- **All-time totals** live only on the site and in the bot; the addon shows this week.
- Gold is never shown as an amount. No pronouns in texts. Names: friends by display name, characters by full name, never BattleTags or Discord IDs.

Compatibility: uploads from addons without CF-52 to CF-56 have none of the new fields. Each is optional everywhere. A card, feat or goal whose data is missing never shows, and friends without Doomsday data show "no Doomsday data yet", never 0 as if known.

Two workers (Nico, 2026-10-28):
- **Engine:** WEB-55, WEB-58, WEB-56, WEB-57, in that order.
- **Screens:** WEB-59, WEB-60, WEB-61. They start from view models with fixture data, so they don't wait for the engine, and agree the view-model shapes with the engine worker first.

The bot's stories need WEB-56 (feats) and WEB-58 (the Doomsday API).

### WEB-57 New recap cards, awards, headlines and challenges
After WEB-55. The dailies' A15 and F23 are not built: the Doomsday section (WEB-58) covers them.
Each card keeps the existing rules: a threshold, a score against earlier weeks, 3 phrasings, a 4-week cooldown, at most one card per friend. IDs continue the catalogue.
- Awards:
  - A11 Warmonger: most honorable kills, at least 10
  - A12 Battlemaster: most battleground wins, at least 2
  - A13 Loot goblin: most rare and epic items, at least 5
  - A14 Duelist: most duel wins, at least 3
  - A7 Social butterfly: in a group with the most different friends, at least 3
- Stat cards:
  - S13 Bloodbath zone: the zone with the most honorable kills, at least 10
  - S14 Battleground of the week: the most played battleground, with wins and losses, at least 2 games
  - S15 Deadliest zone: the zone with the most deaths, at least 3
  - S11 Biggest group night: the evening with the most friends in groups together, at least 3
- Progress cards: P14 Rank race, two friends' characters one PvP rank apart, or the same rank with honor within 10 %.
- Social cards:
  - F14 Revenge: died to players most, then got the most kills, at least 3 of each
  - F15 Duel rivals: the pair that duelled each other most, with the score, at least 3 duels
- Fun cards:
  - F16 Most deaths: at least 5
  - F17 Fell to their death: a `fall` death
  - F18 Died by fire: a `fire` death ("the campfire won")
  - F19 Untouchable: the most levels gained with 0 deaths, at least 3 levels
  - F20 Big spender: the biggest gold spent; text without amounts ("someone bought something shiny")
  - F21 Purple rain: epic items received, at least 1
  - F22 Marathon: the longest session, at least 3 hours
  - F7 Night owl: played after 01:00 the most
  - F8 Early bird: played before 08:00 the most (both in each friend's own saved time zone; without one, the site's)
- Headlines: `pvp` (a week with many kills), `danger` (a week with many deaths).
- Challenges:
  - "Win 3 battlegrounds as a group"
  - "Each of you gets 25 honorable kills"
  - "Take back Tarren Mill" (kills in Hillsbrad Foothills)
  - "Duel every friend once"
  - "A week without dying"
- `docs/RECAP.md` lists every new card with its threshold. Tests per card: shows above the threshold, not below it, and not without the data.

### WEB-59 The Doomsday page: Today, Week, Board and heatmap
Boards `doomsday-today` (desktop) and `doomsday-rules` (labels, tone). Starts from view models with fixture data, agreed with the engine worker; switches to WEB-58's data when it lands.
- A page **Doomsday** (`/doomsday`, in the navigation after Runs) with a header:
  - today's and this week's points (PvE and PvP side by side), the streak and best
  - tabs: Today, Week, Board, Ladder, Feats, PvP
- **Today:**
  - your 5 goals with progress or a check and its time, the swap mark with the original in its tooltip
  - the Duel slot (who's done, who's open), the time to the reset
  - "Today so far" (the crown, who finished, who hasn't started, who has no addon)
- **Week:** the 3 weeklies and the Weekly bounty with progress, the time to Sunday's reset.
- **Board:** every friend × today's goals, struck through with the time when done. A friend's name is crossed out when the 3 PvE dailies are done. The crown, today's and this week's points, the streak.
- **The 12-week heatmap** per friend (goals done per day).
- "Goals are suggestions with points. Skip any of them; nothing is locked."
- As every UI story: design checks, 1440 px, Playwright (the phone in WEB-61).

### WEB-60 The Doomsday page: Ladder, PvP and Feats
Boards `doomsday-ladder` and `doomsday-feats`. Same fixture-first start as WEB-59.
- **Ladder:**
  - This week and All time, PvE and PvP side by side, each with its own ranking
  - rows expand to characters; movement (▲, ▼, new)
  - PvP Virgin shown and not ranked ("not ranked: no kills on any character, ever")
  - the time to the weekly reset
- **PvP:** the details for a selected friend:
  - kills this week (solo, skulls), rank with insignia and "a.k.a." title per character, kills by zone
  - the duel grid with wins–losses and the Elo rating (with movement)
  - the battleground block, apart from the week's kills, and first wins unlocked
  - "≈" where data was guessed
- **Feats:** per friend and the whole group's feats, newest first, with "First in the group", the rank titles table and the feat states from the board.
- As every UI story (1440 px; the phone in WEB-61).

### WEB-61 Doomsday on the phone, its states, and the roster
Boards `doomsday-phone` and `roster-cards-doomsday`.
- The Doomsday page at 375 px as the board shows.
- The states:
  - empty, on the first day ("Nobody has done anything yet")
  - loading
  - only one friend with data
  - friends without the addon or without Doomsday data
  - error
- The **roster** cards get each friend's PvE and PvP points this week and the streak as chips, as `roster-cards-doomsday` shows (a copy of `roster-cards-runs` with only those chips added).
- As every UI story (375 and 1440 px, Playwright, screenshots in the PR).
