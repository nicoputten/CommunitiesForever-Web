# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order: WEB-06, WEB-15, WEB-30, WEB-16, WEB-07, then the screens WEB-17..29 in number order, WEB-12 last.
WEB-08..11 (the first rough view stories) were replaced by WEB-15..29 after the design workshop.

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

### WEB-18 Admin page: guest list
- Admin only. Members (from the data, with the upload that added them, block and unblock), guests (add by BattleTag, remove, "may upload"), who signed in last.
- Validation of BattleTag format; adding an existing member says so.

### WEB-27 Roll call panel
- Board: `map`. Desktop panel next to the map: "Roll call · 9 of 10 located".
- Filters: everyone or one friend, New (under 32 h), faction, level range; legend (new, days, week+).
- Rows grouped by age with zone, owner, "via", age; picking one flies the map to the character.
- Unknown whereabouts tray and the no-addon line.

### WEB-28 Phone map
- Boards: `phone-map`, `phone-character`, `phone-roll-call`. Bottom sheet with `vaul`: peek → half → full.
- Peek: the first roll call rows; edge hint "4 in Kalimdor". Tapping a marker zooms in and opens the character half sheet (level, seen, player, item level, role, spec, talents, professions, "Open character", next character in the zone). The full sheet is the roll call with its filters.

### WEB-29 Empty site, loading and stale data
- Boards: `empty-site`, `loading`.
- Before the first upload: "The map is still empty", "Upload the first file" for admin and members; for guests: "Nico hasn't uploaded any data yet. Check back after the next session."; the guest list shown in the roll call.
- Loading: zones paint at once, markers fade in, a thin gold line only after 300 ms; skeletons that keep the layout still.
- Stale: the site-wide banner (last upload 7 days or more), a friend's amber badge after 7 days.

## E6 Later

### WEB-12 Automatic uploader
- A small program on an uploader's PC that watches the SavedVariables file and uploads it after the game writes it, with an upload-scoped API token (new API route).
- **Built as a .NET app** (decided by Nico, 2026-10-27). The exact .NET version, UI framework, packaging and where it lives in the repo are decided in the story; it is a second stack next to the site, so its toolchain and dependencies get listed in `docs/ARCHITECTURE.md` with Nico's OK (CLAUDE.md rule 9).
- **Blocked on design:** Nico makes the uploader's design first and supplies it (like the Claude Design boards for the site). No building before that design is in the repo.
- Open questions for the story (with the design): who gets tokens and how they are created and revoked (admin page or per user), how the program finds the WoW folder, debounce after the game writes the file, offline retry, auto-start with Windows, updates.

### WEB-32 Known bugs
One story for the known bugs, fixed together (Nico, 2026-10-27). Add each one here with where it shows; each fix gets a test.
- **Phone map: the endless sea stops.** On a phone the map frame is only as tall as the land (WEB-25/26), so the sea ends under it and the plain page shows below; the sea does not run on around the world as it does on desktop (WEB-25 "endless sea"). Seen in `tests/design/__screenshots__/map.spec.ts/map-phone.png`. Check against WEB-28 (full-screen phone map), which may change the frame.

### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
