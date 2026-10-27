// The recap's texts (WEB-41): several phrasings per card, headline and challenge, filled with the week's facts
// ({friend}, {character}, …; {site} is the site name). A phrasing comes back only after every phrasing of its card was
// used (phrasing.ts). Rules (Nico, 2026-10-27): no pronouns ("Somebody pay a visit.", never "visit her"), full
// character names, friends by display name, never BattleTags.

export interface Phrasing {
  title: string;
  text: string;
}

const p = (title: string, text: string): Phrasing => ({ title, text });

export const CARD_TEXTS: Readonly<Record<string, readonly Phrasing[]>> = {
  // Awards: the title is the winner line; the card name ("The Grinder") goes above it.
  A1: [
    p("{friend} gained {amount}", "Nobody climbed faster this week."),
    p("{amount} for {friend}", "The levels kept coming, one after another."),
    p("{friend}: {amount} in one week", "The XP bar barely stood still."),
  ],
  A2: [
    p("{friend} was seen in {amount}", "Bags packed, map open, on the road all week."),
    p("{amount} for {friend}", "Every flight path got some use."),
    p("{friend} toured {amount}", "Postcards from all over Azeroth."),
  ],
  A3: [
    p("{friend} played {amount}", "Why pick one when the character screen holds so many?"),
    p("{amount} for {friend}", "Every alt got a turn this week."),
    p("{friend} rotated through {amount}", "The character select music must be stuck in a head by now."),
  ],
  A4: [
    p("{friend} earned {amount}", "Somewhere a pile of materials is a lot smaller now."),
    p("{amount} for {friend}", "The crafting window stayed open all week."),
    p("{friend} crafted {amount} higher", "Trainers across Azeroth know the name by now."),
  ],
  A5: [
    p("{friend} finished {amount}", "Quest givers everywhere ran out of exclamation marks."),
    p("{amount} for {friend}", "Turn in, accept, repeat."),
    p("{friend} handed in {amount}", "The quest log never had a quiet moment."),
  ],
  A6: [
    p("{friend} went through {amount}", "Boss loot tables got a workout."),
    p("{amount} for {friend}", "The dungeon finder of the old days: just going in."),
    p("{friend} cleared {amount}", "Torches, traps and treasure, all week long."),
  ],
  A8: [
    p("{friend} is back after {days} days", "Welcome back. The map missed the company."),
    p("{days} days away, then {friend} returned", "The hearthstone still works."),
    p("Look who's back: {friend}", "{days} days away, and straight back into it."),
  ],
  A9: [
    p("{friend} gained {amount}", "Shinier gear, bigger numbers."),
    p("{amount} for {friend}", "The armor rack got an upgrade."),
    p("{friend} geared up by {amount}", "New gear in almost every slot."),
  ],
  A10: [
    p("{friend}: {amount} in {weeks} weeks", "The season's champion. A spot in the hall of fame is well deserved."),
    p("{amount} over {weeks} weeks for {friend}", "The season belongs to {friend}."),
    p("{friend} tops the season with {amount}", "Ten weeks, one name at the top."),
  ],
  // Stats.
  S1: [
    p("{zone}", "{friends} friends passed through {zone} this week."),
    p("Everyone went to {zone}", "{friends} friends were seen there."),
    p("{zone} was the place to be", "{friends} friends, one zone."),
  ],
  S2: [
    p("{topCount} {topClass}s and counting", "{classes} classes in the group; the {topClass}s lead."),
    p("The {topClass} union grows", "{topCount} so far, across {classes} classes."),
    p("Class census: {topClass}s on top", "{topCount} {topClass}s among {classes} classes."),
  ],
  S3: [
    p("Horde {horde}, Alliance {alliance}", "The faction war, counted in characters."),
    p("{horde} Horde vs {alliance} Alliance", "Both sides have a seat at the table."),
    p("The faction split: {horde} to {alliance}", "Horde first, Alliance second, friends always."),
  ],
  S4: [
    p("{total} levels in total", "{gained} gained this week."),
    p("All levels together: {total}", "Up {gained} since last week."),
    p("{gained} more levels, {total} in all", "The group grows one level at a time."),
  ],
  S5: [
    p("{seen} of {total} zones seen", "{added} new this week."),
    p("The map fills in: {seen} of {total}", "{added} zones nobody had seen before."),
    p("{added} new zones on the map", "{seen} of {total} explored so far."),
  ],
  S6: [
    p("{spec} is in fashion", "{count} characters chose it."),
    p("{count} × {spec}", "The most popular talent choice in the group."),
    p("Talent trend: {spec}", "{count} characters can't be wrong."),
  ],
  S7: [
    p("{weekday} wins", "{friends} friends played that day."),
    p("Busiest evening: {weekday}", "{friends} friends online for it."),
    p("{weekday} night is game night", "{friends} friends showed up."),
  ],
  S8: [
    p("{dungeon}", "Run {runs} times this week."),
    p("{runs} runs of {dungeon}", "Somebody knows every pull by now."),
    p("Top dungeon: {dungeon}", "{runs} runs, and counting."),
  ],
  S9: [
    p("{tanks} tanks, {healers} healers", "That's who can hold aggro and keep everyone standing."),
    p("Role call: {tanks} tanks and {healers} healers", "Groups form around these numbers."),
    p("{healers} healers, {tanks} tanks", "The backbone of every dungeon run."),
  ],
  S10: [
    p("{character} carries {quests} quests", "A full quest log is a sign of ambition."),
    p("{quests} quests in one log", "{character} accepts everything."),
    p("Quest log hoarder: {character}", "{quests} quests, all saved for later."),
  ],
  S12: [
    p("{levels} levels in {weeks} weeks", "The season in one number."),
    p("Season stats: {levels} levels", "Ten weeks of play, added up."),
    p("{weeks} weeks, {levels} levels", "What a season."),
  ],
  // Progress.
  P1: [
    p("Race to 60", "{name1} {level1} · {name2} {level2} · {name3} {level3}"),
    p("The road to 60", "{name1} leads at {level1}, then {name2} ({level2}) and {name3} ({level3})."),
    p("Top three", "{name1} {level1}, {name2} {level2}, {name3} {level3}."),
  ],
  P2: [
    p("{character} reaches 60 in about {weeks} weeks", "At this week's pace, from level {level}."),
    p("Prediction: {character} at 60 in {weeks} weeks", "Level {level} now. Keep it up."),
    p("{weeks} weeks to 60 for {character}", "The numbers say so. Level {level} today."),
  ],
  P3: [
    p("Was the prediction right? {right}", "{character} was to reach 60 in {predicted} weeks; level {level} now."),
    p("Prediction check: {character}", "Predicted {predicted} weeks to 60, now level {level}. Right: {right}."),
    p("Four weeks ago: {character} in {predicted} weeks", "Level {level} today. Right: {right}."),
  ],
  P4: [
    p("{character} is {left} from a mount", "Level {level}; the riding trainer is waiting."),
    p("Mount countdown: {character}", "{left} levels to go, level {level} now."),
    p("{left} more for {character}", "Then no more walking."),
  ],
  P5: [
    p("{character} crossed level 30", "Halfway to 60."),
    p("Halfway club: {character}", "Level 30 reached."),
    p("{character} is halfway there", "Level 30, with {more} more crossing this week too."),
  ],
  P6: [
    p("{character} reached 60", "The {nth} character at max level."),
    p("Max-level club: {character}", "Number {club} at level 60."),
    p("{character} joins the max-level club", "{club} characters at 60 now."),
  ],
  P7: [
    p("Still nobody past {profession} 175", "{closest} is closest at {best}."),
    p("Gap alert: {profession}", "The best is {best}; {closest} is getting there."),
    p("{profession} needs a hero", "Highest so far: {best}."),
  ],
  P8: [
    p("{profession} 175 reached", "{character} closed the gap at {rank}."),
    p("Gap closed: {profession}", "{character} got there first."),
    p("{character} fixed the {profession} gap", "Now at {rank}."),
  ],
  P9: [
    p("{profession} race", "{first} {firstRank} vs {second} {secondRank}."),
    p("{first} and {second} neck and neck", "{profession} {firstRank} vs {secondRank}."),
    p("Crafting race: {profession}", "{first} leads {second} by a hair."),
  ],
  P10: [
    p("{character} maxed both professions", "{first} and {second} at cap."),
    p("Completionist: {character}", "{first} and {second}, both done."),
    p("Two professions, both at cap", "{character} did it: {first} and {second}."),
  ],
  P11: [
    p("{character}: item level {from} → {to}", "{gained} item levels in a week."),
    p("Gear jump: {character}", "Up {gained}, now {to}."),
    p("{gained} item levels for {character}", "From {from} to {to}."),
  ],
  P12: [
    p(
      "Then vs now",
      "{charactersThen} characters then, {charactersNow} now; {levelsThen} levels then, {levelsNow} now.",
    ),
    p("Since week 1", "From {levelsThen} to {levelsNow} levels, from {at60Then} to {at60Now} at 60."),
    p("How far the group came", "{charactersNow} characters, {levelsNow} levels, {at60Now} at 60."),
  ],
  P13: [
    p("A month ago, {character} was in {then}", "Now in {now}."),
    p("On this week last month", "{character}: {then} then, {now} now."),
    p("{character} moved on from {then}", "Next stop: {now}."),
  ],
  // Social.
  F1: [
    p("{first} & {second}", "{runs} runs together on {evenings} evenings."),
    p("Duo of the week: {first} and {second}", "{runs} runs side by side."),
    p("{first} and {second}, inseparable", "{evenings} evenings, {runs} runs."),
  ],
  F2: [
    p("{first} & {second} share {quests} quests", "Group up and finish the lot together."),
    p("Shared quest jackpot", "{first} and {second} have {quests} quests in common."),
    p("{quests} quests in common", "{first} and {second} are made for each other."),
  ],
  F3: [
    p("{character} has waited in {zone} for {days} days", "Somebody pay a visit."),
    p("Ghost town: {zone}", "{character} last seen {days} days ago. Anyone home?"),
    p("{days} days in {zone}", "{character} is still standing there. Somebody say hello."),
  ],
  F13: [
    p("{dungeon} fits {count} friends", "{names}. /ask to set it up."),
    p("Group idea: {dungeon}", "{names} are all the right level."),
    p("{count} friends, one dungeon: {dungeon}", "{names}. Who brings the snacks?"),
  ],
  // Fun.
  F4: [
    p("{zone}: a first for the {site}", "{character}, on {weekday}. {seen} of {total} zones seen now."),
    p("{character} discovered {zone}", "A first for the {site}."),
    p("New ground: {zone}", "{character} got there first, on {weekday}."),
  ],
  F6: [
    p("{character} never left {zone}", "Why travel when home is this nice?"),
    p("Homebody: {character}", "The whole week in {zone}."),
    p("{zone} is home for {character}", "Not a step outside all week."),
  ],
  F9: [
    p("{character} played {days} days", "The most loyal alt of the week."),
    p("Most loyal alt: {character}", "{days} days out of seven."),
    p("{days} days of {character}", "Some characters never get a day off."),
  ],
  F10: [
    p("{friend}: {days} evenings in a row", "A streak worth keeping."),
    p("Longest streak: {friend}", "{days} days in a row."),
    p("{days} days straight for {friend}", "Will the streak survive next week?"),
  ],
  F11: [
    p("Welcome, {character}", "{friend}'s new {class}, level {level}."),
    p("Fresh face: {character}", "A new {class} joins the {site}."),
    p("New in town: {character}", "{friend} rolled a {class}."),
  ],
  F12: [
    p("Who am I?", "{riddle} Answer: ||{character}||"),
    p("Riddle of the week", "{riddle} Who is it? ||{character}||"),
    p("Guess the character", "{riddle} The answer: ||{character}||"),
  ],
};

