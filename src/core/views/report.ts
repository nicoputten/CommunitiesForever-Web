import type { CharacterRef, Sender, UploadSummary } from "../diff";
import { classInfo, MAX_LEVEL, MAX_SKILL, professionInfo, raceInfo, type ClassFile } from "../gamedata";
import type { Dataset } from "../model";
import { own } from "../people";
import { ageSeconds, DAY, dataAge, HOUR, isOld, type DataAge } from "./age";
import { compareText, sightingView, type SightingView } from "./characters";

// The session report after an upload (board `upload-report`), from the summary stored with the upload (diff.ts).
// Ages are measured at upload time ("Femke · 1 h" means her data was an hour old when it arrived).

export interface ReportSender extends Sender {
  /** Seconds between their data and the upload; undefined without data. */
  ageAtUpload?: number;
  age: DataAge;
  /** 7 days old or more at upload time. */
  old: boolean;
}

export interface ZoneSightings {
  sighting: SightingView;
  /** Newest sighting first. */
  characters: (CharacterRef & { seenAt: number })[];
}

export interface UploadReport {
  uploadedAt: number;
  counts: UploadSummary["counts"];
  /** Most levels gained first ("LEVEL UP ×2"). */
  levelUps: (UploadSummary["levelUps"][number] & { gained: number })[];
  newCharacters: UploadSummary["newCharacters"];
  removedCharacters: UploadSummary["removedCharacters"];
  /** Highest new rank first. */
  skillGains: UploadSummary["professionGains"];
  itemLevelGains: UploadSummary["itemLevelGains"];
  senders: ReportSender[];
  /** Sightings grouped by zone text ("Lia and Ves · Stranglethorn Vale"), newest first. */
  sightings: ZoneSightings[];
  /** Nothing changed and nobody sent newer data (board `upload-states`, "nothing new"). */
  nothingNew: boolean;
}

export function uploadReport(summary: UploadSummary, uploadedAt: number): UploadReport {
  const byZone = new Map<string, ZoneSightings["characters"]>();
  for (const s of summary.sightings) {
    const character: ZoneSightings["characters"][number] = { guid: s.guid, seenAt: s.seenAt };
    if (s.owner !== undefined) character.owner = s.owner;
    if (s.name !== undefined) character.name = s.name;
    byZone.set(s.zone, [...(byZone.get(s.zone) ?? []), character]);
  }
  const sightings: ZoneSightings[] = [...byZone].map(([zone, characters]) => {
    characters.sort((a, b) => b.seenAt - a.seenAt || compareText(a.name, b.name) || compareText(a.guid, b.guid));
    return { sighting: sightingView(zone, characters[0]?.seenAt ?? 0, uploadedAt), characters };
  });
  sightings.sort(
    (a, b) => b.sighting.seenAt - a.sighting.seenAt || compareText(a.sighting.zoneText, b.sighting.zoneText),
  );

  const senders = summary.senders.map((s): ReportSender => {
    const sender: ReportSender = { ...s, age: dataAge(s.dataAt, uploadedAt), old: isOld(s.dataAt, uploadedAt) };
    if (s.dataAt !== undefined) sender.ageAtUpload = ageSeconds(s.dataAt, uploadedAt);
    return sender;
  });

  const changes =
    summary.newPeople.length +
    summary.newCharacters.length +
    summary.removedCharacters.length +
    summary.levelUps.length +
    summary.professionGains.length +
    summary.itemLevelGains.length +
    summary.sightings.length;

  return {
    uploadedAt,
    counts: summary.counts,
    levelUps: summary.levelUps
      .map((l) => ({ ...l, gained: l.to - l.from }))
      .sort((a, b) => b.gained - a.gained || b.to - a.to || compareText(a.name, b.name) || compareText(a.guid, b.guid)),
    newCharacters: summary.newCharacters,
    removedCharacters: summary.removedCharacters,
    skillGains: [...summary.professionGains].sort(
      (a, b) => b.to - a.to || compareText(a.name, b.name) || compareText(a.skillLine, b.skillLine),
    ),
    itemLevelGains: summary.itemLevelGains,
    senders,
    sightings,
    nothingNew: changes === 0 && summary.counts.peopleWithNewData === 0,
  };
}

