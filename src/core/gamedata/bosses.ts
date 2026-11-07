// The hand-made part of the dungeon boss list (WEB-96): which boss ends each dungeon (final), which bosses don't count
// towards "N of M" (optional), which wing of Scarlet Monastery, Blackrock Spire, Stratholme or Dire Maul each boss is
// in (the client has one map for each), and encounters whose
// loot comes from other creatures than the one named like it. Everything else (the bosses, their order, their IDs)
// comes from the Forever client's DungeonEncounter table (src/core/recipes/bosses.ts). Names are the client's
// encounter names (DungeonEncounter.Name_lang, English client).
//
// Sources (rule 10), warcraft.wiki.gg, read 2026-11-07:
// - final: each dungeon's "End boss" (infobox) or the text naming the last boss: "Ragefire Chasm (Classic)",
//   "Wailing Caverns", "Deadmines (Classic)", "Shadowfang Keep (Classic)", "Blackfathom Deeps (Classic)",
//   "Razorfen Kraul", "Scarlet Monastery Graveyard", "Scarlet Monastery Library", "Scarlet Monastery Cathedral",
//   "Razorfen Downs", "Uldaman", "Zul'Farrak", "Maraudon", "Sunken Temple", "Blackrock Depths" (Upper City "ending with
//   Emperor Thaurissan"), "Lower Blackrock Spire", "Scholomance (Classic)". The Stockade and Gnomeregan: the last
//   boss the client lists (no Classic page; the current pages describe the remade dungeons).
// - Stratholme and Dire Maul are split into wings (Nico, 2026-11-07), each with its own end boss: "Stratholme
//   (Classic)" ("End boss: Balnazzar (Main Gate), Baron Rivendare (Service Entrance)"), "Dire Maul East" (Alzzin the
//   Wildshaper), "Dire Maul West" (Prince Tortheldrin), "Dire Maul North" (King Gordok).
// - optional: only bosses the wiki calls optional, a bonus boss, rare, summoned or triggered: Wailing Caverns (Kresh
//   "not necessary to complete the instance", Skum "optional", "Killing Verdan is optional"), Deadmines ("The other
//   boss is optional": Cookie; Miner Johnson "Rare"), Maraudon (Rotgrip "the bonus boss"), Sunken Temple (Avatar of
//   Hakkar "an optional boss"), Stratholme (Classic) (Skul, Hearthsinger Forresten and Stonespine rare; Postmaster
//   Malown, Ezra Grimm and Black Guard Swordsmith summoned; Crimson Hammersmith triggered), Dire Maul West (Tsu'zee
//   rare), "Lord Hel'nurath" (warlocks "had to summon one of his dreadsteeds in Dire Maul West").
// - wings: "Scarlet Monastery Library" (Classic bosses per wing), "Lower Blackrock Spire" (its bosses); Upper
//   Blackrock Spire: the client's bosses after Overlord Wyrmthalak. "Stratholme (Classic)" (the infobox's Main Gate and
//   Service Entrance boss lists; Ezra Grimm and Crimson Hammersmith triggered on the Scarlet side, Black Guard
//   Swordsmith on the Undead side), "Dire Maul East", "Dire Maul West", "Dire Maul North" (each page's boss list) and
//   "Lord Hel'nurath" (Dire Maul West).
// - together: "Scarlet Monastery Cathedral": Mograine and Whitemane "are fought at the same time"; "Uldaman": The
//   Lost Dwarves are Baelog, Eric and Olaf (cmangos' names). Blackrock Depths' Ring of Law (a random challenger), The
//   Vault and The Seven (their loot is a chest) get no loot, nor does Stratholme's Ezra Grimm (not in cmangos).
// Forever's own dungeons: no source yet. Their final is the last boss the client lists, none optional.

export interface DungeonBossNotes {
  /** The encounter that ends the dungeon (or each wing, keyed by the wing's id). */
  final?: string;
  optional?: readonly string[];
  /** Wing id (src/core/gamedata/dungeons.ts) -> its encounters. */
  wings?: Readonly<Record<string, readonly string[]>>;
  /** Per wing: the final encounter. */
  finals?: Readonly<Record<string, string>>;
}

