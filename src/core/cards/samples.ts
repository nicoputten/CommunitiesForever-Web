import type { Milestone } from "../bot";
import type { BoardData } from "../doomsday/posts";
import { boardCard, type CardSpec, featCard, recapHeader, stripCard, zoneCard } from "./models";

// The test posts' images (WEB-68; Nico, live test 2026-10-29: "test posts look like the real ones"). The Discord
// page's test buttons send the bot a `test` event; these are the pictures that go with it, drawn by the same renderer
// as the real ones, with the bot's own made-up sample names (bot src/core/samples.ts): Test Friend, Another Test and
// Testy McTestface. Fixed facts, so each id always draws the same picture.

const CHARACTER = { name: "Testy McTestface", classFile: "WARLOCK", classLabel: "Warlock", race: "Undead" };
const FRIEND = "Test Friend";
const OTHER = "Another Test";

/** A day for the sample board: a fixed one, so the picture never changes (Wed 28 Oct 2026, 19:00 in Paris). */
const START = Date.UTC(2026, 9, 28, 18, 0) / 1000;

const BOARD: BoardData = {
  day: 0,
  week: 0,
  label: "Test day",
  span: "",
  start: START,
  end: START + 86400,
  // A real day's five columns, with the addon's short labels.
  goals: [
    { slot: "pve1", id: "d.level", title: "Gain a level", track: "pve", points: 5, shortLabel: "Level" },
    {
      slot: "pve2",
      id: "d.shared3",
      title: "Share 3 quests with a friend",
      track: "pve",
      points: 5,
      shortLabel: "3 shared",
    },
    {
      slot: "pve3",
      id: "d.skill5",
      title: "Earn 5 profession skill points",
      track: "pve",
      points: 5,
      shortLabel: "Skills",
    },
    { slot: "hunt", id: "hunt", title: "The Hunt: a test dummy", track: "pvp", points: 5, shortLabel: "Hunt" },
    {
      slot: "skirmish",
      id: "p.loneWolf",
      title: "Lone wolf: 3 solo kills",
      track: "pvp",
      points: 5,
      shortLabel: "Lone wolf",
    },
  ],
  friends: [
    {
      name: FRIEND,
      goals: [
        { slot: "pve1", id: "d.level", done: true, at: START + 3600 },
        { slot: "pve2", id: "d.shared3", done: true, at: START + 5400 },
        { slot: "hunt", id: "hunt", done: true, at: START + 7200 },
      ],
      doneCount: 3,
      goalCount: 6,
      crossedOut: false,
      today: { pve: 10, pvp: 5 },
      week: { pve: 10, pvp: 5 },
      streak: 1,
      best: 1,
      pvpVirgin: false,
    },
    {
      name: OTHER,
      goals: [],
      doneCount: 0,
      goalCount: 6,
      crossedOut: false,
      today: { pve: 0, pvp: null },
      week: { pve: 0, pvp: null },
      streak: 0,
      best: 0,
      pvpVirgin: true,
    },
  ],
  withoutData: [],
  crown: null,
  yesterdayCrown: null,
};

const character = { guid: "Test-0-TESTY", name: CHARACTER.name, classFile: CHARACTER.classFile };

/** The test images by name; the card ids are `sample-<name>`. */
const SAMPLES: Readonly<Record<string, (host: string) => CardSpec | undefined>> = {
  // The daily board, an hour before the reset.
  board: (host) => boardCard(BOARD, BOARD.end - 3600, "Europe/Paris", host),
  // A big feat card: rank 6, first in the group (the bot's feat sample).
  "feat-big": (host) =>
    featCard(
      {
        kind: "pvpRank",
        character,
        rank: 6,
        rankName: "Stone Guard",
        title: "Mailbox Menace",
        firstInGroup: true,
      } as Milestone,
      CHARACTER,
      host,
    ),
  // A strip feat card: first blood.
  "feat-strip": () => stripCard({ kind: "honorKills", character, kills: 1 } as Milestone, CHARACTER),
  // The recap's award header and its Bloodbath zone crop.
  "recap-header": (host) =>
    recapHeader(
      {
        dates: "Test week",
        headline: "A week of tests",
        award: {
          title: "Warmonger",
          friend: CHARACTER.name,
          amount: "12 honorable kills",
          classFile: CHARACTER.classFile,
        },
      },
      host,
    ),
  "recap-zone": (host) => zoneCard("Stranglethorn Vale", 2, host, { kills: 12 }),
};

/** The card spec of a test image (`sample-<name>`), or undefined for an unknown name. */
export function sampleCard(name: string, host: string): CardSpec | undefined {
  return Object.hasOwn(SAMPLES, name) ? SAMPLES[name]!(host) : undefined;
}

/** The test kinds with a sample of their own (the Discord page's test buttons; bot `TestKind`). */
export type TestKind = "posts" | "feats" | "recap" | "doomsday";

/**
 * The image ids a `test` event of this kind carries for the bot (docs/BOT-API.md "Test images"): the same roles as the
 * real posts' fields. None for the plain test post.
 */
export function testImages(kind: TestKind): Record<string, string> | undefined {
  switch (kind) {
    case "doomsday":
      return { board: "sample-board" };
    case "feats":
      return { feat: "sample-feat-big", strip: "sample-feat-strip" };
    case "recap":
      return { award: "sample-recap-header", zone: "sample-recap-zone" };
    default:
      return undefined;
  }
}
