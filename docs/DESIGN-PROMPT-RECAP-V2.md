# Claude Design prompt: recap v2 (PvP, danger, loot) and the PvP ladder

**Status (2026-10-28):** only section 2, the new recap cards (WEB-57), still applies. Sections 1 and 3 became Doomsday (`docs/DESIGN-PROMPT-DOOMSDAY.md`).

Paste everything below the line into the Doombringers canvas. The stories are web WEB-55 to WEB-57, bot BOT-14 and addon CF-52 and CF-53. The full current catalogue is `docs/RECAP.md`.

---

We're adding **PvP, danger and loot** to Doombringers' milestones and weekly recap, plus a new **PvP ladder**. The group plays on the **PvP ruleset** of WoW: Forever (Vanilla content: level 60 cap, Vanilla honor ranks, Warsong Gulch, Arathi Basin, Alterac Valley, world PvP in Stranglethorn Vale and Hillsbrad Foothills). Both factions can be in the group.

**Important: don't change any existing board.** Duplicate each board you build on and work in the copy, named "<original name> · recap v2" (for example "Discord bot · weekly recap · recap v2"). New screens get new boards.

Use the existing design system everywhere (Night over Azeroth: tokens, Marcellus SC / Marcellus / Inter, gold trim, class colours, data age scale, 44 px touch targets, reduced motion). Discord screens use Discord's real UI (dark theme, embeds), as on the existing bot boards. In-game screens use the addon's widget kit and its "what WoW supports" board.

## Rules (binding)

1. **Privacy:** never BattleTags or Discord IDs. Friends by display name, characters by full name (first and last name, e.g. "Ves Doombringer"). All example names are made up.
2. **Gold is never shown as an amount**, anywhere. Only relatively: "the biggest spender", "bought something shiny", "the richest week".
3. **No pronouns** in recap texts ("Somebody pay a visit.", never "visit her").
4. A card shows only when the week has data for it. Design the full set, but a normal week shows an award and up to 4 cards (stat, progress, social, fun).
5. Light humour, the tone of the current recap: proud of the grind, gently teasing about deaths. Never mean.

## 1. New milestone posts: replaced

Replaced by Doomsday feats (`docs/DESIGN-PROMPT-DOOMSDAY.md`, boards `doomsday-feat-cards` here and `bot-doomsday-feats` in the bot repo).

## 2. New weekly recap cards (Discord; copy "Discord bot · weekly recap")

Show each card as it appears in the recap embed, with sample data. One example per card is enough; each card later gets 3 phrasings.

**Awards** ("Doombringers of the week · <name>", with the award header image: the winner's class disc):
- **Warmonger:** the most honorable kills. "Ves Doombringer took 142 honorable kills"
- **Battlemaster:** the most battleground wins. "6 battleground wins for Ada"
- **Loot goblin:** the most rare and epic items. "Bob looted 9 blues and 1 purple"
- **Duelist:** the most duel wins. "Ada won 11 duels"
- **Social butterfly:** grouped with the most different friends. "Bob grouped with 6 friends"

**Stat cards:**
- **Bloodbath zone:** the zone with the most kills (with the zone's map crop, like Zone of the week). "Stranglethorn Vale: 87 honorable kills"
- **Battleground of the week:** "Warsong Gulch, 7 games: 4 won, 3 lost"
- **Deadliest zone:** "Badlands claimed 9 lives"
- **Biggest group night:** "Friday: 7 friends grouped up"

**Progress card:**
- **Rank race:** "Stone Guard vs Stone Guard: Ves Doombringer leads Tok Ironhide by a hair"

**Social cards:**
- **Revenge:** "Lia Thornwhisper died to players 6 times, then took 31 kills"
- **Duel rivals:** "Ada vs Bob: 5–3 in duels"

**Fun cards:**
- **Most deaths:** "A spirit healer knows Tok Ironhide by name: 12 deaths"
- **Fell to their death:** "Lia Thornwhisper trusted the cliff. The cliff said no."
- **Died by fire:** "The campfire won. Ves Doombringer got too cosy." (also lava)
- **Untouchable:** "9 levels and not a single death for Ada's Ana Brightwater"
- **Big spender:** no amounts. "Bob's purse got a lot lighter. Something shiny was bought."
- **Purple rain:** "2 epic items this week: Bonereaver's Edge, Robe of Volatile Power"
- **Marathon:** "Tok Ironhide played 7 hours straight on Saturday"
- **Night owl:** "Ves Doombringer was still out at 03:12"
- **Early bird:** "Ada logged in at 06:40. Coffee first?"

**Headlines:** a **PvP week** ("Blood in Stranglethorn") and a **danger week** ("A week of spirit healers").

**Challenges:** "Win 3 battlegrounds as a group", "Each of you gets 25 honorable kills", "Take back Tarren Mill", "Duel every friend once", "A week without dying".

Make two complete sample recaps: a **PvP week** (Warmonger award, Bloodbath zone, Rank race, Duel rivals, Fell to their death, the Tarren Mill challenge) and a **danger and loot week** (Loot goblin award, Deadliest zone, Revenge, Purple rain, Died by fire).

Small **icons** for the new card types, in the style of the existing recap icons: crossed swords (PvP), a skull (deaths), a falling figure (fall), a flame (fire), a purple gem (epic), a horse (mount), a moon (night owl), a sun (early bird).

## 3. PvP ladder: replaced

Replaced by the Doomsday ladder (`docs/DESIGN-PROMPT-DOOMSDAY.md`, board `doomsday-ladder`).
