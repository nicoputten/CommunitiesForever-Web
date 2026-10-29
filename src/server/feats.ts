import { type Milestone, milestoneCharacter, milestones, sortMilestones } from "@/core/bot";
import type { UploadSummary } from "@/core/diff";
import {
  detectFeats,
  type FeatFields,
  type FeatKind,
  featText,
  groupKey,
  type HeldFeat,
  CAP_TITLES,
  milestoneKey,
} from "@/core/doomsday/feats";
import type { FeedDay, PersonFeed } from "@/core/feed";
import type { Dataset } from "@/core/model";
import type { Db } from "./db";
import { feats, feedDays } from "./db/schema";

// Feats (WEB-56): with every accepted upload, in its transaction and in upload order, so a rebuild holds the same
// feats again. The feats an upload brings that weren't already had become its `milestones` event (src/server/bot.ts),
// which a rebuild never writes again.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The milestone a feat of an existing kind (WEB-38) keeps in the feats table. */
function milestoneFeat(m: Milestone): { kind: FeatKind; guid: string; key: string; fields: FeatFields } | undefined {
  const guid = m.character.guid;
  switch (m.kind) {
    case "level":
    case "maxLevel":
      return { kind: m.kind, guid, key: milestoneKey(m), fields: { level: m.level } };
    case "professionCap": {
      const title = m.rank >= 300 ? CAP_TITLES[Number(m.skillLine)] : undefined;
      return {
        kind: m.kind,
        guid,
        key: milestoneKey(m),
        fields: title !== undefined ? { rank: m.rank, title } : { rank: m.rank },
      };
    }
    case "newCharacter":
      return {
        kind: m.kind,
        guid,
        key: milestoneKey(m),
        fields: m.character.level !== undefined ? { level: m.character.level } : {},
      };
    default:
      return undefined;
  }
}

/** Duels won and deaths per character from every stored feed day: the fallback without lifetime counters. */
function feedCounts(tx: Tx): Record<string, { duelsWon: number; deaths: number }> {
  const out: Record<string, { duelsWon: number; deaths: number }> = {};
  for (const { guid, data } of tx.select({ guid: feedDays.guid, data: feedDays.data }).from(feedDays).all()) {
    const c = (out[guid] ??= { duelsWon: 0, deaths: 0 });
    c.duelsWon += (data.duels ?? []).filter((d) => d.won === true).length;
    c.deaths += (data.deaths ?? []).length;
  }
  return out;
}

/**
 * Holds the feats an accepted upload brings and returns the milestones to post (feats not already had), sorted and
 * with their texts; the card ids are added when the event is written. Runs after the upload's feed is stored.
 */
export function recordFeats(
  tx: Tx,
  upload: { id: number; uploadedAt: number },
  before: Dataset | undefined,
  after: Dataset,
  summary: UploadSummary,
  uploadFeeds: readonly PersonFeed[],
): Milestone[] {
  const held: Record<string, Record<string, FeatFields>> = {};
  const groupHeld = new Set<string>();
  const mounts = { mount: 0, epic: 0 };
  for (const row of tx.select().from(feats).all()) {
    (held[row.guid] ??= {})[row.key] = row.fields;
    const g = groupKey(row);
    if (g !== undefined) groupHeld.add(g);
    if (row.kind === "mount") mounts.mount += 1;
    if (row.kind === "epicMount") mounts.epic += 1;
  }
  const feed: Record<string, FeedDay[]> = {};
  for (const f of uploadFeeds) {
    for (const day of Object.keys(f.days).sort()) {
      for (const [guid, entry] of Object.entries(f.days[Number(day)]!)) (feed[guid] ??= []).push(entry);
    }
  }
  // The site's first upload makes no milestones (WEB-38): everything in it is already had.
  const reached = before === undefined ? [] : milestones(summary, after);
  const byKey = new Map<string, Milestone>();
  const fromMilestones: { kind: FeatKind; guid: string; key: string; fields: FeatFields }[] = [];
  for (const m of reached) {
    const f = milestoneFeat(m);
    if (f === undefined) continue;
    byKey.set(`${f.guid}|${f.key}`, m);
    fromMilestones.push(f);
  }

  const found = detectFeats({
    before,
    after,
    held,
    groupHeld,
    mounts,
    feed,
    feedCounts: feedCounts(tx),
    milestones: fromMilestones,
  });

  const posts: Milestone[] = [];
  for (const f of found) {
    tx.insert(feats)
      .values({
        guid: f.guid,
        key: f.key,
        kind: f.kind,
        owner: after.characters[f.guid]?.owner ?? "",
        uploadId: upload.id,
        at: upload.uploadedAt,
        alreadyHad: f.alreadyHad,
        firstInGroup: f.firstInGroup,
        fields: f.fields,
      })
      .onConflictDoNothing()
      .run();
    if (!f.alreadyHad) posts.push(post(f, after, byKey.get(`${f.guid}|${f.key}`)));
  }
  return sortMilestones(posts);
}

/** A feat as its milestone: the existing kinds as before, the new ones with their fields; plus text and badge. */
function post(f: HeldFeat, after: Dataset, original: Milestone | undefined): Milestone {
  const character = milestoneCharacter(after, f.guid);
  const name = character.name ?? "A character";
  let m: Milestone;
  if (original !== undefined) {
    m = { ...original };
    if (m.kind === "professionCap" && f.fields.title !== undefined) m.title = f.fields.title;
  } else {
    m = { kind: f.kind, character, ...f.fields } as Milestone;
  }
  const profession = m.kind === "professionCap" ? m.profession : undefined;
  const t = featText({ kind: f.kind, fields: f.fields, ...(profession !== undefined ? { profession } : {}) }, name);
  m.text = t.text;
  // WEB-66: the short name and one sentence for the bot's post.
  m.headline = t.title;
  m.line = [t.line, t.flavour].filter((x) => x !== undefined && x !== "").join(". ");
  if (f.firstInGroup) m.firstInGroup = true;
  return m;
}
