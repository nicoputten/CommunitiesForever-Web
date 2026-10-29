# Doombringers: fixes and visual bot posts after the live test of 29 Oct

Nico's brief (2026-10-29), with the boards `design/boards/live-test-*` and `design/boards/bot-visual-*` (canvas "Doombringers v2", section "Live test · 29 Oct": `LT01Findings`, `LT02SiteFixes`, `LT03Phone`, `BV1Recap`, `BV2Daily`, `BV3Feats`). Stories: web WEB-65 (site fixes), WEB-66 (bot images), bot BOT-20 (visual posts). Where `docs/DOOMSDAY.md` disagrees on a rule, this brief is newer and wins: the PvP Virgin rule (any PvP point ends it) and the day label.

A read-only test of the live site found:
- design notes from the design canvas that ended up as visible text on the live site
- 7 bugs
- some rough UX edges, including on phones
- bot posts that are plain text and look flat

Fix all of it in one go. The canvas uses made-up names; use real data in the code.

## Ground rules

- **Don't touch live settings or data while testing.** Don't change Discord channels. Don't press "Start fresh from launch", Revoke, Unlink or Delete. Don't send real posts to the live channel. Test posts go through the existing "Send a test …" buttons only, into the test channel the owner picks.
- **Privacy:**
  - Never show BattleTags or Discord IDs outside the Admin page. The Discord page's "Linked friends" box (owner and admins only) may keep them.
  - Bot posts use display names and full character names only.
  - Gold is never shown as an amount anywhere.
- Keep the existing design system:
  - Night over Azeroth tokens
  - Marcellus SC / Marcellus / Inter
  - gold trim
  - class colours
  - 44 px touch targets
  - `prefers-reduced-motion`
  - pages work at 375 px
- Write user-facing copy in short plain English. No explanatory notes for developers on live pages. If an explanation helps players, it becomes a tooltip (part 1).

## Part 1: remove leaked design notes

Search the site templates for each string below and apply the action.

| Page | Text now on the live site | Action |
|---|---|---|
| Discord | "Renamed from Milestones: every milestone is a feat now." | remove |
| Discord | "Moved here from 'What the bot posts'" | remove |
| Discord | "owner & admins · one box per kind of post, each with its own switch, channel and timing" | shorten to "owner & admins" |
| Discord | "every friend sees this part" | remove |
| Discord | "Posts use display names and full character names, never BattleTags or Discord IDs. Only the Linked friends list…" | remove |
| Discord | "The bot sees 24 text channels" shown twice (status pill and Server field) | keep it once, in the status pill; drop the Server field |
| Doomsday · Today | "checks appear as uploads and addon sync come in · ✓ with the time" | tooltip on the board title |
| Doomsday · Today/Week | "Goals are suggestions with points. Skip any of them; nothing is locked." | tooltip on "Your goals" / "Your weeklies" |
| Doomsday · Feats | "posted once in Discord as 'Feat unlocked'" | remove |
| Doomsday · Feats | "Locked feats show progress, never pressure." | remove |
| Doomsday · PvP | "Site and Discord only; the addon shows wins and losses." | remove |
| Doomsday · PvP | "Battlegrounds · separate, never in the week's kills" | shorten to "Battlegrounds" |
| Roster | "Hover or tap a dot for names · gold ring: your characters · click a dungeon to plan a run" | tooltip on "Who is around which level" |
| Professions | "Recipe search arrives when the addon shares known recipes." | remove, and hide the recipe search box until it works |
| Professions | "Light part of a bar = room left until the current cap · ★ best in the group" | tooltip on "By profession" |
| Runs | "'Can join' = one of your characters fits the level range" | tooltip on the "Runs I can join" filter |
| Uploader | "Uploads from an uploader count exactly like a manual upload: same session report, same history." | remove (keep the line about Revoke) |
| Bot · daily board | "Columns: 3 PvE dailies, then Hunt and Skirmish · names are crossed out when all dailies are done" | remove; the new board image (part 5) has column headers |

**Tooltip component (one, reused everywhere):**
- A small ⓘ next to the heading: an 18 px gold-outlined circle.
- The tap area is 44 × 44 px.
- It opens on hover, focus or tap, and closes on Esc, tap outside, or blur.
- Panel: max 280 px wide, `#0E1626` background, 1 px gold border at 45%, 12.5 px text.
- Accessibility: `aria-describedby`, the button gets `aria-label="More info"`, and it has a visible focus ring.
- On phones it opens below the icon, kept inside the screen.

## Part 2: bugs (each with how to check it)