// --- the report page (WEB-20) ------------------------------------------------------------------------------------
// What the session report screen shows, row by row. The stored summary has no class or race, so they come from the
// current data (they never change); level, zone and every number come from the summary (Nico, WEB-20).

/** A character as a report row names it: the full name, or "Sanne's character" for one without a record. */
export interface ReportCharacter {
  guid: string;
  name: string;
  /** Undefined without a known class: a neutral disc. */
  classFile?: ClassFile;
  /** The character's own name; undefined for a stub (the disc shows "?"). */
  ownName?: string;
}

export interface ReportLevelUp extends ReportCharacter {
  from: number;
  to: number;
  /** "LEVEL UP" or "LEVEL UP ×2". */
  badge: string;
  /** Bar fractions of the level cap (0..1). */
  fromShare: number;
  toShare: number;
}

export interface ReportNewFace extends ReportCharacter {
  /** "Femke's new Orc Warlock · level 15 · Durotar". */
  line: string;
}

export interface ReportSkillGain extends ReportCharacter {
  profession: string;
  from: number;
  to: number;
  capReached: boolean;
  /** Bar fractions of the 300 skill scale (0..1). */
  fromShare: number;
  toShare: number;
}

export interface ReportGear extends ReportCharacter {
  from: number;
  to: number;
}

export interface ReportSenderChip {
  key: string;
  /** "Nico · just now", "Mira · 2 days, via Bob", "Jorrit · nothing new (9 days)", "Sanne · no addon". */
  text: string;
  /** The dot (DESIGN.md §4, at upload time); undefined: no dot (no addon, or no time). */
  age?: Exclude<DataAge, "unknown">;
  /** Nothing new or no addon: a dim chip. */
  quiet: boolean;
}

export interface ReportSightingLine {
  characters: ReportCharacter[];
  /** "Stranglethorn Vale", "The Deadmines, Westfall". */
  place: string;
}

export interface ReportCounter {
  value: number;
  label: string;
}

export interface SessionReport {
  uploadedAt: number;
  /** The uploader's display name. */
  uploader: string;
  /** The site's first accepted upload: every character is new. */
  first: boolean;
  /** Levels gained, skill gains, new characters, new sightings (the board's four counters). */
  counters: ReportCounter[];
  /** "new data from 4 friends", the uploader included. */
  friendsWithNewData: number;
  /** For the first upload: "10 characters from 6 friends" (characters with a record, and their owners). */
  characters: number;
  friends: number;
  /** Most levels gained first. */
  levelUps: ReportLevelUp[];
  /** Characters with a record first, then by name. */
  newFaces: ReportNewFace[];
  /** Names of characters no longer on the roster. */
  removed: string[];
  /** Highest new rank first. */
  skillGains: ReportSkillGain[];
  gear: ReportGear[];
  senders: ReportSenderChip[];
  /** Per zone, newest first. */
  sightings: ReportSightingLine[];
  nothingNew: boolean;
}

const share = (value: number, of: number) => Math.max(0, Math.min(1, value / of));

const word = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** The age on a "who sent data" chip: just now (< 5 min), N min, N h, N day(s). */
export function shortAge(seconds: number): string {
  if (seconds < 5 * 60) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / 60)} min`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} h`;
  const days = Math.floor(seconds / DAY);
  return `${days} ${word(days, "day")}`;
}

function senderChip(s: ReportSender): ReportSenderChip {
  if (s.status === "noAddon") return { key: s.key, text: `${s.displayName} · no addon`, quiet: true };
  const age = s.ageAtUpload === undefined ? undefined : shortAge(s.ageAtUpload);
  const via = s.viaName !== undefined ? `, via ${s.viaName}` : "";
  const text =
    s.status === "unchanged"
      ? `${s.displayName} · nothing new${age === undefined ? "" : ` (${age})`}`
      : `${s.displayName}${age === undefined ? "" : ` · ${age}`}${via}`;
  const chip: ReportSenderChip = { key: s.key, text, quiet: s.status === "unchanged" };
  if (s.age !== "unknown") chip.age = s.age;
  return chip;
}

/** A person's name from the summary itself (senders, new people), for someone the current data no longer has. */
function summaryName(summary: UploadSummary, key: string): string | undefined {
  return (
    summary.senders.find((s) => s.key === key)?.displayName ?? summary.newPeople.find((p) => p.key === key)?.displayName
  );
}

