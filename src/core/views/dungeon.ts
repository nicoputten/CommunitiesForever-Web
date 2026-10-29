import { sameBattleTag } from "../access";
import map from "../map/zones.json";
import {
  DUNGEONS,
  RUNNABLE_DUNGEONS,
  classInfo,
  dungeonPosition,
  rolesFor,
  type LevelRange,
  type RunnableDungeon,
} from "../gamedata";
import { levelFit } from "../levelFit";
import {
  counts,
  isUpcoming,
  openSlots,
  runDungeon,
  SLOT_ROLES,
  slotRole,
  type RunRecord,
  type SlotRole,
} from "../runs";
import { dayLabel, localTime, runWhen } from "../runTime";
import { byLevel, type CharacterView } from "./characters";
import type { Continent } from "./mapMarkers";
import { joinNames } from "./text";
import type { RunsInput } from "./runs";
import { UNKNOWN_CHARACTER } from "./text";

// The dungeon page (WEB-42, board `dungeon-page`, decided with Nico 2026-10-28): one page per dungeon a group runs
// (`RUNNABLE_DUNGEONS`: Scarlet Monastery as its four wings), who fits per role, the runs planned here and in the
// other wings, the runs that ran here (WEB-43), Plan a run. And the map's dungeon entrances: the count of planned runs
// and the links of their popover.

const ROLE_TITLE: Record<SlotRole, string> = { tank: "Tank", healer: "Healer", damage: "Damage" };
/** Runs shown under "Ran here": the last few. */
export const RAN_SHOWN = 5;

const zoneById = new Map(map.zones.map((z) => [z.id, z]));

export interface Crumb {
  label: string;
  href?: string;
}

export interface FitCharacter {
  guid: string;
  name: string;
  level?: number;
  /** The class text colour token, for the name. */
  colorToken?: string;
  /** The friend's display name. */
  friend?: string;
  /** "+3 over"; undefined when it fits. */
  over?: string;
}

export interface FitRole {
  role: SlotRole;
  title: string;
  /** Characters whose level fits or is over (levelFit `suggested`), highest first. Carries are left out. */
  characters: FitCharacter[];
  /** When nobody fits: the closest character below the range whose class can play the role. */
  short?: FitCharacter & { levels: number };
}

export interface PlannedRunView {
  href: string;
  /** "Today", "Wed 4 Nov". */
  day: string;
  /** "20:30" in the viewer's zone. */
  time: string;
  /** The organiser's display name. */
  by: string;
  /** The character the organiser leads as. */
  lead?: { name: string; colorToken?: string };
  /** "3 in · 1 maybe · tank open". */
  summary: string;
  /** The five slots in order (tank, healer, damage × 3): filled or not. */
  slots: { role: SlotRole; filled: boolean }[];
}

export interface RanRunView {
  href: string;
  /** "Today", "Sat 31 Oct". */
  day: string;
  by: string;
  /** "Ran it · 3 of 5 signed-up came". */
  result: string;
}

export interface WingLink {
  label: string;
  href: string;
  current: boolean;
  /** Upcoming runs planned in the wing. */
  planned: number;
}

export interface DungeonPage {
  id: string;
  /** The wing's name for a wing ("Armory"), else the dungeon's. */
  title: string;
  /** "Scarlet Monastery · Tirisfal Glades", "Durotar". */
  eyebrow: string;
  /** "Levels 32–42 (typical)". */
  levels: string;
  crumbs: Crumb[];
  wings?: WingLink[];
  planHref: string;
  /** Where the entrance is, for the hero's map; undefined when the map has no place for it. */
  entrance?: { zone: string; x: number; y: number };
  whoFits: FitRole[];
  /** No character with a record at all (before the first upload). */
  noCharacters: boolean;
  planned: PlannedRunView[];
  /** "Cathedral on Wed 4 Nov 20:00 (Femke)": upcoming runs in the other wings. */
  otherWings: { text: string; href: string }[];
  ran: RanRunView[];
}

