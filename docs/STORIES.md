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
- The class per name in recap cards (award winners, the cards' characters), so the bot can put its class icon before them (bot BOT-11 left the recap without icons for lack of it).

## E10 Dailies and weeklies (decided with Nico, 2026-10-28)
Small personal goals per friend: 3 dailies per realm day and 3 weeklies per week (Monday to Sunday). They earn **DoomPoints PvE** (1 per daily, 3 per weekly) and a streak (days in a row with all 3 dailies). The pool, the pick, the swaps and the points are in the addon repo's `docs/DAILIES.md` (addon stories CF-57 to CF-60). **The addon decides what's done** and uploads it in the record's `goals` field (CF-58). The site doesn't recompute goals: it stores, counts and shows them. The PvP ladder's **DoomPoints PvP** (E9) are separate. Wherever a friend's points show, PvE and PvP stand side by side, never added up. The ladder's own PvP goals (Hunt, Daily, Duel, Weekly bounty) are not part of this. The designs come from Nico (prompt: `docs/DESIGN-PROMPT-DAILIES.md`). Order: WEB-60 after the addon's CF-58, then WEB-61 (after the designs) and WEB-62. The bot's BOT-16 after WEB-62.

Compatibility: uploads from addons without CF-58 have no `goals`. Those friends show "not shared yet", never zero points or a broken streak. A friend who turned off "Share my activity" sends `goals = false`: their stored goals stop showing, as with the feed.

### WEB-60 Store dailies and weeklies from uploads
- Read `goals` (own record and friends' records in an upload): per realm day `set`, `swapped`, `done`, `at`; per week the same; `pool`. Keep them per friend and per realm day or week in the derived data, kept as long as the activity feed (not only the 7 days an upload holds). The newer `at` wins, as the addon merges. A rebuild gives the same result.
- Validate and cap as the addon does (ids ≤ 24 characters, at most 3 per set, numbers ≥ 0).
- Derived per friend: DoomPoints PvE this week, last week and all time (counted from the stored days, 1 per daily and 3 per weekly, not taken from the addon's `total`); the current and best streak; dailies done per day.
- A catalogue `src/core/dailies/catalogue.ts` with every id and title from the addon's `docs/DAILIES.md`. An unknown id shows as "A daily from a newer addon" and still counts.
- `docs/ARCHITECTURE.md` updated. Tests on a fixture with `goals`, one without it, and one with `false`; points and streaks across a missed day and a week boundary.

### WEB-61 Dailies page and points on the roster
- A new page **Dailies** (`/dailies`, in the navigation):
  - **Today:** this realm day's base set (the 3 dailies) and, per friend, a check mark per goal they finished. A friend's swapped goal shows as the swap, with the original in its tooltip. The time until the realm day resets.
  - **This week:** the same for the 3 weeklies, with the time until Monday.
  - **Friends:** per friend the streak (and best), **DoomPoints · PvE** this week and all time, with **PvP** next to it from E9 once that's built, and a calendar heatmap of dailies done per day (0 to 3) for the last 12 weeks.
  - States: nobody shares yet ("No dailies yet: friends need an addon version with dailies"), only some friends, loading, error.
- The roster shows the PvE points and the streak per friend, next to the PvP points (E9), in the place the design gives.
- As every UI story (design checks, 375 and 1440 px, Playwright).

### WEB-62 Dailies in the weekly recap
IDs continue the catalogue (`docs/RECAP.md`). The existing rules apply: threshold, score against earlier weeks, 3 phrasings, a 4-week cooldown, at most one card per friend.
- Award **A15 Daily devotee:** the most DoomPoints PvE in the recap week, at least 10. ("Ada earned 19 DoomPoints PvE")
- Fun card **F23 Perfect week:** all 3 dailies on every day the friend played, at least 4 days. ("Bob did every daily on 5 days")
- The recap week counts each realm day it covers. Weeklies count in the week they were done.
- The award and card go to the bot through the recap API as every card does (`facts`: points, days, streak). No new milestone kinds and no live posts.
- `docs/RECAP.md` updated. Tests: above and below the threshold, and absent without `goals`.
