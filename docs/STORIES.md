# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-27): WEB-44, then Runs v2 (WEB-47, WEB-48, WEB-49, WEB-50), WEB-43, WEB-39b (look-ups for the bot), WEB-41, WEB-42, WEB-45. The order across the repos is under E7.

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

Order (2026-10-27; WEB-32, WEB-38, WEB-40 and WEB-46 are done): WEB-44, Runs v2 (WEB-47 first, then WEB-48, WEB-49, WEB-50), WEB-43, WEB-39b, WEB-41, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### Runs v2 (WEB-47 to WEB-50)
Nico tested Runs on the live site (27 Oct 2026) and the design came back as "Runs v2" (Nico, 2026-10-27): any character can join, the role is picked apart from the character, the organiser can move people, and styled dropdowns replace every native one. Boards: `runs-v2-findings` (the 15 issues, each with what was seen and the fix), `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`. They are newer than `runs`, `run-detail` and `run-create` where they overlap. Done for all four when none of the 15 findings can be reproduced, at 1440 and 375 px. Decided with Nico: four stories, right after WEB-44 and before WEB-43; the dropdown is built in house (ARIA listbox and combobox, no new dependency); account names on the boards were replaced with made-up ones (characters are fine).

### WEB-47 Runs v2: level fit, roles and reserve
- **One rule for level fit** in `src/core`: `levelFit(level, min, max)` gives `{ kind, label }`, used everywhere a fit shows (runs list, run detail, Plan and Edit, the Discord run post data, "could join", the roster bands; today the same character is "too low" on one page and "16 levels short" on another):

  | kind | rule | label | can pick | suggested ("could fill") |
  |---|---|---|---|---|
  | fits | min ≤ level ≤ max | `fits` | yes | yes |
  | over | 1–9 above max | `+N over` | yes | yes |
  | carry | 10+ above max | `carry · +N` | yes, with a one-line XP note | no |
  | low | 1–5 below min | `N below` | yes, with a "tough" note | no |
  | tooLow | 6+ below min | `N below` | listed, can only answer Maybe | no |

  "Runs I can join" means a character that fits or is over.