1. **PvP Virgin next to PvP points.** Rule: *any* PvP point ends "PvP Virgin", duel points included. Show the label only when a friend's all-time PvP points across all characters are 0. Check: a friend with only duel points has no label on the Roster, the Doomsday board, the ladder or in Discord.
2. **Wrong rank title.** "Conscientious Objector" shows only when all-time PvP points are 0. Otherwise, with no rank yet, show "No rank yet · N kills". Check: your PvP page with 1 kill shows no Conscientious Objector.
3. **Cancelled run under "Past".**
   - "Past" means the start time is before now.
   - A cancelled run whose start is still in the future stays in its week group, with its name struck through and the CANCELLED pill.
   - Once its start time has passed it moves to Past.
   - Check: cancel a run for tomorrow on a test copy; it stays under This week.
4. **Goal count.**
   - "2 of 4 done" while 5 goals are shown. Count exactly the goals in the grid: 3 PvE dailies, the Hunt or Skirmish, and the duel slot.
   - Days with a Hunt and a Skirmish count 6.
   - The duel slot counts as done after its first duel.
   - Check: the number matches the cards on screen.
5. **The day label follows the reset.**
   - A Doomsday day runs from reset to reset (19:00 realm time, from the Discord settings).
   - Name the day by its start: "Wed evening", subtitle "Wed 19:00 → Thu 19:00".
   - Check times after midnight show the weekday: "done Thu 00:04".
   - "resets Thu 19:00 · in 6 h 51 m".
   - Do the same on the board, in Discord and in the addon chat lines.
6. **Map age badges.**
   - Markers show no age badge when the sighting is under 1 day old.
   - Older sightings stay faded (the existing data-age scale) and the hover or tap tip says "here 6 d ago · seen 42 min ago". Location age and last seen are two separate facts.
   - Zone labels must not sit under a marker: offset the label or fade it under the marker.
7. **Duel grid (Doomsday › PvP).**
   - Friends as both rows and columns, with "row vs column" in the corner.
   - The diagonal shows "—", empty cells "·", scores with `white-space: nowrap`, green when the row friend leads and red when behind.
   - No scrollbar inside the card for up to 8 friends; beyond that, the table scrolls in its own box.
   - A line under it: "Read across: Mira beat Tok 2–1" (built from the real data).

## Part 3: UX

- **Avatar menu (header):**
  - Clicking your name opens a menu: Uploader, Discord, Admin (owner and admins only, with an OWNER or ADMIN badge), and Sign out under a divider.
  - Each item is 44 px high; keyboard and Esc work.
  - On desktop, Uploader and Discord also stay in the top bar.
- **Roster:**
  - Remove BattleTags from the friend cards. The card subtitle is just "3 characters".
  - Friend cards use CSS columns (`columns: 2; break-inside: avoid`), so there are no gaps. Keep the order top-to-bottom, then the next column.
  - Level-band chips show full dungeon names ("Blackrock Depths 52–60 · 2") and wrap onto more rows. Never truncate them with an ellipsis.
- **Map:** the Roll call panel has one scroll area, not a small box inside it. "Unknown whereabouts" collapses into a single row: "4 not sighted yet ▸".
- **Doomsday · Week:**
  - Every weekly gets a progress bar and a number ("Play on 5 days 3 / 5", "Clear every boss of a dungeon 4 / 6 · Deadmines").
  - Add a line naming who is closest ("Mira 5/5 done · Bob 4/5").
- **Feats list:** "New character · Joined the group" becomes one grouped line per upload: "+4 new characters: Frida Snowmantle 41, …". It's never a feat card, and never counted as a feat.

## Part 4: phone (375 px)

