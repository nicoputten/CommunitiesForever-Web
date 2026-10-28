# Claude Design prompt: dailies and weeklies

Paste everything below the line into the Doombringers canvas. The stories are web WEB-60 to WEB-62, bot BOT-16 and addon CF-57 to CF-60. The pool of goals is the addon repo's `docs/DAILIES.md`.

---

We're adding **dailies and weeklies** to Doombringers: small personal goals that reset each day or week. Every friend gets the same **3 dailies** a day and **3 weeklies** a week (Monday to Sunday), picked from a pool. Any of a friend's characters counts. They earn **DoomPoints PvE**: 1 per daily, 3 per weekly. Doing all 3 dailies on a day keeps a **streak** going. The PvP ladder (designed separately, recap v2 boards section 3) has **DoomPoints PvP**. Wherever a friend's points show, the two stand side by side ("DoomPoints · PvE 34 · PvP 1,210"), never added up.

Sample goals: "Finish 10 quests", "Gain a level", "Run a dungeon with a friend", "Earn 5 profession skill points", "Catch 20 fish", "Trade with a friend". Weeklies: "Play on 3 days", "Run 3 different dungeons", "Clear every boss of a dungeon", "Reach a profession cap", "Discover 5 new places". A goal nobody's character can do (Gain a level when everyone is 60) is **swapped** for that friend: show it with a small "swapped" mark, with the original in a tooltip.

**Important: don't change any existing board.** Duplicate each board you build on and work in the copy, named "<original name> · dailies". New screens get new boards.

Use the existing design system everywhere (Night over Azeroth: tokens, Marcellus SC / Marcellus / Inter, gold trim, class colours, data age scale, 44 px touch targets, reduced motion). Discord screens use Discord's real UI (dark theme, embeds), as on the existing bot boards. In-game screens use the addon's widget kit and its "what WoW supports" board.

## Rules (binding)

1. **Privacy:** never BattleTags or Discord IDs. Friends by display name, characters by full name (first and last name, e.g. "Ves Doombringer"). All example names are made up.
2. **Recommend, never restrict:** nothing looks locked or forbidden. A swapped goal is a suggestion, not a ban.
3. **No pronouns** in recap texts.
4. **No shame:** an empty day is just empty, never red or "failed". A broken streak is shown quietly ("best: 12 days").
5. Light humour, the tone of the current recap.

## 1. In game: the "Dailies" tab (new board)

A tab in the addon window after Friends, Activity, Dungeons and Ladder.
- **Today:** 3 goal rows, each with an icon by category (quests, levels, dungeons, crafts, play), the title, progress (a thin bar with "7/10") or a check mark when done, and "+1". Above them: "Resets in 5 h 12 m".
- **This week:** 3 weeklies the same way, "+3" each, "Resets Monday".
- **You:** the streak (a streak mark with "6 days", best below), and **DoomPoints · PvE 14 this week · 212 all time**, with PvP next to it.
- **Friends:** a compact row per friend: name, today's 3 check marks, this week's 3, streak and this week's PvE points, sorted by points. A friend without data: "not shared".
- States: the first day (no streak yet), all done (a quiet gold "All dailies done" moment), a swapped goal with its tooltip.
- The chat line when a goal is done, in the addon's chat colour: "Daily done: Finish 10 quests (+1 DoomPoint PvE, 2 of 3 today)".

## 2. Website: the "Dailies" page (new board; desktop 1440 and phone 375)

- **Today:** the 3 dailies as cards, and under each the friends who did it (class-coloured name chips) and who hasn't yet (dimmed, no shame). Time until the reset.
- **This week:** the 3 weeklies the same way.
- **Friends:** per friend a card with the streak, **DoomPoints · PvE | PvP** (this week and all time) and a **calendar heatmap** of the last 12 weeks (per day 0 to 3 dailies done, the gold scale). Hover or tap on a day: which goals were done.
- States: nobody shares yet ("No dailies yet: friends need an addon version with dailies"), only some friends, loading, error.
- **Roster** (copy the roster boards): where the PvE points and the streak per friend go, next to the PvP points.

## 3. Discord (copy "Discord bot · weekly recap")

No live posts. Only the weekly recap:
- **Award "Daily devotee":** the most DoomPoints PvE of the week. "Ada earned 19 DoomPoints PvE" (award header with the winner's class disc).
- **Fun card "Perfect week":** all 3 dailies on every day played. "Bob did every daily on 5 days"
- Small **icons** in the style of the existing recap icons: a check-marked scroll (dailies), a streak mark (not the fire icon of recap v2), and the five category icons (quests, levels, dungeons, crafts, play).

Show one sample recap with the Daily devotee award and the Perfect week card in place.
