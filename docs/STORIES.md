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