/**
 * The session report page of an accepted upload: `summary` and `uploadedAt` from the stored upload, `data` the
 * current merged data (class and race only), `uploader` the uploader's display name, `first` the site's first upload.
 */
export function sessionReport(
  summary: UploadSummary,
  uploadedAt: number,
  data: Dataset | undefined,
  uploader: string,
  first: boolean,
): SessionReport {
  const r = uploadReport(summary, uploadedAt);
  const stored = (guid: string) => own(data?.characters ?? {}, guid);
  const ownerName = (owner: string | undefined) =>
    owner === undefined ? undefined : (own(data?.people ?? {}, owner)?.displayName ?? summaryName(summary, owner));

  const character = (c: CharacterRef & { classFile?: string }): ReportCharacter => {
    const owner = ownerName(c.owner);
    const out: ReportCharacter = {
      guid: c.guid,
      name: c.name ?? (owner !== undefined ? `${owner}'s character` : "Unknown character"),
    };
    if (c.name !== undefined) out.ownName = c.name;
    const cls = classInfo(c.classFile ?? stored(c.guid)?.classFile);
    if (cls !== undefined) out.classFile = cls.classFile;
    return out;
  };

  const place = (zoneText: string, seenAt: number) => {
    const v = sightingView(zoneText, seenAt, uploadedAt);
    return v.dungeon !== undefined && v.zoneName !== undefined ? `${v.dungeon.name}, ${v.zoneName}` : v.zoneText;
  };
  const sightingOf = new Map(summary.sightings.map((s) => [s.guid, s]));

  const newFaces = r.newCharacters
    .map((c): ReportNewFace => {
      const what = [raceInfo(stored(c.guid)?.raceID)?.name, classInfo(c.classFile ?? stored(c.guid)?.classFile)?.name]
        .filter((p) => p !== undefined)
        .join(" ");
      const owner = ownerName(c.owner);
      const seen = sightingOf.get(c.guid);
      const line = [
        `${owner !== undefined ? `${owner}'s new` : "New"} ${what === "" ? "character" : what}`,
        c.level !== undefined ? `level ${c.level}` : undefined,
        seen !== undefined ? place(seen.zone, seen.seenAt) : "Location unknown",
      ];
      return { ...character(c), line: line.filter((p) => p !== undefined).join(" · ") };
    })
    .sort(
      (a, b) =>
        Number(b.ownName !== undefined) - Number(a.ownName !== undefined) ||
        compareText(a.name, b.name) ||
        compareText(a.guid, b.guid),
    );

  const withRecord = r.newCharacters.filter((c) => c.hasRecord);
  const c = r.counts;
  return {
    uploadedAt,
    uploader,
    first,
    counters: [
      { value: c.levelsGained, label: word(c.levelsGained, "level gained", "levels gained") },
      { value: c.skillGains, label: word(c.skillGains, "skill gain") },
      { value: c.newCharacters, label: word(c.newCharacters, "new character") },
      { value: c.sightings, label: word(c.sightings, "new sighting") },
    ],
    friendsWithNewData: c.peopleWithNewData,
    characters: withRecord.length,
    friends: new Set(withRecord.map((n) => n.owner).filter((o) => o !== undefined)).size,
    levelUps: r.levelUps.map((l) => ({
      ...character(l),
      from: l.from,
      to: l.to,
      badge: l.gained > 1 ? `LEVEL UP ×${l.gained}` : "LEVEL UP",
      fromShare: share(l.from, MAX_LEVEL),
      toShare: share(l.to, MAX_LEVEL),
    })),
    newFaces,
    removed: r.removedCharacters.map((rc) => character(rc).name),
    skillGains: r.skillGains.map((g) => {
      const from = g.from ?? 0;
      return {
        ...character(g),
        profession: g.profession ?? professionInfo(g.skillLine)?.name ?? "Unknown profession",
        from,
        to: g.to,
        capReached: g.capReached,
        fromShare: share(from, MAX_SKILL),
        toShare: share(g.to, MAX_SKILL),
      };
    }),
    gear: r.itemLevelGains.map((g) => ({ ...character(g), from: g.from, to: g.to })),
    senders: r.senders.map(senderChip),
    sightings: r.sightings.map((z) => ({
      characters: z.characters.map(character),
      place: place(z.sighting.zoneText, z.sighting.seenAt),
    })),
    nothingNew: r.nothingNew,
  };
}