- **Roles per class** in `src/core`: `rolesFor(class)`: Warrior tank and damage; Paladin and Druid tank, healer and damage; Priest and Shaman healer and damage; Mage, Warlock, Hunter and Rogue damage. The default is the role the addon reports (talents or set by the player); a choice here is per run and never changes the addon.
- **Data** (forward-only migration): a sign-up stores the character and the role apart (no longer derived from the character); existing sign-ups get the character's current role. A new answer state **reserve**: I'm in for a full role becomes reserve, and when a slot of that role frees up the oldest reserve moves up (next to WEB-40's moving up from Maybe). The organiser's own entry has a role and can change character and role.
- **API:** answering takes `{ characterId, role, answer }`; a new organiser and admin endpoint moves a sign-up to another role, to reserve, or removes it, and the moved person gets a quiet Discord notice (a bot event, no channel ping). Server checks: the role is in `rolesFor`, a tooLow character can only answer Maybe, only the organiser or the admin moves or removes.
- **Compatible additions** (rule 5 and the API contracts): `docs/BOT-API.md` (answer with role, the move action, the quiet notice event, role and fit per sign-up in run events), WEB-44's runs feed (role, fit and reserve per answer, so the uploader writes them into `Runs.lua`) all as optional fields within v1. Older bots and uploaders keep working; the bot's BOT-04 and the addon pick them up.
- Tests: `levelFit` at every boundary, `rolesFor` for every class, reserve promotion (oldest first, per role), the move endpoint's rights (organiser, admin, anyone else), the migration on existing sign-ups.

### WEB-48 Dropdown, date and time components
- Board: `runs-v2-plan` (the dropdown spec) and the design system. One styled **dropdown** replaces every native `<select>` on the site (Runs, Discord page and the rest). Trigger 44 px, `#0B1220`, 1 px line, gold caret; states default, placeholder, open and focus (gold border and 3 px gold glow), disabled. Menu: surface `#0E1626` with a gold line, 12 px radius, group headers in caps; an option has a name, dim meta and a right-side hint; the selected one a gold check, the keyboard highlight a gold wash; disabled options stay visible with a reason; a search field from 8 options; arrows, Enter, Esc and type-to-jump; under 640 px a bottom sheet. Existing tokens only; values not in `tokens.css` yet are added as tokens (rule 12).
- Built in house with the ARIA listbox and combobox patterns (no headless library in the project, no new dependency).
- **Date and time:** a styled date popover behind a 44×44 calendar button and a styled time input, so no native date or time input is left (no OS icons).
- `html { scrollbar-gutter: stable; }` (finding 9: Plan a run jumps sideways when the scrollbar appears).
- Design checks for every state at desktop and phone; Playwright keyboard tests (open, search, pick, Esc), axe clean.

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

### WEB-43 Runs from uploads
- Runs v2 (WEB-47): answers from the game carry a role when the addon sends one; without it the character's current role, as before.
- The addon (CF-47, CF-48) writes runs planned, answers given, asks with "Also post on Discord" and Discord pings made in game into its saved file; the site reads them from each upload (parser and compat fixtures, CLAUDE.md rule 4) and turns them into runs, answers and events. Each item carries an id from the addon, so a file uploaded twice changes nothing.
- An ask now from the game expires 10 minutes after it was made in game, and is only posted while it hasn't.
- Done: when an upload's run log (addon CF-23: dungeon, time, community members in the group) shows the dungeon within the run's window, the run becomes "Ran it · N of M signed-up came" and counts for the recap (WEB-41). No such upload within 4 hours of the start: "didn't happen".
- The session report and the uploader's summary show "N run answers".

### WEB-39b Look-ups for the bot
Split from WEB-39 (Nico, 2026-10-27); after WEB-38, whose bot token check it uses.
- `GET lookup/...` endpoints for the bot's commands (`/whereis`, `/who`, `/whocancraft`, `/character` with autocomplete, `/alts`, `/me`, `/runs`), answered for a Discord user id only when it is linked to a member or guest (`linkForDiscordUser`, `src/server/discord.ts`, then the role as for a session).

### WEB-41 Weekly recap and card images
Decided with Nico, 2026-10-27. The catalogue (48 cards), rotation rules and example weeks are on the bot repo's `bot-recap` board.
- **When:** every Sunday 13:00 in the admin's time zone (Europe/Amsterdam; the board says 20:00, a deviation in the bot repo's `docs/DESIGN-NOTES.md`). Stored and computed in UTC, so daylight saving moves nothing. A week runs from the previous recap moment to this one; an upload after it counts for the next week.
- **History:** the addon's feed covers only the last 7 days, so the site stores the feed per realm day per character from every accepted upload (the newest upload wins for a day). Snapshot cards (item level, talents, professions, quest logs) compare the characters at the start and end of the week. Friends without "Share my activity" or without the addon only appear in snapshot cards.
- **Cards are pure functions** in `src/core/recap/`: week facts in, `{ eligible, score, facts }` out. The score is relative to earlier weeks (a rare event beats a usual one). Each card has its threshold from the board (e.g. Gear jump ≥ 5 item levels).
- **Rotation:** 4 cards (one stat, one progress, one social, one fun), the award and the challenge as on the board: eligible only above the threshold and not used in the last 4 weeks; the highest score per slot; ties broken with the week number as seed; at most one card per friend and the award winner excluded from the other cards; quiet weeks (under 3 levels in total) get the short recap.
- **Text from templates:** every card, headline (10) and challenge (12) has several phrasings (3 to 5, plus closing lines), filled with the facts. **A phrasing is not used again until all phrasings of that card have been used** (a cycle per card, stored with the recap history, the order seeded by the week number), so the same sentence doesn't come back soon.
- **No pronouns** in any template ("Somebody pay a visit.", not the board's "Somebody visit her."). Full character names, display names for friends, never BattleTags.
- **Who am I?:** a riddle generated from the character's facts (class, race, zone, profession, level), the answer in a Discord spoiler.
- **Later, not in this story:** the weak cards A7 Social butterfly, S11 Biggest group night, F5 Road trip, F7 Night owl and F8 Early bird (the addon records group members only inside instances and one time per character per day); they wait for an addon story. AI-written closing lines are an open option (it would send names to an outside API; Nico decides).
- **Re-runs are identical:** the recap is computed once and stored (cards, phrasings, facts); the admin preview shows the coming one, `/recap` the last one.
- **Card images** rendered by the site (`GET cards/<id>.png`: level 60, recap header, map crops), with the map's CC BY-SA attribution where the map shows.
- Tests: every card function on sample weeks (eligible, not eligible, score), the rotation (cooldown, one card per friend, quiet week, seed), the phrasing cycle (no repeat before all are used), the week window around daylight saving.
- Decided with Nico (2026-10-27, all 7 proposals):
  - four PRs, merged in order: a) history and the week window, b) the card functions and rotation, c) the recap job, the bot event and the preview, d) card images;
  - the recap is started by a check every minute inside the site process, which computes it once and catches up after downtime;
  - the sighting history is stored (zones per day for Tourist, Zone of the week, Map coverage, First footsteps, Homebody, Ghost town);
  - images with Next's built-in `next/og`: map crops from `zones.json`, the zone header with its map crop, the award header with the winner's class disc;
  - the admin's preview is a page `/discord/recap` (its screenshots need Nico's look);
  - the award is "<site name> of the week", the site name from the data;
  - week 1 is the first recap after launch; Then vs now, Season stats and Hall of fame count from there.