/** Keyed by the site's dungeon id (src/core/gamedata/dungeons.ts). */
export const BOSS_NOTES: Readonly<Record<string, DungeonBossNotes>> = {
  rfc: { final: "Bazzalan" },
  wc: { final: "Mutanus the Devourer", optional: ["Kresh", "Skum", "Verdan the Everliving"] },
  dm: { final: "Edwin VanCleef", optional: ["Cookie", "Miner Johnson"] },
  sfk: { final: "Archmage Arugal" },
  bfd: { final: "Aku'mai" },
  stocks: { final: "Bazil Thredd" },
  gnomer: { final: "Mekgineer Thermaplugg" },
  rfk: { final: "Charlga Razorflank" },
  sm: {
    wings: {
      graveyard: ["Interrogator Vishas", "Bloodmage Thalnos"],
      library: ["Houndmaster Loksey", "Arcanist Doan"],
      armory: ["Herod"],
      cathedral: ["High Inquisitor Fairbanks", "High Inquisitor Whitemane"],
    },
    finals: {
      graveyard: "Bloodmage Thalnos",
      library: "Arcanist Doan",
      armory: "Herod",
      cathedral: "High Inquisitor Whitemane",
    },
  },
  rfd: { final: "Amnennar the Coldbringer" },
  ulda: { final: "Archaedas" },
  zf: { final: "Chief Ukorz Sandscalp" },
  mara: { final: "Princess Theradras", optional: ["Rotgrip"] },
  st: { final: "Shade of Eranikus", optional: ["Avatar of Hakkar"] },
  brd: { final: "Emperor Dagran Thaurissan" },
  brs: {
    wings: {
      lower: [
        "Highlord Omokk",
        "Shadow Hunter Vosh'gajin",
        "War Master Voone",
        "Mother Smolderweb",
        "Urok Doomhowl",
        "Quartermaster Zigris",
        "Halycon",
        "Gizrul the Slavener",
        "Overlord Wyrmthalak",
      ],
      upper: ["Pyroguard Emberseer", "Warchief Rend Blackhand", "The Beast", "General Drakkisath", "Lord Valthalak"],
    },
    finals: { lower: "Overlord Wyrmthalak", upper: "General Drakkisath" },
  },
  dme: {
    wings: {
      east: ["Zevrim Thornhoof", "Hydrospawn", "Lethtendris", "Pusillin", "Alzzin the Wildshaper"],
      west: [
        "Tendris Warpwood",
        "Illyanna Ravenoak",
        "Magister Kalendris",
        "Immol'thar",
        "Prince Tortheldrin",
        "Lord Hel'nurath",
        "Tsu'zee",
      ],
      north: [
        "Guard Mol'dar",
        "Stomper Kreeg",
        "Guard Fengus",
        "Guard Slip'kik",
        "Captain Kromcrush",
        "Cho'Rush the Observer",
        "King Gordok",
      ],
    },
    finals: { east: "Alzzin the Wildshaper", west: "Prince Tortheldrin", north: "King Gordok" },
    optional: ["Lord Hel'nurath", "Tsu'zee"],
  },
  scholo: { final: "Darkmaster Gandling" },
  strat: {
    wings: {
      live: [
        "Hearthsinger Forresten",
        "Timmy the Cruel",
        "Malor the Zealous",
        "Cannon Master Willey",
        "Archivist Galford",
        "Balnazzar",
        "The Unforgiven",
        "Skul",
        "Postmaster Malown",
        "Crimson Hammersmith",
        "Ezra Grimm",
      ],
      undead: [
        "Baroness Anastari",
        "Nerub'enkan",
        "Maleki the Pallid",
        "Magistrate Barthilas",
        "Ramstein the Gorger",
        "Baron Rivendare",
        "Black Guard Swordsmith",
        "Stonespine",
      ],
    },
    finals: { live: "Balnazzar", undead: "Baron Rivendare" },
    optional: [
      "Skul",
      "Hearthsinger Forresten",
      "Stonespine",
      "Postmaster Malown",
      "Ezra Grimm",
      "Black Guard Swordsmith",
      "Crimson Hammersmith",
    ],
  },
};

/**
 * Encounters whose loot is in other creatures' tables (cmangos creature_template names): fought together, or an
 * encounter named after a group. Sources above ("together"); the encounter's own creature is matched as well.
 */
export const ENCOUNTER_CREATURES: Readonly<Record<string, readonly string[]>> = {
  "High Inquisitor Whitemane": ["High Inquisitor Whitemane", "Scarlet Commander Mograine"],
  "The Lost Dwarves": ["Baelog", 'Eric "The Swift"', "Olaf"],
  // The client and cmangos spell these differently.
  Geilhast: ["Gelihast"],
  Kirtonos: ["Kirtonos the Herald"],
  "Ras Frostwhisperer": ["Ras Frostwhisper"],
};
