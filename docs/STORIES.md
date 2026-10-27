# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-27): WEB-44, then Runs v2 (WEB-47, WEB-48, WEB-49, WEB-50), WEB-43, WEB-39b (look-ups for the bot), WEB-42, WEB-45. The order across the repos is under E7.

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

Order (2026-10-27; WEB-32, WEB-38, WEB-40 and WEB-46 are done): WEB-44, Runs v2 (WEB-47 first, then WEB-48, WEB-49, WEB-50), WEB-43, WEB-39b, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### Runs v2 (WEB-47 to WEB-50)
Nico tested Runs on the live site (27 Oct 2026) and the design came back as "Runs v2" (Nico, 2026-10-27): any character can join, the role is picked apart from the character, the organiser can move people, and styled dropdowns replace every native one. Boards: `runs-v2-findings` (the 15 issues, each with what was seen and the fix), `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`. They are newer than `runs`, `run-detail` and `run-create` where they overlap. Done for all four when none of the 15 findings can be reproduced, at 1440 and 375 px. Decided with Nico: four stories, right after WEB-44 and before WEB-43; the dropdown is built in house (ARIA listbox and combobox, no new dependency); account names on the boards were replaced with made-up ones (characters are fine).

### WEB-49 Character and role picker, run detail v2
- Boards: `runs-v2-picker`, `runs-v2-run-detail`. Needs WEB-47 and WEB-48.
- **The picker** (replaces the character select on the run page and Lead as in Plan and Edit) in three steps: every character of the user with its level fit tag, nothing hidden; the role as a segmented control, roles the class can't play disabled with a reason ("not for priests"), each with its state ("open", "3 open", "full → reserve"); the answer (I'm in, Maybe, Can't) with a summary line ("You join as Kaz Coldbrew · Healer") and Save answer. A popover from the Answer button on desktop, a bottom sheet under 640 px. After saving the card collapses to "You're in as … · Role · Change"; reserve reads "Damage is full · you'd be reserve as …". Characters are a listbox, roles and answers radiogroups; full keyboard use, focus trapped in the sheet, Esc closes, 44 px targets.
- **Run detail:** the organiser gets a bar "You lead as … · Tank" with Change character or role instead of the answer card; Edit and Delete move to the hero; "Only the organiser can edit" is not shown to the organiser. The time is as large as the title with the countdown next to it. A filled slot shows a disc, the role, the character on its own line, level · class · friend and the fit tag; an open slot only "Open" and one fact ("1 left", "No healer in range · Kaz Coldbrew is 4 below"), never a list of names (finding 1). A "Could fill" line under the group (up to 3 characters that fit or are over and haven't answered, for the open roles), then a row each for Maybe and Reserve. The organiser's ⋯ menu per filled slot (the WEB-48 menu): move to another role ("open", "taken by …", "current"), Move to reserve, Remove from run (red). The answers table gets Fit and Role columns, and "When · where" has the day ("Wed 09:12 · Discord").
- Tests: picker flows at desktop and phone (pick, change, reserve), the organiser's move menu, design checks.

### WEB-50 Plan and Edit v2, runs list
- Board: `runs-v2-plan`, `runs-v2-findings`. Needs WEB-48 and WEB-49 (the picker for Lead as).
- **Plan and Edit:** the dungeon starts empty ("Pick a dungeon") unless the user came from a dungeon page or roster band, or one dungeon clearly fits the chosen character (finding 6). The dungeon dropdown: "Fits your characters" first, then "All dungeons by level" with the Forever dungeons mixed in by level ("Forever" as meta); each row its range and the best fit of the user's characters ("Vesgar 27 fits", "Twinkle 5 below"); while searching, a group with the other wings of the same dungeon. Lead as: the picker with character and role, no answer step. Day: one row of chips (Today and the next 6 days) and the calendar button, nothing wraps. Time: chips 19:00, 19:30, 20:00, 20:30, 21:00 and "Other…" for the time input.
- **Runs list:** the summary "1 in · 4 open · no healer in range" (finding 11); the 5-part slot bar with role letters (T, H, D) and a tooltip; "Your answers" shows character and role ("Graveyard · organiser as Vesgar · Tank").
- **Copy** (finding 12): "Organiser takes a slot"; "Website · Tue 23:24" with the day; the "posted once the admin picks a channel" hint only for the admin.
- Tests: the dungeon dropdown's groups and search, the day and time chips, no native select, date or time input left on the Runs pages (a test that fails on one).

### WEB-39b Look-ups for the bot
Split from WEB-39 (Nico, 2026-10-27); after WEB-38, whose bot token check it uses.
- `GET lookup/...` endpoints for the bot's commands (`/whereis`, `/who`, `/whocancraft`, `/character` with autocomplete, `/alts`, `/me`, `/runs`), answered for a Discord user id only when it is linked to a member or guest (`linkForDiscordUser`, `src/server/discord.ts`, then the role as for a session).

### WEB-42 Dungeon page
- Board: `dungeon-page`. A page per dungeon (`/dungeons/<id>`), Scarlet Monastery as its four wings (WEB-32), each with its own range: who fits per role, runs planned here and in the other wings, "Ran here" (WEB-43), Plan a run.
- The map's dungeon markers get a badge with the number of planned runs; their popover has Plan a run and Dungeon page.

### WEB-45 Runs on the roster and the map
- Board: `roster-cards-runs`. The "Next run" card on the roster; a dungeon band opens a popover with who fits, planned runs, Plan a run and Dungeon page; the Role filter.
- After WEB-32, which builds the level spread itself.
- Runs v2 (board `runs-v2-plan`, "Roster bands v2"; findings 13 and 14): at most 4 rows of bands, sorted by how many fit and packed without overlap, with "Show all N"; the full name where the band is wide enough, otherwise a short one ("SM Graveyard") with the full name on hover, never cut mid-word; a click opens the popover (name, range, how many fit, missing roles, planned runs, Plan a run and View run). The dot tooltip flips below the dot when there is no room above, one row per character without wrapping. Fit from WEB-47's `levelFit`.

### Backlog (unordered, not yet stories)
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
