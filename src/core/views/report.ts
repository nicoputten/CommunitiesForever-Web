import type { CharacterRef, Sender, UploadSummary } from "../diff";
import { ageSeconds, dataAge, isOld, type DataAge } from "./age";
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
