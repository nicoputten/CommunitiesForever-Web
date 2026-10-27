# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-27): WEB-40, WEB-44, WEB-43, WEB-39b (look-ups for the bot), WEB-41, WEB-42, WEB-45. The order across the repos is under E7.

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

Order (2026-10-27; WEB-32 and WEB-38 are done): WEB-40, WEB-44, WEB-43, WEB-39b, WEB-41, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### WEB-40 Runs
- Boards: `runs`, `run-detail`, `run-create`, `runs-phone`. "Runs" in the top bar with the number of upcoming runs you can join.
- Model (own database, forward-only migration): run (dungeon or wing, start in UTC, note, organiser and their character, source website / Discord / game, state open, full, started, done, didn't happen, cancelled), five role slots (tank, healer, three damage) filled from the role the addon knows per character (from talents or set by the player), answers (I'm in / Maybe / Can't, character, where it came from and when).
- Runs page: this week, later, past; filters "Runs I can join" (one of your characters fits), Mine, All; your answers; "Where runs show up". Run detail: slots, answers with their source, who could join, the organiser's edit and delete, the admin's delete; times as "19:30 your time · 20:30 for Nico". Plan a run: dungeon (filled in when coming from a dungeon page or a roster band), lead as, day, time in your time zone ("everyone sees it in their own time"), note, the Discord preview, the time-passed and no-character-fits states.
- Full run: when someone drops out, the first Maybe whose character fits the free role moves up automatically and gets a quiet notice (Nico, 2026-10-27).
- Phone: answer buttons 44 px at the bottom; empty, loading and error states; an answer that didn't go through is kept on the phone and retried.
- Bot API (from WEB-38): the run events and run actions drafted in `docs/BOT-API.md` (create, answer, edit, cancel for a linked Discord user; created, changed, cancelled, reminder, starting, ended), with tests for run rights through the bot.
- Tests: rights (own, admin), slots from roles, moving up from Maybe, time zones around daylight saving.
- The Discord page's "Send a test run post" (disabled since WEB-39) posts a sample run in the runs channel (Nico, 2026-10-27).

### WEB-44 Runs for the uploader
- `GET /api/uploader/v1/runs`: the upcoming runs (next 14 days) of the uploader's community, with slots, answers, the organiser's time zone offset and `updatedAt`; documented in `docs/UPLOADER-API.md` (an optional addition; the uploader's v1 stays valid).
- Tests: only the token's community, only upcoming runs, the shape the uploader writes into `Runs.lua` (UP-12).

### WEB-43 Runs from uploads
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

### WEB-42 Dungeon page
- Board: `dungeon-page`. A page per dungeon (`/dungeons/<id>`), Scarlet Monastery as its four wings (WEB-32), each with its own range: who fits per role, runs planned here and in the other wings, "Ran here" (WEB-43), Plan a run.
- The map's dungeon markers get a badge with the number of planned runs; their popover has Plan a run and Dungeon page.

### WEB-45 Runs on the roster and the map
- Board: `roster-cards-runs`. The "Next run" card on the roster; a dungeon band opens a popover with who fits, planned runs, Plan a run and Dungeon page; the Role filter.
- After WEB-32, which builds the level spread itself.

### Backlog (unordered, not yet stories)
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
