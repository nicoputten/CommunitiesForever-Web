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


### WEB-54 Band names on narrow roster bands (bug)
Found by Nico (2026-10-28): on the roster's dungeon bands (`DungeonBands`), a narrow band such as Ragefire Chasm shows only "13–18 · 2". The name is dropped (`data-fit="count"`), so you can't tell which dungeon it is. The name always comes first.
- The label never drops the name. Order of fallback: full name, then short name, then the short name cut with an ellipsis ("Ragef… 13–18 · 2"), keeping at least 3 letters before the "…".
- The range and count stay whole. Only when 3 letters + "…" and the rest still don't fit, the range goes before the name is cut further ("Rag… · 2"); the count always stays.
- Cuts happen on the name text only, never in the middle of the range or count; the `title` and `aria-label` keep the full name and range.
- Test: a band narrow enough to hit each fallback (full, short, cut name, cut name without range) at 1440 px, with a screenshot baseline; the phone list is unchanged (always the full name).

### Backlog (unordered, not yet stories)
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
- Dungeon catalogue: every dungeon with who cleared it, the group's first clear as an achievement (Nico, 2026-10-28: brainstorm after E8, then designs).
- PvP ladder: a competitive ranking on the site and in the addon (Nico, 2026-10-28: new stories after the E8 designs).
- The class per name in recap cards (award winners, the cards' characters), so the bot can put its class icon before them (bot BOT-11 left the recap without icons for lack of it).

## E8 Recap v2: PvP, danger, loot (decided with Nico, 2026-10-28)
New milestones, awards, cards, headlines and challenges from the data the addon starts sending in CF-52 and CF-53. The full current list is `docs/RECAP.md`. Update it in each story. Nico plays only on the PvP ruleset, so there are no Hardcore stories. Gold is **never** shown as an amount (not on the site, not in Discord, not in card facts the bot gets), only relatively. The designs come from Nico (prompt: `docs/DESIGN-PROMPT-RECAP-V2.md`). Texts and logic can be built before them; card images wait for the designs. Order: WEB-55, then WEB-56 and WEB-57; the bot's BOT-14 after WEB-56.

Compatibility: uploads from addons without CF-52 or CF-53 have none of the new fields. Each field is optional everywhere, and a card or milestone whose data is missing never shows (it never shows a zero as if it were known).

### WEB-55 Store PvP, danger and loot data from uploads
- Read the new character fields (`pvp`, `riding`) and the new feed fields (`kills`, `deaths`, `duels`, `loot`, `gold`, `sessions`, `groups`) from uploads into the derived data, kept per realm day like the activity feed. A rebuild gives the same result.
- Validate and cap them as the addon does; unknown causes become `other`.
- `docs/ARCHITECTURE.md` and `docs/UPLOADER-API.md` (if the upload format is described there) updated; tests on a fixture with every new field and on one without them.

### WEB-56 New milestones
- New `milestones` kinds in the bot API (`docs/BOT-API.md`):
  - `honorKills`: first honorable kill, then 100, 1,000 and 5,000
  - `pvpRank`: a new PvP rank reached, with the rank's title
  - `firstEpic`: a character's first epic item, with the item id
  - `mount`: riding 75
  - `epicMount`: riding 150
- Same rules as now: the site's first upload makes none, and a rebuild never makes events again. A bot without BOT-14 skips kinds it doesn't know.
- Card images for `pvpRank`, `firstEpic` and `epicMount` once the designs are in (as WEB-41d).

### WEB-57 New recap cards, awards, headlines and challenges
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
