# Design prompt: asks on the Runs page (WEB-51)

Paste into Claude Design, canvas "Doombringers — wow.vestras.nl design", next to the `runs` and `runs-phone` boards. Nico asked for a board before this block is built (2026-10-28).

---

Add an **"Asking now"** block to the **Runs page** (boards `runs` and `runs-phone`), in the "Night over Azeroth" design system (the site's tokens, type scale, data age scale and motion; no new colours).

**What an ask is.** A short group call: "who's up for The Deadmines right now?". Someone makes it from the game's Dungeons tab (Ask now, with "Also post on Discord") or with Discord's `/ask`. It takes answers for **10 minutes** and then disappears from the site. It has no slots and no time to plan: whoever says I'm in is in, and the asker forms the group in game with a party invite. An ask is not a run: it never shows under This week, Later or Past.

**The block.**
- It sits above the run lists ("This week"), only while at least one ask is open; with none, nothing shows (no empty state).
- One compact card per open ask, newest on top, at most 3, then "and N more".
- Per card:
  - the dungeon and its level range ("The Deadmines · 17–26");
  - the asker on their character and role ("Nico asks on Grom Ashfeller (tank)"), and where it came from ("from the game" or "from Discord");
  - the note, when there is one;
  - a live countdown ("ends in 7 min"); in the last minute "ends in 40 s";
  - who answered: In (character names with level and class), Maybe, Can't count;
  - the same I'm in / Maybe / Can't buttons as a run card. I'm in uses the viewer's best fitting character, as on the run cards, with a way to pick another. After answering: "You answered I'm in with Lia Thornwhisper".
- Phone (375 px): the same card full width, buttons in thumb reach, 44 px touch targets.

**States to show.**
- One ask with answers.
- Two asks.
- An ask the viewer already answered.
- The last minute.
- An ask none of the viewer's characters fit: "None of your characters fit the Deadmines (17–26). Maybe or Can't still go".
- An answer that didn't go through (Retry), as on the run cards.

**Board.** Desktop and phone, dark and light. Reuse the run card's parts (title row, meta line, answer buttons, "You answered …" line). Show the block in place on the Runs page, so the page's order reads right: "Asking now" → This week → Later → Past. The page's existing "Going right now?" panel stays.
