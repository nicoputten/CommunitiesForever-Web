// The internal shape every upload is normalized into (docs/SOURCE-DATA.md "Internal shape"). The same shape is
// the merged state of all uploads, so WEB-05 can diff two of them per GUID. Every field the addon may leave out
// is optional; maps are keyed by the addon's keys as strings (GUIDs, BattleTags, skill line IDs, quest IDs).

/** A person: a BattleTag, or "aid:<accountId>" for someone known only through the community (addon CF-28). */
export interface Person {
  key: string;
  battleTag?: string;
  accountId?: string;
  /** Resolved: own display name > BattleTag name part > first character by name (WEB-86) > "Unknown player". */
  displayName: string;
  /** The display name the person set themselves, if any. */
  ownDisplayName?: string;
  /** The uploader (the file's `self`). */
  isUploader: boolean;
  /** False for friends seen only through Battle.net presence: their characters are stubs. */
  hasRecord: boolean;
  /** Record version (Unix seconds, strictly increasing per owner). */
  version?: number;
  /** When the uploader's addon received this record. */
  receivedAt?: number;
  /** BattleTag (or "member:<guid>") of the friend who relayed the record; undefined when it came from the owner. */
  via?: string;
  /** Characters the owner dropped: GUID -> Unix seconds. A copy not newer than this is hidden. */
  removed: Record<string, number>;
}

export interface Profession {
  name?: string;
  rank?: number;
  max?: number;
  /** Addon CF-38 (WEB-90): the profession link's bare `trade:...` payload (no escape sequences), for the game only. */
  link?: string;
  /** CF-38: "short" (a live pointer) or "long" (a link with the recipes inside). */
  linkType?: "short" | "long";
  /** CF-38: the specialisation, when the game API gives one. */
  spec?: string;
  /** CF-38: server time (Unix seconds) the addon last scanned this profession's window. */
  scannedAt?: number;
}

export interface TalentTree {
  name?: string;
  points?: number;
}

export interface Quest {
  title?: string;
  area?: string;
  dungeon?: boolean;
}

/** A character's PvP counters (addon CF-52), each only when the game gave it. */
export interface Pvp {
  /** Lifetime honorable kills. */
  hk?: number;
  /** PvP rank: 0 none, 1 to 14. */
  rank?: number;
  /** The game's name for the rank (per faction). */
  rankName?: string;
  weekKills?: number;
  weekHonor?: number;
  /** Lifetime counters the addon keeps from CF-52 on. */
  deaths?: number;
  duelsWon?: number;
  duelsLost?: number;
}

export interface Character {
  guid: string;
  /** Person key; undefined when nobody is known to own the GUID (a location only). */
  owner?: string;
  /** False for a stub: a GUID seen only in presence or locations, nothing else known. */
  hasRecord: boolean;
  name?: string;
  classFile?: string;
  raceID?: number;
  level?: number;
  faction?: string;
  realm?: string;
  ilvl?: number;
  /** Keyed by skill line ID. */
  professions: Record<string, Profession>;
  /** One per talent tree, in game order. */
  talents: TalentTree[];
  /** 1-based index into talents of the tree with the most points. */
  mainTree?: number;
  mainTreeName?: string;
  role?: string;
  autoRole?: string;
  roleOverride?: string;
  /** Keyed by quest ID. */
  quests: Record<string, Quest>;
  /** CF-52. */
  pvp?: Pvp;
  /** CF-53: the riding skill rank (0, 75 or 150). */
  riding?: number;
  /**
   * Addon CF-38 (WEB-90): the learned recipes of every profession, recipe (spell) ID -> the item it makes (0: none).
   * Complete on each scan. Undefined from addons that don't send it (nothing known, never "none learned"). Friends'
   * copies carry it too once synced; merge takes the copy with the newest `recipesAt`. The addon's `recipeOrder` and
   * `recipesBase` are not read.
   */
  recipes?: Record<string, number>;
  /** CF-38: server time of the last recipe scan. */
  recipesAt?: number;
  /** CF-38, own characters only, where the game API answers: recipe ID -> skill line ID. The database wins. */
  recipeLines?: Record<string, number>;
  updatedAt?: number;
  lastPlayed?: number;
}

/** Last zone a character was seen in, in the community, while the uploader was online. */
export interface Sighting {
  zone: string;
  seenAt: number;
}

/** Battle.net presence link: this GUID was played by this BattleTag. */
export interface PresenceLink {
  battleTag: string;
  lastSeen: number;
}

export interface Dataset {
  schemaVersion: number;
  /** Version of the uploader's own record when the file was written. */
  version?: number;
  /** Person key of the uploader. */
  uploader?: string;
  community: { id?: string; name?: string };
  people: Record<string, Person>;
  characters: Record<string, Character>;
  locations: Record<string, Sighting>;
  presence: Record<string, PresenceLink>;
}