/** Headlines: chosen by the week (headline.ts), then phrased. */
export const HEADLINE_TEXTS: Readonly<Record<string, readonly string[]>> = {
  first: ["The first week of the {site}", "Week one of the {site}", "The {site} set out"],
  sixty: ["The week {character} hit 60", "{character} reached 60", "60 for {character}"],
  club: ["{character} joins the max-level club", "Another 60: {character}", "Welcome to 60, {character}"],
  levels: ["{levels} levels and a lot of {zone}", "{levels} levels this week", "A week of {levels} levels"],
  alts: ["Alts, alts everywhere", "{alts} new characters this week", "The week of new faces"],
  quiet: ["A quiet week in Azeroth", "A calm week", "Slow and steady"],
  dungeons: ["Dungeon week", "{runs} dungeon runs this week", "Into the depths"],
  crafters: ["The crafters' week", "Hammers, needles and flasks", "{points} skill points this week"],
  tourists: ["{zones} zones in seven days", "A week on the road", "Seen all over Azeroth"],
  season: ["{weeks} weeks of {site}", "The season so far", "{weeks} weeks together"],
};

/** Challenges for the coming week. */
export const CHALLENGE_TEXTS: Readonly<Record<string, readonly string[]>> = {
  everyoneTo10: ["Everyone to level 10", "Get every new character to 10", "Level 10 for all"],
  professionPair: ["Pick a profession pair", "Two professions for every character", "Train a second profession"],
  groupDungeon: [
    "Run {dungeon} with three {site}: {names} all fit. /ask to set it up.",
    "{dungeon} with three: {names}.",
    "Three friends, one {dungeon}: {names}.",
  ],
  closeGap: ["Get someone to {profession} 150", "{profession} 150 for the group", "Close the {profession} gap"],
  threeEvenings: ["Log in on 3 evenings", "Three evenings this week", "Show up three times"],
  scarlet: ["Clear Scarlet Monastery", "All four wings of Scarlet Monastery", "The Scarlet Crusade awaits"],
  craftForFriend: [
    "Craft something for a friend",
    "A gift from the crafting window",
    "Make something for someone else",
  ],
  sixtyDungeon: ["Run a level 60 dungeon", "A max-level dungeon together", "Endgame together"],
  newZone: ["Visit a zone nobody saw yet", "Find a zone the map doesn't know", "New ground for the {site}"],
  nextSeason: ["Pick next season's goal", "Ten more weeks: what's the goal?", "Choose the next season's challenge"],
  nextTen: ["Get {character} to level {target}", "{target} for {character}", "Push {character} to {target}"],
  questZone: ["Finish 10 quests in {zone}", "Clear the quest givers of {zone}", "{zone}: 10 quests"],
};

export const CLOSING_TEXTS: readonly string[] = [
  "See you next week.",
  "Until next Sunday.",
  "Have a good week in Azeroth.",
  "Same time next week.",
];