function rangeText(r: LevelRange): string {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

export function dungeonHref(id: string): string {
  return `/dungeons/${encodeURIComponent(id)}`;
}

export function planHref(id?: string): string {
  return id === undefined ? "/runs/new" : `/runs/new?dungeon=${encodeURIComponent(id)}`;
}

function continentOf(zone: string): Continent | undefined {
  const cont = zoneById.get(zone)?.cont;
  return cont === "K" ? "kalimdor" : cont === "E" ? "eastern-kingdoms" : undefined;
}

/**
 * The page id a path asks for: a runnable dungeon's id, or the instance of wings that are dungeons ("sm"), which
 * goes to its first wing. Undefined for an unknown id or a raid.
 */
export function dungeonPageId(id: string): { id: string; redirect: boolean } | undefined {
  if (RUNNABLE_DUNGEONS.some((d) => d.id === id)) return { id, redirect: false };
  const first = RUNNABLE_DUNGEONS.find((d) => d.instanceId === id);
  return first === undefined ? undefined : { id: first.id, redirect: true };
}

const upcomingIn = (runs: readonly RunRecord[], id: string, now: number) =>
  runs.filter((r) => r.dungeonId === id && isUpcoming(r, now)).sort((a, b) => a.startsAt - b.startsAt || a.id - b.id);

interface Names {
  friend: (battleTag: string) => string;
  character: (guid: string | undefined) => CharacterView | undefined;
}

function names(input: RunsInput): Names {
  const byGuid = new Map(input.characters.map((c) => [c.guid, c]));
  return {
    friend: (tag) => {
      const p = input.people.find((x) => sameBattleTag(x.battleTag ?? x.key, tag));
      return p?.displayName ?? tag.split("#")[0]!;
    },
    character: (guid) => (guid === undefined ? undefined : byGuid.get(guid)),
  };
}

function fitCharacter(c: CharacterView, over?: string): FitCharacter {
  const v: FitCharacter = { guid: c.guid, name: c.name ?? UNKNOWN_CHARACTER };
  if (c.level !== undefined) v.level = c.level;
  const token = classInfo(c.classFile)?.textToken;
  if (token !== undefined) v.colorToken = token;
  if (c.ownerName !== undefined) v.friend = c.ownerName;
  if (over !== undefined) v.over = over;
  return v;
}

/** Who fits per role: the role the addon knows (an unknown role counts as damage, as for runs). */
export function whoFits(characters: readonly CharacterView[], r: LevelRange): FitRole[] {
  const sorted = [...characters].sort(byLevel);
  return SLOT_ROLES.map((role) => {
    const fitting = sorted.filter((c) => slotRole(c.role) === role && levelFit(c.level, r.min, r.max).suggested);
    const v: FitRole = {
      role,
      title: ROLE_TITLE[role],
      characters: fitting.map((c) => {
        const fit = levelFit(c.level, r.min, r.max);
        return fitCharacter(c, fit.kind === "over" ? fit.label : undefined);
      }),
    };
    if (fitting.length === 0) {
      const closest = sorted.find(
        (c) => c.level !== undefined && c.level < r.min && rolesFor(c.classFile).includes(role),
      );
      if (closest !== undefined) v.short = { ...fitCharacter(closest), levels: r.min - closest.level! };
    }
    return v;
  });
}

/** "3 in · 1 maybe · tank open", "5 in · full". */
export function plannedSummary(run: RunRecord): string {
  const c = counts(run.answers);
  const parts = [`${c.in} in`];
  if (c.maybe > 0) parts.push(`${c.maybe} maybe`);
  const open = openSlots(run.answers);
  const roles = SLOT_ROLES.filter((role) => open[role] > 0).map((role) =>
    role === "damage" && open.damage > 1 ? `${open.damage} damage` : role,
  );
  parts.push(roles.length === 0 ? "full" : `${joinNames(roles)} open`);
  return parts.join(" · ");
}

function slotBars(run: RunRecord): PlannedRunView["slots"] {
  const open = openSlots(run.answers);
  const out: PlannedRunView["slots"] = [];
  for (const role of SLOT_ROLES) {
    const size = role === "damage" ? 3 : 1;
    for (let i = 0; i < size; i++) out.push({ role, filled: i < size - Math.max(0, open[role]) });
  }
  return out;
}

function plannedView(input: RunsInput, n: Names, run: RunRecord): PlannedRunView {
  const tz = input.viewer.timeZone;
  const v: PlannedRunView = {
    href: `/runs/${run.id}`,
    day: dayLabel(run.startsAt, tz, input.now),
    time: localTime(run.startsAt, tz),
    by: n.friend(run.organiser),
    summary: plannedSummary(run),
    slots: slotBars(run),
  };
  const lead = run.answers.find((a) => sameBattleTag(a.battleTag, run.organiser) && a.answer === "in");
  const c = n.character(lead?.guid);
  if (c !== undefined) {
    v.lead = { name: c.name ?? UNKNOWN_CHARACTER };
    const token = classInfo(c.classFile)?.textToken;
    if (token !== undefined) v.lead.colorToken = token;
  }
  return v;
}

function levelsLine(dungeon: RunnableDungeon): string {
  return `Levels ${rangeText(dungeon.typicalLevels)} (typical)`;
}

/** The dungeon page of a runnable dungeon id ("sm-armory", "rfc"); undefined for an unknown id. */
export function dungeonPage(input: RunsInput, id: string): DungeonPage | undefined {
  const dungeon = runDungeon(id);
  const instance = DUNGEONS.find((d) => d.id === dungeon?.instanceId);
  if (dungeon === undefined || instance === undefined) return undefined;
  const n = names(input);
  const { now } = input;
  const tz = input.viewer.timeZone;
  const zone = zoneById.get(instance.zone);
  const wing =
    instance.wingsAreDungeons === true ? instance.wings?.find((w) => `${instance.id}-${w.id}` === id) : undefined;
  const continent = continentOf(instance.zone);

  const crumbs: Crumb[] = [{ label: "Map", href: continent === undefined ? "/" : `/?continent=${continent}` }];
  if (zone !== undefined) crumbs.push({ label: zone.name });
  crumbs.push({ label: instance.name });
  if (wing !== undefined) crumbs.push({ label: wing.name });

  const page: DungeonPage = {
    id,
    title: wing?.name ?? instance.name,
    eyebrow: [wing === undefined ? undefined : instance.name, zone?.name].filter((x) => x !== undefined).join(" · "),
    levels: levelsLine(dungeon),
    crumbs,
    planHref: planHref(id),
    whoFits: whoFits(input.characters, dungeon.typicalLevels),
    noCharacters: input.characters.length === 0,
    planned: upcomingIn(input.runs, id, now).map((r) => plannedView(input, n, r)),
    otherWings: [],
    ran: input.runs
      .filter((r) => r.dungeonId === id && !isUpcoming(r, now) && r.outcome?.kind === "done")
      .sort((a, b) => b.startsAt - a.startsAt || b.id - a.id)
      .slice(0, RAN_SHOWN)
      .map((r) => ({
        href: `/runs/${r.id}`,
        day: dayLabel(r.startsAt, tz, now),
        by: n.friend(r.organiser),
        result:
          r.outcome?.kind === "done" ? `Ran it · ${r.outcome.came} of ${r.outcome.signedUp} signed-up came` : "Ran it",
      })),
  };
  const position = dungeonPosition(instance);
  if (position !== undefined) page.entrance = { zone: instance.zone, ...position };

  if (wing !== undefined) {
    const siblings = RUNNABLE_DUNGEONS.filter((d) => d.instanceId === instance.id);
    page.wings = siblings.map((d) => ({
      label: `${d.name.slice(instance.name.length + 2)} ${rangeText(d.typicalLevels)}`,
      href: dungeonHref(d.id),
      current: d.id === id,
      planned: upcomingIn(input.runs, d.id, now).length,
    }));
    page.otherWings = siblings
      .filter((d) => d.id !== id)
      .flatMap((d) =>
        upcomingIn(input.runs, d.id, now).map((r) => ({
          run: r,
          text: `${d.name.slice(instance.name.length + 2)} on ${runWhen(r.startsAt, tz, now)} (${n.friend(r.organiser)})`,
        })),
      )
      .sort((a, b) => a.run.startsAt - b.run.startsAt || a.run.id - b.run.id)
      .map(({ run, text }) => ({ text, href: `/runs/${run.id}` }));
  }
  return page;
}

// --- the map's dungeon entrances ----------------------------------------------------------------------------------

export interface MapDungeonPage {
  /** "Graveyard 26–36" for a wing, else the range ("13–18"). */
  label: string;
  href: string;
  planned: number;
}

export interface MapDungeon {
  name: string;
  x: number;
  y: number;
  /** Raids have no page and no popover. */
  kind: "dungeon" | "raid";
  /** "13–18", "26–45": the typical range over all wings. */
  levels: string;
  /** Upcoming runs planned here, all wings together. */
  planned: number;
  /** The dungeon's pages: one, or one per wing (Scarlet Monastery). */
  pages: MapDungeonPage[];
  /** Plan a run: the dungeon filled in, or for wings left to pick. */
  planHref: string;
}

/** Every dungeon entrance on the map, with its planned runs and links (WEB-42). */
export function mapDungeons(runs: readonly RunRecord[], now: number): MapDungeon[] {
  return DUNGEONS.flatMap((instance): MapDungeon[] => {
    const at = dungeonPosition(instance);
    if (at === undefined) return [];
    const runnable = RUNNABLE_DUNGEONS.filter((d) => d.instanceId === instance.id);
    const wings = runnable.length > 1;
    const pages = runnable.map((d) => ({
      label: wings
        ? `${d.name.slice(instance.name.length + 2)} ${rangeText(d.typicalLevels)}`
        : rangeText(d.typicalLevels),
      href: dungeonHref(d.id),
      planned: upcomingIn(runs, d.id, now).length,
    }));
    return [
      {
        name: instance.name,
        x: at.x,
        y: at.y,
        kind: instance.kind,
        levels: rangeText(instance.typicalLevels),
        planned: pages.reduce((sum, p) => sum + p.planned, 0),
        pages,
        planHref: planHref(wings ? undefined : runnable[0]?.id),
      },
    ];
  });
}