- Nico's card image references (2026-10-27): level 60, new character at 60, profession 300, the recap headers (award, zone), zone of the week and /whereis; all seven go into WEB-41d's renderer (BOT-03 and BOT-06 use them later).
- WEB-41a done (PR #68): `readFeeds` (`src/core/feed.ts`, compat snapshots for every release), the history tables `feed_days`, `feed_sharing`, `sightings` (migration `0009_history`, written with every accepted upload and by `rebuild()`), the recap moment in UTC (`src/core/recap/week.ts`: the latest weekday and time in a time zone, daylight saving, the week `[start, end)`).
- WEB-41b done (PR #72): `src/core/recap/` (pure). `cards.ts`: the 43 cards; `recap.ts`: the rotation, the quiet week, the headline (10 kinds) and challenge (12) choice; `texts.ts`: 3 phrasings per card, headline and challenge, closing lines, no pronouns (a test checks); `phrasing.ts`: the cycle per key, seeded by the week number. Choices made while building:
  - Slots: social are Duo of the week, Shared quest jackpot, Ghost town and Group suggestion; fun are First footsteps, Homebody, Most loyal alt, Longest streak, Fresh face and Who am I?.
  - Awards have no cooldown (the board's 10-week plan repeats The Grinder within 4 weeks); the rotating cards and the challenge do.
  - A character new this week counts no levels gained (its levels came before the site knew it); Fresh face is about it.
  - Thresholds where the board names none: The Grinder 2 levels, Tourist 3 zones, Altoholic 2 characters, Crafter 10 skill points, Quest machine 5 quests, Dungeon diver 2 runs, The Comeback 14 days away, Most improved and Gear jump 5 item levels, Zone of the week 2 friends, Busiest evening 3 friends, Top dungeon 2 runs, Quest log hoarder 15 quests, Gap alert below 175, Crafting race within 10 points, Ghost town 14 days, Most loyal alt 4 days, Longest streak 3 days, Group suggestion 3 friends, Shared quest jackpot 5 quests.
- WEB-41c done (PR #73): migration `0010_recaps` (`recaps`, `recap_start`), `src/server/recap.ts` (the schedule from the Discord page and the admin's time zone, the week's input from the history, `runDueRecap`, `previewRecap`), the check every minute in `src/instrumentation.ts`, the `recap` bot event and `GET /api/bot/v1/recap/latest` (`docs/BOT-API.md`), the admin's preview `/discord/recap` (DESIGN.md §11) linked from the Discord page. Sightings count by map zone (a dungeon's zone; battlegrounds and unknown places don't count); a recap is computed even while the Weekly recap is off (the history stays whole) but only posted while it is on.

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
