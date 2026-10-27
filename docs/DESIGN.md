# Doombringers — design (wow.vestras.nl)

Decisions from the design workshop (WEB-02). The canvas "Doombringers — wow.vestras.nl design" holds every screen (exports in `design/boards/`, index in `design/README.md`); this file is the source of truth for implementation.

## 1. Direction

**A · Night over Azeroth.** Dark night-blue map, gold trim, Vanilla-inspired type, modern atmosphere (fog, light shafts, animated sea, embers, glow on live markers).

- Atmosphere goes **around** the data, never over it.
- The **map** is alive (ambient motion). **Data screens** (roster, professions, character, upload) are calm: same palette, no ambient motion except small accents.
- Name: **Doombringers**. Emblem: shield with cross (placeholder, original).
- No footer (Nico, 2026-10-27, §11); the credits (private fan site, not affiliated with Blizzard, zone outlines by Syrio, Wikimedia Commons, CC BY-SA 4.0, adapted; licence checked in `tools/map/README.md`) come back in another place later.

## 2. Screens (canvas boards)

| Board | Content |
|---|---|
| Main | World map, desktop: top bar, continent switch, markers, clusters, hover card, roll call panel with filters |
| PhoneMap / PhoneCharacter / PhoneRoll | Phone map with roll-call peek → tapped character (half sheet, zoomed map) → full roll call sheet |
| MapStates | Marker freshness, clusters, zone states, zoom levels, motion table |
| Roster / RosterTable | Cards grouped by friend (level spread + quick answers) and compact sortable table |
| Professions | Recipe search (future), covered/thin/gap summary, cards per profession, character × profession matrix |
| Character | Ves Doombringer detail: level, talents, professions, quest log, last-seen mini map, other characters |
| Upload / UploadResult / UploadStates | Dropzone + history, "Session report", drag/reading/wrong file/newer format/nothing new |
| SignIn / SignInStates | Battle.net sign-in over drifting map; not on the list, Battle.net error, signing in |
| EmptyMap / Loading | Before first upload; skeletons; stale-site banner; old friend data |
| DesignSystem | Tokens and components (this document, visual) |

B (Parchment) and C (Carved) remain on the canvas as rejected directions.

## 3. Tokens

```css
:root {
  /* surfaces */
  --bg-abyss: #050A12;        /* map pages */
  --bg-night: #070C15;        /* data pages */
  --surface: rgba(12,18,30,.78);   /* + backdrop-filter: blur(14px) */
  --surface-strong: rgba(12,18,30,.84);
  --surface-raised: #121B2A;
  --track: #1F2837;
  --line: rgba(212,175,106,.20);
  --line-strong: rgba(212,175,106,.35);

  /* sea & land */
  --sea-light: #10233A; --sea: #0A172A; --sea-deep: #040811;
  --land-top: #26354D; --land-bottom: #151E2E;
  --terrain: #0C121B;                   /* Uldum, Gilneas, Grim Batol */
  --zone-line: rgba(201,164,92,.36);
  --coast: #A9C8EA;  /* @55% */
  --surf: #5E93C9; --wave: #7FA9D6; --foam: #CFE3F7;

  /* gold */
  --gold: #D4AF6A; --gold-bright: #F0D08E; --gold-pale: #F3DFAE;

  /* text */
  --text-strong: #F3EBDA; --text: #E6E1D6;
  --text-muted: #AEB6C3; --text-dim: #8E98A8; --text-faint: #7E8898;
  --on-gold: #0B0F14;

  /* status */
  --fresh: #7FD99A;  --fresh-text: #9BE3B0;
  --stale: #E08A4A;  --stale-text: #F0A774;
  --horde: #B5302A;  --horde-text: #F08A80;
  --alliance: #3A6BD6; --alliance-text: #8DB0FF;
  --bnet-top: #1A8CFF; --bnet-bottom: #0B66D6;
  --ember: #F2B866;

  /* class: fill / text on dark */
  --warrior: #C69B6D; --paladin: #F48CBA; --hunter: #AAD372; --rogue: #FFF468;
  --priest: #FFFFFF;  --shaman: #0070DD; --shaman-text: #4DA3FF;
  --mage: #3FC7EB;    --warlock: #8788EE; --warlock-text: #A9AAF5;
  --druid: #FF7C0A;   --druid-text: #FF9A45;

  /* type */
  --font-display: "Marcellus SC", serif;   /* titles, nav brand, map labels */
  --font-name: "Marcellus", serif;         /* character names, big numbers */
  --font-ui: "Inter", system-ui, sans-serif; /* all data, tabular-nums */

  /* space, radius */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-12: 48px;
  --r-tag: 6px; --r-btn: 10px; --r-panel: 14px; --r-sheet: 18px; --r-modal: 20px; --r-pill: 999px;

  /* elevation */
  --shadow-card: 0 18px 40px rgba(0,0,0,.5);
  --shadow-modal: 0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(240,208,142,.15);
  --shadow-sheet: 0 -12px 30px rgba(0,0,0,.45);

  /* motion */
  --dur-instant: 80ms; --dur-fast: 120ms; --dur-card: 160ms; --dur-fan: 220ms;
  --dur-zone: 250ms; --dur-sheet: 280ms; --dur-drop: 400ms; --dur-fly: 600ms;
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
}
```

