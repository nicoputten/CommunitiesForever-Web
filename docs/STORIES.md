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

### WEB-28 Phone map
- Boards: `phone-map`, `phone-character`, `phone-roll-call`. Bottom sheet: peek → half → full (built without `vaul`, see `docs/ARCHITECTURE.md`).
- Peek: the first roll call rows; edge hint "4 in Kalimdor". Tapping a marker zooms in and opens the character half sheet (level, seen, player, item level, role, spec, talents, professions, "Open character", next character in the zone). The full sheet is the roll call with its filters.
- Bug (found in WEB-27, Nico 2026-10-27): on a phone, `?continent=eastern-kingdoms` framed the continent and sprang back to the whole world about 120 ms later. Fixed: a continent frames at 1.25× at least and the phone map fills the screen (`map-continent-phone` shows the continent again).
- Decided with Nico (2026-10-27, all 12 proposals): the sheet below 1024 px; snap points 136 / 400 px above the tab bar and 96 px from the top; full names in the peek and the next button; `?character=` as a history entry (Back closes); the WEB-27 filters in the full sheet; the approved phone app bar plus Filters; the edge hint on either side; 120 ms fade without motion. Deviations in `docs/DESIGN.md` §11.

## E6 Later

### WEB-12 Automatic uploader
- A small program on an uploader's PC that watches the SavedVariables file and uploads it after the game writes it, with an upload-scoped API token (new API route).
- **Built as a .NET app** (decided by Nico, 2026-10-27). The exact .NET version, UI framework, packaging and where it lives in the repo are decided in the story; it is a second stack next to the site, so its toolchain and dependencies get listed in `docs/ARCHITECTURE.md` with Nico's OK (CLAUDE.md rule 9).
- **Blocked on design:** Nico makes the uploader's design first and supplies it (like the Claude Design boards for the site). No building before that design is in the repo.
- Open questions for the story (with the design): who gets tokens and how they are created and revoked (admin page or per user), how the program finds the WoW folder, debounce after the game writes the file, offline retry, auto-start with Windows, updates.

### WEB-32 Known bugs
One story for the known bugs, fixed together (Nico, 2026-10-27). Add each one here with where it shows; each fix gets a test.

### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
