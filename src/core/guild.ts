// The bot's Discord server (WEB-46, docs/BOT-API.md "Guild"): the channels and roles it reports, and the Discord page's
// dropdowns built from them. Pure: the report and the stored items come in as arguments.

/** At most this many of each; a Discord server has at most 500 channels and 250 roles. */
export const MAX_CHANNELS = 500;
export const MAX_ROLES = 250;
/** Discord allows 100 characters for channel and role names. */
export const MAX_NAME = 100;

export interface GuildItem {
  /** A Discord snowflake, as text. */
  id: string;
  name: string;
}

export interface GuildReport {
  channels: GuildItem[];
  roles: GuildItem[];
}

const SNOWFLAKE = /^\d{17,20}$/;

/** A name as text only: control characters removed, trimmed, at most MAX_NAME characters; undefined when empty. */
export function cleanGuildName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim())
    .slice(0, MAX_NAME)
    .join("");
  return name === "" ? undefined : name;
}

function items(value: unknown, what: string, max: number): GuildItem[] | string {
  if (!Array.isArray(value)) return `${what} must be a list.`;
  if (value.length > max) return `At most ${max} ${what}.`;
  const out: GuildItem[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const { id, name } = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const clean = cleanGuildName(name);
    if (typeof id !== "string" || !SNOWFLAKE.test(id) || clean === undefined) {
      return `Every one of ${what} needs an id (a snowflake as text) and a name.`;
    }
    if (seen.has(id)) return `${what} lists ${id} twice.`;
    seen.add(id);
    out.push({ id, name: clean });
  }
  return out;
}

/** The body of `POST guild`, or the reason it isn't one (for `400 invalid_request`). */
export function parseGuildReport(body: Record<string, unknown> | undefined): GuildReport | string {
  if (body === undefined) return "Send { channels, roles }.";
  const channels = items(body.channels, "channels", MAX_CHANNELS);
  if (typeof channels === "string") return channels;
  const roles = items(body.roles, "roles", MAX_ROLES);
  if (typeof roles === "string") return roles;
  return { channels, roles };
}

/** A stored channel or role: `present` false when the latest report no longer had it. */
export interface StoredGuildItem extends GuildItem {
  present: boolean;
}

export interface PickOption {
  value: string;
  label: string;
}

/**
 * The options of a channel or role dropdown: "Not set", then the reported ones in the bot's order ("# name",
 * "@name"). A picked one that's gone stays as "(removed: # old-name)" until the admin picks another; one the site
 * never saw as "(removed)". Empty before the bot ever reported, so the dropdown stays disabled.
 */
export function guildOptions(
  kind: "channel" | "role",
  stored: readonly StoredGuildItem[],
  picked: string | null,
  reported: boolean,
  /** The label of "nothing picked": "Not set", or a box's "Default · # doombringers" (WEB-58). */
  unset = "Not set",
): PickOption[] {
  if (!reported) return [];
  const mark = (name: string) => (kind === "channel" ? `# ${name}` : `@${name}`);
  const options: PickOption[] = [{ value: "", label: unset }];
  for (const item of stored) if (item.present) options.push({ value: item.id, label: mark(item.name) });
  if (picked !== null && !options.some((o) => o.value === picked)) {
    const old = stored.find((i) => i.id === picked);
    options.push({ value: picked, label: old === undefined ? "(removed)" : `(removed: ${mark(old.name)})` });
  }
  return options;
}