- **Map header:** shield logo only, no wordmark, so nothing is cut off ("Doombrin…").
- **Doomsday sub-tabs:**
  - pill chips that scroll sideways with the scrollbar hidden (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`)
  - a 48 px fade at the right edge
  - the active tab scrolls into view
- **Roster filters:**
  - The search field plus one "Filters · N" button (N = active filters) replaces the four dropdowns.
  - The button opens a bottom sheet with chip groups: Class, Role, Level, Profession.
  - Buttons: "Clear", and "Show N characters" as the main button.
- The avatar menu works the same on phones.

## Part 5: the Discord bot, more visual

Use only what Discord really renders: embeds (up to 10 per message), inline fields, an author line with an icon, a thumbnail, one image per embed, and link buttons. Attach images as files and reference them with `attachment://`. Discord shows them at about 400 px wide (300 px on phones), so text in images must be big.

Reuse the image renderer that already makes the feat cards (800 × 400). It uses the same fonts, night background, gold frame and the footer "wow.vestras.nl".

### 5a. Weekly recap (`BV1Recap`)

One message, 8 embeds, in this order:

1. **Header** (gold `#D4AF6A`): title "Weekly recap · week N", the headline in the description, then 6 inline fields: Honorable kills, Battlegrounds, Levels, Friends played, Dungeon runs, Feats.
2. **Award** (the winner's class colour):
   - author line: the award icon and "Doombringer of the week · <Award>"
   - description: one line
   - image: the award header (1200 × 400, the winner's class disc)
3. **Stat card:** if it has a map (Bloodbath zone, Zone of the week), the zone crop image 800 × 450 with the credit "Map: Syrio, CC BY-SA 4.0".
4–6. **Progress, social and fun cards:**
   - colour: the icon's colour
   - title and one-line description
   - thumbnail: the recap icon PNG (the 128 px set from `doombot-recap-icons.zip`)
   - no author icon when there is a thumbnail
7. **Doomsday** (gold): two inline fields, PvE top 3 and PvP top 3, never added together, plus "Most devoted: …" in the footer line.
8. **Challenge** (grey `#4E5058`): title and one line.

Link buttons under the message: "The full week ↗" and "Doomsday ladder ↗".

If image generation fails, post the embeds without images. Card selection and rotation stay as in recap v2.

### 5b. Daily Doomsday board (`BV2Daily`)

- **One message per day**, posted at the reset (19:00 realm time) and edited during the day. Replace the attachment with a freshly rendered image at most once every 5 minutes, only when something changed. At the next reset, edit it a last time into the "final" version, then post the new day's message.
- **Embed:**
  - title: "Doomsday · Wed evening" (add " · final" on the closing edit)
  - one line of news in the description:
    - start of day: the goals in full plus "5 points each"
    - during the day: "Mira finished all dailies first (23:13). Ada and Tok are 1 away."
    - final: "Day over: 14 goals done. Mira first at 23:13, longest streak Tok with 7. New board at 19:00."
  - the image
  - buttons: "Open the board ↗" and "My goals"
- **The image is 800 × 560:**
  - header: emblem, "DOOMSDAY", then "Wed evening · <state>"
  - columns with one-word labels: PvE "Level", "3 quests", "Skills"; PvP "Hunt", "Lone wolf". These are the day's short labels; add a `shortLabel` to each goal definition, max 10 characters.
  - one row per friend with Doomsday data:
    - name 30 px; struck through when all dailies are done; crown after the first to finish
    - 44 px boxes: green `#3BA55D` with a check for PvE done, red `#E0625A` for PvP done, dark outline for open
    - "PvP Virgin" across the PvP columns while the friend still qualifies (part 2, bug 1)
    - "Today" as PvE · PvP points in green and red
    - streak with a flame
  - footer: wow.vestras.nl and "resets in 5 h 50 m"
- **Remove** the ✅/▢ emoji table and the "Columns: …" legend. Without an image, fall back to the old text table without the legend.

### 5c. Feat posts (`BV3Feats`): every feat gets a card

- The layout always matches the 10-feats post the owner liked: the character first (class icon plus name in class colour), then what happened, then **one** card image.
- **Big card, 800 × 400** (the existing feat card) for:
  - rank 6 and up
  - level 60
  - epic items
  - mounts
  - iconic items
  - 1,000+ honorable kills
  - anything marked "First in the group"
- **Strip card, 800 × 240 (new)** for every other feat (first catch, first blood, profession steps, duel milestones):
  - the recap icon at 140 px on the left
  - "FEAT UNLOCKED", the title (Marcellus SC 46 px), the character in class colour and one line
  - the "First in the group" badge at top right when it applies
- **Several feats in one upload:**
  - one message, the list grouped by character
  - one card for the most special feat: big beats strip, "first in the group" beats the rest, then rarer beats more common
  - footer "N feats from one upload"
- **New characters** are not feats: one line "+3 new characters: Grosh Bonechewer 60, …", without a card.
- The "Test post from the site's Discord page · not real" footer appears only on test posts.

## Done when

- None of the strings in part 1 appears anywhere on the site (grep the templates and the rendered HTML).
- Each bug in part 2 is checked as described, with a unit test for the PvP Virgin rule, the goal count, the reset-based day label and the cancelled-run grouping.
- The pages work at 375 px with no horizontal page scroll; every control is at least 44 px.
- A test recap, test board and test feat (from the Discord page buttons, into the test channel) look like `BV1Recap`, `BV2Daily` and `BV3Feats`. Check them on Discord desktop and on a phone.
- No BattleTag shows on the site outside Admin and the owner/admin Linked friends list.
