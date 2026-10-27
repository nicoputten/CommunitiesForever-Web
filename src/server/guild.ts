import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import type { GuildReport, StoredGuildItem } from "@/core/guild";
import { PICKS } from "@/core/discord";
import type { Db } from "./db";
import { guildItems, guildReports } from "./db/schema";
import { getBotSettings } from "./discord";

// The bot's Discord server in the database (WEB-46, docs/BOT-API.md "Guild"): each report replaces the lists; items it
// no longer has stay, marked gone, only while a setting of the Discord page still names them.

/** Stores the bot's report: its channels and roles replace the earlier ones. */
export function saveGuildReport(db: Db, report: GuildReport, now: number): void {
  db.transaction((tx) => {
    tx.update(guildItems).set({ present: false }).run();
    const put = (kind: "channel" | "role", list: GuildReport["channels"]) =>
      list.forEach((item, position) => {
        const row = { name: item.name, position, present: true };
        tx.insert(guildItems)
          .values({ kind, discordId: item.id, ...row })
          .onConflictDoUpdate({ target: [guildItems.kind, guildItems.discordId], set: row })
          .run();
      });
    put("channel", report.channels);
    put("role", report.roles);
    // Gone and not picked: forgotten. Picked ones keep their last name for "(removed: # old-name)".
    const settings = getBotSettings(tx);
    const picked = PICKS.map((p) => settings[p]).filter((id): id is string => id !== null);
    tx.delete(guildItems)
      .where(and(eq(guildItems.present, false), notInArray(guildItems.discordId, picked)))
      .run();
    tx.insert(guildReports)
      .values({ id: 1, reportedAt: now })
      .onConflictDoUpdate({ target: guildReports.id, set: { reportedAt: now } })
      .run();
  });
}

export interface Guild {
  /** Unix seconds of the latest report; undefined when the bot never reported. */
  reportedAt?: number;
  channels: StoredGuildItem[];
  roles: StoredGuildItem[];
}

/** What the bot last reported, in its order, the gone ones last. */
export function loadGuild(db: Db): Guild {
  const rows = db.select().from(guildItems).orderBy(desc(guildItems.present), asc(guildItems.position)).all();
  const of = (kind: "channel" | "role") =>
    rows.filter((r) => r.kind === kind).map((r) => ({ id: r.discordId, name: r.name, present: r.present }));
  const reportedAt = db.select().from(guildReports).where(eq(guildReports.id, 1)).get()?.reportedAt;
  const guild: Guild = { channels: of("channel"), roles: of("role") };
  if (reportedAt !== undefined) guild.reportedAt = reportedAt;
  return guild;
}
