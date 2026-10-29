# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-29): E9, the live test of 29 Oct: WEB-65 (site fixes) and WEB-66 (rules and bot images) side by side, with the bot's BOT-20 on WEB-66's contract. Doomsday (E8, `docs/STORIES-COMPLETED.md`) is done and waits for the release.

## Every UI story
- Build the screen in our Next.js app with the tokens from `src/styles/tokens.css` and real data through the view models. The board in `design/boards/` is a **visual reference only**: match its spacing, type and colours, never copy its markup or runtime.
- Always the design system (CLAUDE.md rules 11 and 12): no raw values outside the tokens, design system components first. A deviation only after Nico said so, recorded in `docs/DESIGN.md` "Deviations".
- The screen gets its design checks (WEB-30): computed-style checks for its key elements, accessibility scan, screenshot baselines at desktop and phone size.
- Accessible: semantic HTML, visible focus states, keyboard use, 44 px touch targets, contrast as in `docs/DESIGN.md`, `prefers-reduced-motion` honoured.
- Works at 375 px (phone) and 1440 px (desktop canvas); page max-width 1280.
- Empty, loading and error states of the screen are part of the story.
- Playwright test for the main flow at desktop and phone size; screenshots of both in the PR next to the board.

## E9 Live test of 29 Oct
Nico's brief `docs/DESIGN-BRIEF-LIVE-TEST.md` (2026-10-29), boards `live-test-*` and `bot-visual-*`. WEB-65 is the site's side (parts 1, 3 and 4 and the site's bugs 3, 6 and 7), WEB-66 the rules and the images (parts 2 and 5), bot BOT-20 the posts. No designer notes or legends in any image or text (Nico).

### WEB-66 Live-test data rules and bot images
Agreed with Nico (2026-10-29). Boards: `bot-visual-recap`, `bot-visual-daily`, `bot-visual-feats`. The contract is in `docs/BOT-API.md` ("Visual posts (WEB-66)"), written first so the bot (BOT-20) builds against it. Where the addon's `docs/DOOMSDAY.md` changes (the PvP Virgin rule, the day label, the goal count, the short labels), a small addon docs PR goes with it.

**Rules (brief part 2, bugs 1, 2, 4 and 5), each with a unit test:**
- **PvP Virgin:** a friend stays a PvP Virgin only with 0 all-time PvP points across all characters, duel points included, **and** no honorable kill ever (Nico: "no points and no kill"). Any PvP point or any kill ends it, everywhere: the roster, the Doomsday board, the ladder, the bot (`pvpVirgin`, `pvp: null`).
- **Rank title:** a character without a rank shows "Conscientious Objector" only while its friend is a PvP Virgin (the rule above). Otherwise "No rank yet · N kills" (N: the character's honorable kills).
- **Goal count:** "N of M done" counts exactly the goals on the grid: the 3 PvE dailies, the Hunt and/or the Skirmish (6 on a day with both), and the Duel slot, done after its first duel. The same count goes to the bot (`doneCount`, new `goalCount`).
- **The day label follows the reset:** a Doomsday day runs from reset to reset and is named after its start, the weekday plus the part of the day of the reset hour: 05–11 "morning", 12–16 "afternoon", 17–21 "evening", 22–04 "night" (Nico: part of day by reset). With the default reset that is "Wed evening", with the span "Wed 19:00 → Thu 19:00". Times after midnight carry their weekday ("done Thu 00:04"), and the countdown reads "resets Thu 19:00 · in 6 h 51 m". All of these are realm time, the same on the site, in the bot and in the addon's chat lines.

**Images (brief part 5), drawn by the existing card renderer (`src/server/cards`, Satori), same fonts, night background, gold frame, footer "wow.vestras.nl":**
- **Daily board, 800 × 560** (`BV2Daily`):
  - header: the emblem, "DOOMSDAY", then "Wed evening · <state>" (just started, the time of the last change, or final)
  - one column per daily goal with its `shortLabel` under PvE or PvP
  - one row per friend with Doomsday data: the name (30 px, struck through when all PvE dailies are done, the crown after the first to finish), 44 px boxes (PvE done green with a check, PvP done red, open as a dark outline), "PvP Virgin" across the PvP columns while the rule above holds, "Today" as PvE · PvP points, the streak with a flame
  - footer: "resets Thu 19:00" at the start, "resets in 5 h 50 m" during the day, "Mira first at 23:13 · 14 goals done" when final
  - Friends without Doomsday data are left out of the image.
- **`shortLabel`** on every daily goal of the catalogue (max 10 characters, one or two words: "Level", "3 quests", "Skills", "Hunt", "Lone wolf"), in `src/core/doomsday/rules.ts` and in `DOOMSDAY.md`. A test checks the length and that every daily goal has one.
- **The board's news line**, one sentence, made by the site:
  - at the reset: the goals in full and "5 points each"
  - during the day: who finished first and who is 1 away ("Mira finished all dailies first (23:13). Ada and Tok are 1 away.")
  - final: "Day over: 14 goals done. Mira first at 23:13, longest streak Tok with 7. New board at 19:00."
  - "2 friends without addon data" when there are any
- **Feat cards** (`BV3Feats`): every feat gets a card.
  - Big, 800 × 400 (the existing feat card): PvP rank 6 and up, level 60, epic items, mounts, the watch list's items, 1,000+ honorable kills, and any feat that is "First in the group".
  - Strip, 800 × 240 (new): every other feat. The recap icon at 140 px on the left, "FEAT UNLOCKED", the title (Marcellus SC 46 px), the character in class colour and one line, the "First in the group" badge top right when it applies.
  - Several feats in one upload: one card, the most special one. Big beats strip, then "First in the group", then the rarer kind.
  - New characters are never a feat or a card: one line per upload, "+3 new characters: Grosh Bonechewer 60, …".
- **Recap images** (`BV1Recap`):
  - the award header, 1200 × 400, with the winner's class disc
  - the zone crop, 800 × 450, with "Map: Syrio, CC BY-SA 4.0", for Zone of the week and Bloodbath zone
  - the icon thumbnails: the 128 px PNGs of Nico's `doombot-recap-icons` set (Nico sends it; it goes in `design/cards/recap-icons/` and is served as `cards/icon-<name>.png`), one per recap card and per feat kind for the strip card
  - each card gets its colour (the icon's), the award the winner's class colour
  - the header's six numbers: honorable kills, battlegrounds, levels, friends played, dungeon runs, feats
  - the links: "The full week ↗" goes to the Doomsday page's Week tab (Nico), "Doomsday ladder ↗" to the ladder
- If an image can't be drawn, its id answers 404 and the bot posts without it.

**Tests:**
- unit: the PvP Virgin rule (only duel points ends it; a kill without points ends it), the rank title, the goal count (5, 6 with Hunt and Skirmish, the duel slot), the day label (each part of the day, a time after midnight, the countdown), `shortLabel` length, the news line, big or strip per feat kind and the "most special" pick
- server: each new card id renders a PNG of the right size; the bot API carries the new fields; a friend with only duel points is no Virgin in the board event
- No designer notes or legends in any image or text.

**Manual:** with BOT-20 deployed, a test recap, test board and test feat from the Discord page's buttons, into the test channel, look like the boards on Discord desktop and on a phone.

## E3 Access and hosting

## E4 Design foundations

## E5 Screens

## E6 Later

## E7 Discord bot and planned runs
The bot lives in its own public repo, [CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord) (BOT-01..07). The site is its only data source: it decides milestones, runs, the recap and who is linked; the bot formats and posts (decided with Nico, 2026-10-27). Design: the canvas's §12 "Discord bot" and the planned-runs boards (`design/README.md`; the flow: `runs-flow`).

**Planned runs** (decided with Nico, 2026-10-27): two kinds of group. *Ask now* lives in the game (addon CF-27) and is answered within minutes; with "Also post on Discord" it reaches the site after a `/reload` and the bot posts it. A *planned run* is owned by the site, posted and answered in Discord, reaches the game through the uploader (`Runs.lua`) and friends' addons, and ends in an invite in the game at start time. The in-game calendar is out of the flow. Times are stored in UTC and shown in each viewer's own time zone. Any linked friend can plan; organisers edit and delete their own runs, an admin can delete any run (the owner, `ADMIN_BATTLETAG`, and the admins the owner appoints, WEB-64). Reminders mention only those who answered I'm in or Maybe.

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