Initials on a class fill use `--on-gold` (#0B0F14), except Shaman (white). Use the `-text` variants for names on dark.

### Type scale

| Token | Size | Font | Use |
|---|---|---|---|
| display-xl | 48 | Marcellus SC, +.06em | Session report, sign-in |
| display | 34 | Marcellus SC | Page titles |
| title | 20–22 | Marcellus SC | Panels, brand |
| section | 16 | Marcellus SC, +.08em | Card headers |
| name | 15–21 | Marcellus | Character names |
| map-label | 9–11 | Marcellus SC, 3px dark halo | Zone labels (terrain: Marcellus italic, dim) |
| body | 13–14 | Inter 400/500 | Data |
| meta | 11–12 | Inter, muted | Secondary lines |
| overline | 11 | Inter 500, caps, +.12em | Group headings |

Layout: page max-width 1280, gutter 24 (16 on phone), touch targets ≥ 44px, desktop canvas 1440, phone 375–390.

### Derived from the boards (WEB-15)

`src/styles/tokens.css` has the tokens above as written (part 1) and, in part 2, values the boards use that this section has no token for, each with the board it comes from (decided with Nico, 2026-10-26). They change nothing visually; they give the WEB-30 token lint a name for every value. Groups:
- **Type scale:** `--fs-*` sizes (the sizes inside a range above are the ones the boards use), `--fw-*`, `--lh-*`, `--ls-*` letter spacing.
- **Tints and lines:** `--tint-active` (current nav link, gold 14%), `--tint-pressed` (16%), `--tint-selected` (20%), `--tint-hover`, `--line-bar`, `--line-control`, `--line-neutral` (chip, neutral badge), `--text-chip`, fresh/stale badge lines, banner tint, faction tag tints.
- **Surfaces:** `--control-bg`, `--surface-modal`, `--surface-panel`, `--surface-aside`, row surface, top-bar fades (map and phone), `--avatar` (#2A3446), `--avatar-muted`, skeleton shimmer, `--on-shaman`.
- **Space and radius:** extra steps `--s-px`, `--s-0-5`, `--s-0-75`, `--s-1-5`, `--s-2-5`, `--s-3-5`, `--s-7`, `--s-10`; radii `--r-badge` 4, `--r-nav` 8, `--r-control` 9, `--r-card` 12.
- **Glow, blur, sizes, motion:** disc/avatar glow, `--glow-disc-mix` (live disc glow at 45% of the class colour, WEB-30), `--blur-surface` 14 / `--blur-modal` 16, `--shadow-current` (nav underline), component sizes (`--size-*`: bars, avatar, disc, touch 44, page max 1280, gutters), focus ring, `--dur-shimmer`, `--dur-pulse`.
- **Atmosphere (WEB-16):** ambient loop durations (`--dur-wave-a` … `--dur-drift`), fog, light-shaft and vignette tints, glint and Maelstrom colours, sign-in sea edge and land, fog blurs, ember size and glow, `--size-map-w/h` (world 1440 × 900), `--page-glow-bg` (data pages).
- **Roster (WEB-21):** friend name `--fs-friend` 19, friend avatar, search field, character row columns (`--size-row-*`), level bar, track dots, label and band rows, `--line-quick`, `--line-hover`, `--stale-note`, `--opacity-old`, `--s-4-5` 18, `--s-5-5` 22, `--track-line`.
- **Roster table (WEB-22):** header surface and line, `--tint-row` (hover and the viewer's own rows), profession pill (`--surface-pill`, `--r-pill-sm`, `--s-1-75`), `--ls-th`, `--size-disc-xs` 26, table level bar, `--sheet-backdrop` (phone filter sheet, no board).
- **Upload (WEB-19):** dropzone and state frames (`--size-dropzone`, drop line and glow, dragging glow, `--state-fill`, `--alert-line` / `--alert-tint`), their icon sizes, `--fs-drop` 24 / `--fs-state` 20, the accent loops (`--dur-breathe` 5 s, `--dur-over` 2.4 s, `--dur-bob` 1.6 s, `--dur-spin` 1.4 s), outline button lines, the `/reload` hint box, history Done / Rejected tints, `--s-4-5` 18.

A value a screen needs and no token has goes into part 2 with its source, never inline.

## 4. Data age (one scale everywhere)

| State | Age | Marker | Elsewhere |
|---|---|---|---|
| New (`live`) | < 32 h | class fill, glow, pulse | bright dot with glow, green badge |
| Recent | 32 h–3 d | class fill, no glow | solid dot |
| Days | 3–6 d | dark fill, class ring, 70%, age tag | ring dot |
| Week+ | ≥ 7 d | dashed ring, 50%, amber age tag | amber "Data N days old" badge |
| Unknown | no location | not on map | "Unknown whereabouts" tray |

- "Seen" always means *seen by the addon*. Show "via X" when data was relayed.
- Site-wide banner when the last upload is **7 days** old or more (decided; same as a friend's amber badge).

## 5. Map

- Source: `src/core/map/zones.json` (derived from the Wikimedia Commons SVGs, trimmed to Vanilla, rebuilt with `tools/map/build_zones.py`): 46 shapes (43 zones + 3 terrain) with `id, name, cont (K|E), kind (zone|terrain), d (SVG path, evenodd), lx/ly (label + marker anchor), lines, size`; `coast.K/E`; `cities` (capitals `cap: 1`, towns `cap: 0`); `dungeons`. World coordinates = 1440 × 900.
- Merged for Vanilla: Northern + Southern Barrens → The Barrens; Northern Stranglethorn + Cape → Stranglethorn Vale; Ahn'Qiraj → Silithus. Terrain (no hover): Uldum, Gilneas, Grim Batol. Removed: Quel'Thalas, Kul Tiras, Tol Barad, Azuremyst/Bloodmyst. Alterac shares the Hillsbrad shape.
- WoW: Forever (WEB-31): Thousand Needles is dry (the source's Cataclysm lake filled in); Mount Hyjal is a zone; The Riverglades (new land on the Eastern Kingdoms' east coast), Shen'dralas (carved from northern Feralas) and Zephras Isle (an inset island between the continents, south of the Maelstrom, as Skywall is not on Azeroth) are hand-drawn zones (`EXTRA_ZONES` in `tools/map/build_zones.py`), styled like every other zone.
- Layers (bottom → top): sea gradient · moonlight glint · wave strokes (2 groups) · Maelstrom · surf (blurred coast stroke) · foam (dashed coast) · zone fills · grain · occupied tint + borders · coast line · capitals · labels · markers (HTML overlay) · cards.
- Zone states: idle (gold line 36%) · occupied (gold tint 3–20% by recency) · hover (bright gold stroke 1.6, name in corner) · terrain (dark, no hover).
- Zoom: **World 1×** markers + clusters per zone, capitals only · **Continent 2×** towns, clusters ≤ 5 fan out · **Zone 4×** dungeons, name tags on all markers.
- Clusters: 2–5 fan out (spring, 30 ms stagger), ≥ 6 open a list. Dungeon sightings show at the dungeon's zone with a badge.
- Phone: full-screen map, bottom sheet (peek → half → full), edge hint "4 in Kalimdor", tap marker → zoom + half sheet. Built in WEB-28 (`BottomSheet`, `CharacterSheet`, `RollCallPanel variant="sheet"`); the sheet shows below 1024 px.

## 6. Motion

| Element | Trigger | Duration | Easing | Reduced motion |
|---|---|---|---|---|
| Marker | hover/focus | 120 ms, scale 1.15 | ease-out | outline only |
| Cluster fan | hover/tap | 220 ms, 30 ms stagger | spring | instant |
| Hover card | marker | 160 ms, fade + rise 8px | ease-out | fade 80 ms |
| Zone highlight | hover | 250 ms | ease | colour only |
| Bottom sheet | drag/tap | 280 ms, follows finger | ease-out | 120 ms fade |
| Fly to character | roll call pick | 600 ms pan + zoom | ease-in-out | jump |
| New sighting | after upload | 400 ms drop + 1 ripple | spring | appear |
| Session report | page load | staggered rise 0.55 s, bars grow 1.1 s, LEVEL UP shine | ease-out/spring | static |
| Upload accents (WEB-19) | idle dropzone; dragging; reading | glow breathes and ledger floats 5 s; dragging glow 2.4 s, ledger bobs 1.6 s; spinner 1.4 s, bar 2.4 s | ease-in-out / linear | static |
| Ambient | always (map, sign-in) | pulse 2.6 s · waves 7/9 s · surf 6 s · foam 40 s · Maelstrom 50 s · moonlight 18 s · fog 40–56 s | loops | all off, static fog |

Ambient details (WEB-16, Nico 2026-10-26):
- **Motion setting:** the user menu's "Motion" switch follows the system's `prefers-reduced-motion` until the user flips it; the choice is stored per browser (`localStorage`) and applied before first paint as `<html data-motion="on|off">`. Off works as reduced motion everywhere; an explicit On animates even when the system asks for reduced motion.
- **Where:** desktop map: fog (3 banks) and two light shafts over the sea (no embers); phone map: one fog bank; sign-in: the drifting map, fog and embers, phone too; data pages: the static top glow only.
- **Loops from the boards** that the table does not list: light shafts 14 s, embers 16 s (gone without motion), sign-in fog 46 s, sign-in map drift 60 s.
- Loops pause while the tab is hidden; they animate only transform and opacity (the foam's dash offset moves in steps).

## 7. Components

| Component | Notes |
|---|---|
| `TopBar`, `TabBar` | Desktop top bar (brand, Map/Roster/Professions, continent switch on map, data age, upload for admin, Discord, user). Phone tab bar. |
| `WorldMap` | SVG from `zones.json` + HTML overlay; pan/zoom wrapper |
| `MapZone` | idle / occupied / hover / terrain |
| `CharacterMarker` | class, initials, age state, selected; 44px hit area |
| `ZoneCluster` | count, split class ring, dungeon badge, fan or list |
| `CharacterCard` | desktop hover card; phone half sheet |
| `RollCallPanel`, `RollCallRow` | grouped by age, filters on top, unknown tray, no-addon line |
| `FilterChip`, `Segmented` | `aria-pressed` |
| `BottomSheet` | peek / half / full |
| `FriendPanel`, `CharacterRow`, `DataAgeBadge`, `FactionTag` | roster cards |
| `RosterTable` | sortable, `aria-sort`; becomes cards on phone |
| `LevelSpread` | 1–60 track with dungeon bands |
| `ProfessionCard`, `SkillBar`, `StatusBadge` | 300 scale, cap shading, ticks 75/150/225 |
| `ProfessionMatrix` | characters × professions |
| `TalentBars`, `QuestLog`, `MiniMap` | character detail |
| `Dropzone`, `UploadHistory`, `SessionReport` | admin upload flow |
| `Banner`, `EmptyState`, `FirstUploadState`, `Skeleton`, `LoadingLine` | global states (WEB-29: the first-upload card, the thin gold line while a page loads) |
| `Atmosphere` | fog, light shafts, embers, sea; reads reduced-motion + a user toggle |

## 8. Decisions and rules

- Covered / thin / gap professions: covered ≥ 225, thin 175–224, gap < 175 (to refine during implementation).
- WoW: Forever has no realms: show the **ruleset** (PvP or PvE) instead, through the rulesets table (WEB-13).
- Character names always contain a space; never split.
- Item level may be missing → "—".
- Talent points = level − 9; tree bars out of 31.
- Dungeon level bands on the roster are typical ranges, labelled as such. A band shows for every dungeon (not raids) where at least two characters fit; the one with the most fits gets the "fits ..." line (WEB-14, Nico 2026-10-25).
- Character dungeon fit: other friends' characters in the typical range (not the owner's alts), any data age; the dungeon with the most of them, ties to the narrower range (WEB-14, Nico 2026-10-25).
- Error copy: wrong file, newer data format, nothing new, not on the guest list, Battle.net unreachable (see UploadStates / SignInStates).
- Upload states without a board (WEB-19, Nico 2026-10-26) use the amber frame of "wrong file" with "Choose another file" or "Try again": not your file ("This is someone else's ledger · It belongs to Bob#2002. Sign in as Bob#2002 to upload it. Nothing was changed."), other community ("This ledger is for another community · … Pick <site name> in the addon, /reload and upload again."), no community yet ("The ledger isn't open yet"), damaged ("We couldn't read this ledger"), too large ("That file is too big", checked in the browser), no answer ("The upload didn't go through · Nothing was changed. Try again."). The screen never shows raw error text. "Wrong file" names the file when its name isn't `CommunitiesForever.lua`. "Newer addon version": "Update the site first" for the admin, "Ask the admin to update the site" for others; its button opens the addon's GitHub releases. "Nothing new" also covers a new file that changes nothing (time of the uploader's previous upload).
- Upload history (WEB-19, Nico 2026-10-26): everyone's uploads, last 20, newest first, the uploader's display name under the time. Summary: the site's first accepted upload "First upload · N characters"; then up to three of "N levels gained · N skill gains · N new characters · N sightings · N item level gains" in that order, zeros left out; "Nothing new" otherwise. Rejected: a short reason ("Wrong file: another addon's data", "Damaged file", "Newer addon: format N", "Not your file", "Another community", "Before the admin's first upload"). The board's "Mira reached 60" highlight is dropped.
- Clock times ("Today 21:14", "Yesterday 22:05", "Thu 23 Oct, 23:40") are the viewer's local time, formatted in the browser, 24-hour (WEB-19, Nico 2026-10-26).
- While a file is read, the browser reads it with the same core parser for "N characters from M friends" (characters with a record and their owners); the server decides (WEB-19).

## 9. Suggested libraries (proposal — you decide)

- **Map:** inline SVG rendered on the server from `zones.json` (no tiles, no WebGL). Pan/zoom/pinch: `react-zoom-pan-pinch`, or a small pointer-events hook.
- **Popovers:** `@floating-ui/react` for marker cards and filter menus.
- **Bottom sheet:** `vaul` (proposed; WEB-28 built its own, see `docs/ARCHITECTURE.md`).
- **Styling:** CSS custom properties above + CSS Modules (no runtime CSS-in-JS).
- **Motion:** CSS keyframes/transitions for everything above; add `motion` only if the sheet drag or cluster fan need physics.
- **Fonts:** `next/font/google` for Marcellus, Marcellus SC, Inter (self-hosted, no layout shift).
- First load: map SVG is about 90 KB of path data; inline it once on the map page and cache `zones.json`.

## 10. Open items

- Final emblem/logo for Doombringers. (WEB-36: Nico's icon set uses the top bar's shield, filled and in `--gold-bright` for small sizes.)
- ~~Exact addon data-format versioning.~~ The "data format" in the upload copy is the addon's `schemaVersion` (WEB-19).
- ~~Stale thresholds to confirm.~~ Decided: 7 days for both the site banner and a friend's data (§11).
- Recipe search UI once the addon shares recipes.
- ~~Confirm the licence and attribution text of the source map SVGs.~~ Done: CC BY-SA 4.0, Syrio.

## 11. Deviations

Approved departures from this design (CLAUDE.md rule 12). Only Nico approves one; add it here in the PR that builds it.

| Date | What | Why | Approved |
|---|---|---|---|
| 2026-10-25 | Stale-site banner after 7 days (the `loading` board says 3) | One threshold for site and friend data | Nico |
| 2026-10-25 | Map (WEB-31): Thousand Needles dry; Mount Hyjal a zone, not terrain; three new zones (The Riverglades, Shen'dralas carved from Feralas, Zephras Isle as an inset island) in the normal zone style. The boards still show the Cataclysm lake and no new zones | The map shows WoW: Forever, not Cataclysm; nothing else about the map changes | Nico |
| 2026-10-25 | Full character names wherever the boards show a first word ("with Lia, Tok and Bob", "Tok ★", "Ves item level 31 → 34") | Names are never split (CLAUDE.md rule 3) | Nico |
| 2026-10-26 | Top bar Upload is an icon plus "Upload" on every page (the map board has a 36 px icon-only button; the upload board has the labelled link) | Clearer, one control everywhere, 44 px target without tricks | Nico |
| 2026-10-26 | Phone app bar (no board): data age as a short meta line before the avatar ("Updated 2 h ago", as on the phone map); Upload moves into the user menu | No board shows them on phone | Nico |
| 2026-10-26 | Class disc initials: first letter of the first and last word of the name ("VD"), display only, never a key | The boards show initials; the one exception to "never split names" | Nico |
| 2026-10-26 | Footer credit in `--text-faint` (#7E8898), not the sign-in board's #6E7888 | #6E7888 is under 4.5 : 1 on the page; every text pairing must pass (design-system board) | Nico |
| 2026-10-26 | Stale-site banner without the loading board's second line ("Nico uploads after a play session.") | Members upload too, so the line is no longer true | Nico |
| 2026-10-26 | Surf (WEB-16): a static 9-wide stroke under a 15-wide one that fades in and out, instead of the board's stroke-width 9 → 15 swell | Ambient loops animate only transform and opacity; it looks nearly the same | Nico |
| 2026-10-26 | Foam (WEB-16): the dash offset moves in 220 steps per 40 s loop, not continuously | A dash march has no transform equivalent; steps repaint about 5× a second instead of every frame | Nico |
| 2026-10-26 | Motion switch in the user menu (WEB-16, no board): a two-wave line icon, "Motion" and an On/Off meta text, gold when on | No board draws the item | Nico |
| 2026-10-26 | Without motion every ambient layer rests on its first keyframe (fog and shafts still, embers gone) | The boards only show the moving state; their still state drops the animation | Nico |
| 2026-10-26 | Upload history footnote "Everyone in the community can upload their own file. Friends see the result on the map and roster." (the board says "Only you can upload.") | Members upload too | Nico |
| 2026-10-26 | Upload: the dropzone's breathing glow and floating ledger, the dragging glow and the reading spinner stay as on the boards on this data page, as its small accents (§1); off with reduced motion or the Motion switch | They show the page is ready, dragging and busy | Nico |
| 2026-10-26 | Upload "Dragging over" (WEB-19) shows only "Let go to upload", without the board's second line ("CommunitiesForever.lua · 48 KB") | Browsers don't expose a dragged file's name or size until it is dropped | Nico |
| 2026-10-26 | Professions (WEB-24): a card for every profession, also those nobody has ("Nobody has it yet"); no per-profession notes (the board's Engineering line); full names in a name column of up to 140 px (board 96 px), cut off with "…" | Gaps stay visible; the notes were invented copy; names are never split | Nico |
| 2026-10-26 | Professions matrix (WEB-24): text in the brightest cells (225+) is `--text-strong`, not the board's dark text; the recipe placeholder text is `--text-faint`, not #6E7888 | Both of the board's pairings fail 4.5 : 1 | Nico |
| 2026-10-26 | Professions (WEB-24, no board): phone layout (summary stacked, one card column, the matrix scrolls with a sticky Character column, the recipe field over its note), two card columns from 640 px; the empty, loading and error states; a bar without a recorded cap has no shading and shows the value alone; card titles link to the roster filtered on the profession | Not on the board | Nico |
| 2026-10-25 | The roll call also lists sighted characters of friends without the addon (no name, class or level: the owner and the zone), counted in "N of M located" | The real beta file has them; a sighting is never dropped | Nico |
| 2026-10-26 | Roster level spread (WEB-21): every dungeon band with two fits, stacked in as many rows as needed (best band first, gold; the others in one neutral style instead of the board's arbitrary tints); full names on the track in as many label rows as needed. Phone (no board): dots only, names in level order under the track, bands as a list | The real data gives up to 14 overlapping bands; names are never split | Nico |
| 2026-10-26 | Roster no-addon box (WEB-21): "Once Sanne installs CommunitiesForever, their characters show up after the next upload." (the board says "she") | We never infer pronouns | Nico |
| 2026-10-26 | Roster (WEB-21, no board): filter menus, "N of M characters · Clear filters", "1 of 3 characters", "No characters match", the empty and error states, the old-data note without a relay, phone rows (professions and "when · where · ilvl" on full-width lines) | Not on the board | Nico |
| 2026-10-26 | Roster rows of old friend data (WEB-21): only the disc and level bar fade to 80%, not the whole row | At 80% the row's dim text drops under 4.5 : 1; every text pairing must pass | Nico |
| 2026-10-26 | Data age scale for daily uploads: new < 32 h, recent 32 h–3 d, days 3–6 d (boards: live < 6 h, today 6–24 h, days 1–6 d); the roll call's "Last 24 hours" group and chip become "New" | Nico uploads about once a day, so the last session should stay new | Nico |
| 2026-10-26 | Session report (WEB-20): the hero's rays, halo and embers and the LEVEL UP / CAP REACHED shine stay as on the board, as this data page's accent; they pause with the tab and stop without motion. The shine is a bright band that moves across the badge, and the bars grow with a transform, instead of the board's moving background and growing width | Only transform and opacity animate; it looks the same | Nico |
| 2026-10-26 | Session report "Who sent data" dots follow the data age scale (§4) at upload time, not the board's dots (Mira's filled gold dot at 2 days) | One data age scale everywhere | Nico |
| 2026-10-26 | Session report (WEB-20, no board): zero counters in `--text-dim`, empty sections hidden; lists show 6 rows, then "Show N more"; "First upload by Nico · N characters from M friends"; "New faces" for several; "No longer on the roster: …" (or a "Left the roster" section); "Sanne's character" for a character without a record; "Show fewer" once a list is open; a stored "not your file" rejection says "It belongs to another BattleTag. Nothing was changed." (the file's owner isn't kept); "Roster →" opens the character; "Replay" hidden without motion; a rejected or nothing-new upload shows its upload screen state; phone: title at display size, counters 2 × 2, one column (Level ups, Skill gains, New faces, Gear, Who sent data, New sightings), stacked buttons | Not on the board | Nico |
| 2026-10-26 | Roster table (WEB-22, no board): on phone the card list and a "Filters & sort" bottom sheet (native dialog, no drag); "Location unknown" in `--text-faint` (the board shows "Unknown" in the druid colour); Professions is sortable (the board's header is plain text); the board's "Stonetalon Mts" is the full zone text | Not on the board; the story asks for the sheet and for sorting the same way as the cards | Nico |
| 2026-10-26 | Roster table (WEB-22): the professions and last-seen cells wrap (pills on two lines, "Stonetalon Mountains" over two lines) instead of the board's one line per row | From 1200 px there is no scroll frame so the headers stick to the window; the board's own rows don't fit 1280 either | Nico |
| 2026-10-26 | Map hover card (WEB-25) without the board's progress bar under the name | The addon records no XP, so the bar has no data | Nico |
| 2026-10-26 | Map age tag (WEB-25) on recent, days and week+ markers, none on new (map-states shows none on "today", the map board tags Tok's 1-day marker) | One rule for the new age scale | Nico |
| 2026-10-26 | Map (WEB-25, no board): continent switch frames the continent with the rest of the world around it; clusters of 6 or more list every name; a friend without the addon is a "?" marker whose card shows zone, seen and player; on phone the world spans the screen width, the card sits above the tab bar and markers may overlap until WEB-26 and WEB-28 | Not on the board | Nico |
| 2026-10-26 | Map sea (WEB-25): endless. The sea gradient pads out to deep sea and the waves repeat as a seamless tile around the world, so no edge of the 1440 × 900 world shows (the board's sea stops at the artboard). WEB-26's pan should stay near the world and spring back when dragged too far | The water should look endless; the map background should never show | Nico |
| 2026-10-26 | Character page (WEB-23): the hero disc, name glow, level bar and main talent bar take their colours from the class tokens (light and dark stops mixed with white and black), the name in the class `-text` colour | The board draws only a Warlock, with its own gradient | Nico |
| 2026-10-26 | Character mini map (WEB-23): the waves rest on their first keyframe (the board animates them); the frame is centred on the zone's anchor, at least 170 × 150 world units, larger for a larger zone; markers are WEB-25's (own one selected, the others smaller and linked to their page, fanned like the map's clusters) | Data pages are calm (§6); the board's crop is hand-set for Stranglethorn Vale | Nico |
| 2026-10-26 | Character page (WEB-23, no board): two columns from 768 to 1199 px with Last seen across the bottom; on phone one column (At a glance, Last seen, Talents, Professions, Quest log, other characters), a 72 px disc and the name at `--fs-display`; "Compare with the group" opens the top profession's card; "On the map" opens the map with the character selected; empty texts ("No talents recorded yet", "Talents start at level 10", "No professions yet", "No quests in the log", "Unknown whereabouts"), "Tree N" and "Quest 1234" for missing names; "A, B and 2 others are here too"; "Sanne's character" for a friend without the addon; the not-found, loading and error states | Not on the board | Nico |
| 2026-10-26 | Map zoom buttons (WEB-26): 44 px, not the board's 40 px; bottom right of the map, hidden on phone (pinch) | 44 px touch targets everywhere (CLAUDE.md rule 11) | Nico |
| 2026-10-26 | Map (WEB-26): Azeroth (1×, and the switch back to it) frames both continents with the land centred, not the 1440 × 900 source sheet, whose land sits left of its middle | The map should always open nicely centred | Nico |
| 2026-10-27 | Map centre (WEB-26): centring (Azeroth, continents, fly-to) uses the map left of a panel over its right side (`data-map-panel`: the roll call, WEB-27) | The roll call covers the map's right side on desktop | Nico |
| 2026-10-26 | Map continent switch (WEB-26): a fly to the continent's WEB-25 framing, so on a wide screen it lands near 1× (towns show from 2×); on a phone it lands near 3× | The framing shows the whole continent; the levels follow the scale (§5) | Nico (proposal 2) |
| 2026-10-26 | Map zone zoom (WEB-26, no board): the centred zone's name sits in the top bar right of the continent switch (hidden below 1328 px), its own label leaves the map, other zones dim to 62% | The board describes it in words only | Nico (proposal 4) |
| 2026-10-26 | New-sighting drop (WEB-26): plays for the sightings of the upload whose session report linked to the map (`/?drop=<upload id>`), once, not "since your last visit" | No per-viewer visit tracking | Nico (proposal 6) |
| 2026-10-26 | Map at 2× and 4× (WEB-26, no board): a fan the zoom keeps open has a centre that is no control; in a fan the name tags lean outward | Open fans would otherwise overlap their hub's touch target and each other's names | Nico |
| 2026-10-26 | Map pan (WEB-26): dragged past the world's edge the map follows the pointer at 35%, and on release springs back in 220 ms (ease-out cubic, the library has no spring curve); a jump without motion | "Bounded, springy pan" | Nico |
| 2026-10-27 | No footer on any page (the boards have the credit line at the bottom) | Nico doesn't want it; the credits come back in another place later | Nico |
| 2026-10-27 | Sign-in (WEB-17): the site name from the data instead of "Doombringers"; the admin named by the part of `ADMIN_BATTLETAG` before the `#` ("Send Vestras your BattleTag") | The site name never is hardcoded; Nico is Vestras on the site | Nico |
| 2026-10-27 | Sign-in pings: decoration at the board's four spots, not where anyone is; without motion the ring rests on the dot's edge | The sign-in page is public and shows no data | Nico |
| 2026-10-27 | Sign-in states on the drifting map, panel 420 px wide and blurred like the sign-in panel (the states board shows them on a plain gradient, about 373 px wide, without blur) | The states board is an overview sheet; on the site a state takes the panel's place | Nico |
| 2026-10-27 | Signing in: a welcome step after Battle.net, about a second, then on; "Then straight to the page you opened" when sign-in started from another page than the map. "Sign out" is a text button with a 44 px target | The guest list check happens before any page shows; the board only draws the moment | Nico |
| 2026-10-27 | "Not on the list" without a known BattleTag says "This BattleTag isn't on the … guest list"; a blocked BattleTag sees the same copy | The BattleTag comes from a short-lived cookie that may be gone; a block isn't announced | Nico |
| 2026-10-27 | "Use another Battle.net account" signs out of the site and of Battle.net, then lands back on sign-in, where "Sign in with Battle.net" asks for an account (no board shows what it does) | Battle.net remembers the last login and ignores `prompt=login`; its logout with `ref` back to the site works (tried by Nico) | Nico |
| 2026-10-27 | Admin page (WEB-18, no board): `/admin` from an "Admin" item (key icon) in the account menu; Members, Guests and Blocked as panels in the upload history's style (members wide left, the others stacked right, one column below 1024 px); rows in the history line pattern with display name over BattleTag, "Added by Bob's upload" and "Last seen …"; quiet row buttons in the menu item style (Block and Remove in `--stale-text`), the "May upload" `FilterChip`, the add-guest field in the roster search's look and the empty-state card's gold button; neutral "Admin" / "Blocked" badges, blocked rows dimmed; no confirm dialogs | No board draws the admin page; built only from existing components | Nico |
| 2026-10-27 | Roll call legend (WEB-27): four static entries, "New < 32 h · Recent · Days · Week +" (the board: "Live < 6 h · Days · Week +") | The data age scale for daily uploads has four states | Nico |
| 2026-10-27 | Roll call without a board (WEB-27): the faction and level chips open the roster's filter menus (level in the roster's ranges); the filters also filter the map's markers and live in the URL; a row off the map (battleground, "elsewhere") and an unknown-whereabouts row open the character; "No characters match" with "Clear filters" when nothing matches; the panel shows from 1024 px (below, the phone sheet of WEB-28) | The board shows only the closed chips and one filled list | Nico |
| 2026-10-27 | Empty map on a phone (WEB-29, no board): the centre card and the guest list follow under the map; from 768 to 1023 px they scroll over it, card first | The phone map is only as tall as its width allows, and the roll call sheet (WEB-28) isn't there yet | Nico |
| 2026-10-27 | Loading line (WEB-29): shown while a navigation from the top bar or tab bar is pending, not by a route loading state; none without motion | A route loading state turns a page's 404 into a 200 and delays the map's first paint; the board's reduced-motion line has no size either | Nico |
| 2026-10-27 | Phone map (WEB-28): the bottom sheet and the tapped character in it below 1024 px, not only on phones; from 768 to 1023 px with the desktop top bar | The roll call panel is hidden below 1024 px; no width without a roll call | Nico |
| 2026-10-27 | Phone map peek (WEB-28): chips with the full name and the full zone text ("Lia Thornwhisper · 1 h", "Stranglethorn Vale", "The Deadmines, Westfall"), newest first, scrolling sideways; the board has first names and short zones | Names are never split; zones are never abbreviated | Nico |
| 2026-10-27 | Phone character sheet (WEB-28): the next-character button shows the full name, cut with "…" when it doesn't fit, and cycles through the zone newest first; "· via X" after Seen when relayed; "—" for a missing value | Full names; the board shows one fitting case | Nico |
| 2026-10-27 | Phone app bar on the map (WEB-28): the approved phone app bar (data age before the avatar) with the board's Filters button, which opens the full roll call; no "Updated just now" under the continent switch. The site name may be cut with "…" at 375 px | One data age line, as decided for the phone app bar | Nico |
| 2026-10-27 | Phone full sheet (WEB-28): the WEB-27 roll call (New / Earlier, its filters and menus) laid out as the board, without the age legend; the filters filter the markers too; a row off the map opens the character page | Same roll call as the desktop panel | Nico |
| 2026-10-27 | Edge hint (WEB-28): "N in Kalimdor" on the left edge (as the board) or "N in Eastern Kingdoms" on the right edge in the top row (clear of the continent switch and the markers on Kalimdor's east coast), counting the filtered characters on the other continent; hidden on Azeroth, at 0 and while a character is open; a tap flies there | The board shows only the Kalimdor case | Nico |
| 2026-10-27 | Bottom sheet without motion (WEB-28): it still follows the finger while dragged; a snap jumps and fades in over 120 ms | A drag is the user's own movement; §6 has the 120 ms fade | Nico |
| 2026-10-27 | A continent switch frames the continent at 1.25× at least (WEB-28); the phone map fills the screen between the app bar and the tab bar, the sea running on above and below the world | A continent at 1× counted as the whole world and sprang back (the WEB-27 bug); the phone map is full-screen on the boards | Nico |
| 2026-10-27 | Uploader page (WEB-34): the top bar's "Upload" becomes "Uploader" (to `/uploader`, current there and on `/upload` pages; also in the phone user menu); a small "Rather upload a file yourself? Upload manually" line under the title; "Download for Windows" disabled with "Not released yet" until the installer exists (WEB-35); Revoke 44 px tall (the board: 34 px) and asking inline first; states the board doesn't show (allowed, denied, wrong or expired code, 5 uploaders, too many tries, no uploaders, a token shown once with Copy); one column below 768 px | The manual upload stays reachable; touch targets (rule 11); the board shows only a waiting request and two uploaders | Nico |
| 2026-10-27 | Uploader page "Upload history" (WEB-34, board revised with it): statuses Done, Nothing new and Rejected only (the board's Skipped and Retried are not known to the site); pills are the summary line's counts (no highlight like "Mira reached 60"); a phone layout of the rows (time and status, then device, then pills) | The app skips an unchanged file itself and the site doesn't record retries; one source for the summary; no phone board | Nico |
| 2026-10-27 | Upload history: "via DESKTOP-NICO" under the summary of an upload the uploader app sent (WEB-34; not on the `upload` board) | Shows which device sent it; manual uploads look as before | Nico |
| 2026-10-27 | Roster level spread (WEB-32): built to the `roster-cards-runs` board without its run parts (the Next run card, the band popover, the Role filter and "click a dungeon to plan a run" are WEB-45); replaces WEB-21's names on the track. Dots only (14 px, a 44 px target; neighbouring targets may overlap, as the map's markers); characters each at most 2 levels above the one before share one 26 px dot with the count and their class colours, at the middle of their levels; name, level and player ("you") in a tooltip on hover, keyboard focus or tap (a tap keeps it open until the next tap, a tap elsewhere or Escape); a gold ring on the viewer's characters. Bands keep WEB-21's neutral style and gold best band, read "SM Armory 32–42 · 4 fit" (the best band too, never names), one band per Scarlet Monastery wing. The hint reads "Hover or tap a dot for names · gold ring: your characters · bands show typical levels"; the board's row of notes is not shown. Phone (no board): the same dots and tooltips, but characters within 4 levels merge (dots at least 24 px apart at 375 px); WEB-21's names list under the track is gone; bands stay a list | Which dot is whom wasn't clear; the run parts come with WEB-45; touch targets (rule 11, WCAG target spacing) | Nico |
| 2026-10-27 | Discord page (WEB-39): a "Your time zone" card under the link card (pick from every IANA zone, "19:30 now"), not on the board; a "Bot token" card above "What the bot posts" (WEB-38's token: the status line, Create or Replace, the token once with Copy, Revoke asking first), in the same card style. The status pill reads "● Bot online" while the bot called in the last minute, else "Bot offline" or "Bot not connected". "Can delete any run" names the one admin (the board shows two). The channel and role dropdowns are disabled ("Start the bot to pick channels") until the bot reports its server's channels and roles (WEB-38); "Send a test post" is disabled until there is a bot token; "Send a test run post", "Preview next recap" and "See how runs look in Discord" until runs (WEB-40) and the recap (WEB-41) exist. Recap time Sunday 13:00 by default (the board says 20:00, WEB-41) | The board has no time zone or token; one admin only; the site can't list Discord channels itself | Nico |
