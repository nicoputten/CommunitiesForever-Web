import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { BotTokenCard } from "@/components/discord/BotTokenCard";
import { SettingFixed, SettingPick, SettingSwitch } from "@/components/discord/Controls";
import { ResetTime, UseBrowserZone } from "@/components/discord/Doomsday";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageTitle } from "@/components/ui/PageTitle";
import { battleTagName } from "@/core/access";
import { guildOptions } from "@/core/guild";
import { effectiveFrom, zoneOffset } from "@/core/doomsday/engine";
import { dayLabel } from "@/core/doomsday/rules";
import {
  botStatus,
  type BotStatusView,
  clockIn,
  DAYS,
  linkedFriends,
  NOTICES,
  noticeOk,
  parseNotice,
  RECAP_TIMES,
  recapLabel,
  REMINDER_MINUTES,
  reminderLabel,
  resetLabel,
  timeZoneOptions,
} from "@/core/discord";
import { adminBattleTag } from "@/server/access";
import { botTokenStatus } from "@/server/bot";
import { getDb } from "@/server/db";
import { loadGuild } from "@/server/guild";
import {
  discordApp,
  discordNames,
  doomsdayResetSetting,
  effectiveTimeZone,
  friendBattleTags,
  getBotSettings,
  linkFor,
  TIME_ZONES,
  timeZoneFor,
} from "@/server/discord";
import {
  botSettingAction,
  createBotTokenAction,
  linkAction,
  revokeBotTokenAction,
  testPostAction,
  testRunPostAction,
  timeZoneAction,
  undoResetAction,
  unlinkAction,
} from "./actions";
import styles from "@/components/discord/Discord.module.css";

export const metadata: Metadata = { title: "Discord" };

/** Before the bot first reports its server's channels and roles (WEB-46), the dropdowns for them are disabled. */
const NO_CHANNELS = "No channels yet";
const NO_ROLES = "No roles yet";
const WAITING = "Waiting for the bot to report its channels";
const NO_TOKEN = "Create a bot token first";

/** The page's sections, for the jump bar: friends see the first two (board `discord-page`, WEB-58). */
const SECTIONS: { id: string; label: string; short: string; admin: boolean }[] = [
  // The board's "You" on a phone would not be part of the link's name (axe label-content-name-mismatch).
  { id: "you-link", label: "Your Discord", short: "Discord", admin: false },
  { id: "you-tz", label: "Time zone", short: "Time zone", admin: false },
  { id: "bot", label: "The bot", short: "Bot", admin: true },
  { id: "feats", label: "Feats", short: "Feats", admin: true },
  { id: "runs", label: "Runs", short: "Runs", admin: true },
  { id: "recap", label: "Weekly recap", short: "Recap", admin: true },
  { id: "doomsday", label: "Doomsday", short: "Doomsday", admin: true },
  { id: "friends", label: "Linked friends", short: "Friends", admin: true },
];

/**
 * The Discord page, reorganised (boards `discord-page`, `-map`, `-friend`, `-states`, `-phone`; WEB-58): "For you"
 * (every friend: their Discord link and time zone), then "For the group" (the admin): the bot, then one box per kind
 * of post (Feats, Weekly recap, Runs, Doomsday), each with its own switch, channel, timing and test post, and the
 * linked friends last. `discord-page-map` lists where each of the 20 earlier settings went.
 */
export default async function DiscordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (viewer === undefined) notFound();
  const params = await searchParams;
  const notice = parseNotice(params.notice);
  const now = nowSeconds();
  const db = getDb();
  const site = getSiteInfo().name;
  const link = linkFor(db, viewer.battleTag);
  const linking = discordApp() !== undefined;
  const ownZone = timeZoneFor(db, viewer.battleTag);
  const zone = effectiveTimeZone(db, viewer.battleTag);
  const admin = viewer.role === "admin";
  const adminTag = adminBattleTag();
  const adminName = adminTag === undefined ? "the admin" : battleTagName(adminTag);

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.head}>
        <div className={styles.headText}>
          <PageTitle
            sub={
              admin
                ? `The ${site} bot posts feats, runs, the weekly recap and Doomsday, and answers look-ups for linked friends.`
                : `Link your Discord so the ${site} bot knows your characters. Bot settings are for the admin.`
            }
          >
            Discord
          </PageTitle>
        </div>
      </div>

      <nav className={styles.jump} aria-label="On this page">
        {SECTIONS.filter((s) => admin || !s.admin).map((s, i, shown) => (
          <span key={s.id} className={styles.jumpItem}>
            {i > 0 && s.admin && !shown[i - 1]!.admin && <span className={styles.jumpSep} aria-hidden="true" />}
            {/* The full name for everyone; a phone shows the short one (board `discord-page-phone`). */}
            <a href={`#${s.id}`} className={styles.jumpLink} aria-label={s.label}>
              <span className={styles.jumpLong} aria-hidden="true">
                {s.label}
              </span>
              <span className={styles.jumpShort} aria-hidden="true">
                {s.short}
              </span>
            </a>
          </span>
        ))}
      </nav>

      {notice !== undefined && (
        <p role="status" className={noticeOk(notice) ? styles.noticeOk : styles.notice}>
          {NOTICES[notice]}
        </p>
      )}

      <Section title="For you" note="every friend sees this part" />
      <div className={styles.grid2}>
        <section id="you-link" aria-labelledby="discord-link" className={`${styles.box} ${styles.boxLink}`}>
          <BoxHead id="discord-link" title="Your Discord" />
          {link === undefined ? (
            <>
              <p className={styles.body}>
                Link once so the bot knows which characters are yours. Then <code className={styles.cmd}>/me</code>,{" "}
                <code className={styles.cmd}>/doomsday</code> and run sign-ups work for you in Discord.
              </p>
              {!linking && <p className={styles.small}>Linking isn&apos;t set up on this site yet.</p>}
              <form action={linkAction}>
                <button type="submit" className={styles.primary} disabled={!linking}>
                  Link your Discord
                </button>
              </form>
            </>
          ) : (
            <>
              <div className={styles.linked}>
                <span className={styles.linkAvatar} aria-hidden="true">
                  {Array.from(link.discordName)[0]?.toUpperCase()}
                </span>
                <span className={styles.linkedText}>
                  <span className={styles.linkTitle}>Linked as {link.discordName}</span>
                  <span className={styles.small}>
                    The bot knows which characters are yours, so <code className={styles.cmd}>/me</code> works.
                  </span>
                </span>
              </div>
              <form action={unlinkAction}>
                <button type="submit" className={styles.ghost}>
                  Unlink
                </button>
              </form>
            </>
          )}
        </section>

        <section id="you-tz" aria-labelledby="discord-zone" className={styles.box}>
          <BoxHead id="discord-zone" title="Your time zone" />
          <form action={timeZoneAction} className={styles.zoneForm}>
            <div className={styles.zoneField}>
              <label htmlFor="time-zone" className={styles.label}>
                Your time zone
              </label>
              <Dropdown
                id="time-zone"
                name="timeZone"
                defaultValue={zone}
                className={styles.pick}
                options={timeZoneOptions(TIME_ZONES, now)}
              />
            </div>
            <button type="submit" className={styles.secondary}>
              Save
            </button>
          </form>
          <p className={styles.small}>
            {ownZone === undefined ? (
              <>
                Not set · using {adminName}&apos;s ({zone.replace(/_/g, " ")}). Until you pick one, times you type are
                read in {adminName}&apos;s time zone.
              </>
            ) : (
              <>
                {zone.replace(/_/g, " ")} · {clockIn(zone, now)} now. When you type{" "}
                <code className={styles.cmd}>/plan 20:00</code>, the bot reads 20:00 in this time zone. Everyone sees
                runs in their own time.
              </>
            )}
          </p>
          {ownZone === undefined && <UseBrowserZone current={zone} action={timeZoneAction} />}
        </section>
      </div>

      {admin ? (
        <AdminSections adminTag={adminTag} now={now} />
      ) : (
        <p className={styles.adminNote}>
          What the bot posts, where and when is set by the admin ({adminName}). Ask them if you want a post somewhere
          else.
        </p>
      )}

      <p className={styles.note}>
        Posts use display names and full character names, never BattleTags or Discord IDs.
        {admin && " Only the admin's Linked friends list shows them."}
      </p>
    </div>
  );
}

function Section({ title, note }: { title: string; note: string }) {
  return (
    <div className={styles.sect}>
      <h2 className={styles.sectTitle}>{title}</h2>
      <span className={styles.sectLine} aria-hidden="true" />
      <span className={styles.sectNote}>{note}</span>
    </div>
  );
}

function BoxHead({ id, title, children }: { id: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.boxHead}>
      <h3 id={id} className={styles.boxTitle}>
        {title}
      </h3>
      {children !== undefined && <div className={styles.boxTags}>{children}</div>}
    </div>
  );
}

function AdminOnly() {
  return <span className={styles.adminTag}>Admin only</span>;
}

/** A box's test post: disabled with the reason next to it, never hidden (board `discord-page-states`). */
function TestButton({ kind, label, reason }: { kind: string; label: string; reason?: string }) {
  return (
    <form action={testPostAction} className={styles.test}>
      <input type="hidden" name="kind" value={kind} />
      <button type="submit" className={styles.secondary} disabled={reason !== undefined}>
        {label}
      </button>
      {reason !== undefined && <span className={styles.small}>{reason}</span>}
    </form>
  );
}

/** "For the group": the bot and one box per kind of post. The admin only (the actions check again). */
function AdminSections({ adminTag, now }: { adminTag: string | undefined; now: number }) {
  const db = getDb();
  const s = getBotSettings(db);
  const bot: BotStatusView = botStatus(botTokenStatus(db), now);
  const noToken = bot.state === "none" ? NO_TOKEN : undefined;
  // The bot's channels and roles (WEB-46).
  const guild = loadGuild(db);
  const reported = guild.reportedAt !== undefined;
  const present = guild.channels.filter((c) => c.present);
  const defaultName = present.find((c) => c.id === s.postsChannel)?.name;
  const unset = defaultName !== undefined ? `Default · # ${defaultName}` : "Default · not set";
  const channels = (picked: string | null) => guildOptions("channel", guild.channels, picked, reported);
  const boxChannels = (picked: string | null) => guildOptions("channel", guild.channels, picked, reported, unset);
  const roles = (picked: string | null) => guildOptions("role", guild.roles, picked, reported);
  const waiting = reported ? undefined : WAITING;
  const friends = linkedFriends(friendBattleTags(db, adminTag), discordNames(db));
  const recapZone = effectiveTimeZone(db, adminTag, adminTag);

  // A reset change waiting for the next reset (board `discord-page-states` 4).
  const setting = doomsdayResetSetting(s);
  const from = effectiveFrom(setting, s.realmTimeZone);
  const waitingReset = setting.previous !== undefined && now < from;
  const realmNow = clockIn(s.realmTimeZone, now);
  // "Wed": the realm's weekday of the reset the change takes effect at.
  const nextResetDay = dayLabel(Math.floor((from + zoneOffset(s.realmTimeZone, from)) / 86400)).split(" ")[0];

  return (
    <>
      <Section
        title="For the group"
        note="admin only · one box per kind of post, each with its own switch, channel and timing"
      />

      <section id="bot" aria-labelledby="discord-bot" className={styles.box}>
        <BoxHead id="discord-bot" title="The bot">
          <span
            className={`${bot.state === "online" ? styles.ok : styles.no} ${styles.status}`}
            data-testid="bot-status"
          >
            {bot.state === "online" && reported
              ? `● Online · the bot sees ${present.length} text channel${present.length === 1 ? "" : "s"}`
              : bot.pill}
          </span>
          <AdminOnly />
        </BoxHead>
        <BotTokenCard
          line={bot.line}
          active={bot.state !== "none"}
          create={createBotTokenAction}
          revoke={revokeBotTokenAction}
        />
        <div className={styles.grid2}>
          <SettingPick
            field="postsChannel"
            label="Default channel"
            value={s.postsChannel ?? ""}
            options={channels(s.postsChannel)}
            none={NO_CHANNELS}
            hint={
              reported
                ? "Feats go here, and every kind of post that has no channel of its own."
                : "The bot hasn't told us its channels yet. They appear here a minute after it comes online."
            }
            action={botSettingAction}
          />
          <div>
            <p className={styles.label}>Server</p>
            <p className={styles.caption}>
              {reported
                ? `The bot sees ${present.length} text channel${present.length === 1 ? "" : "s"}`
                : "Not reported yet"}
            </p>
          </div>
        </div>
      </section>

      <div className={styles.grid2}>
        <section id="feats" aria-labelledby="discord-feats" className={styles.box}>
          <BoxHead id="discord-feats" title="Feats">
            <AdminOnly />
          </BoxHead>
          <p className={styles.lead}>Renamed from Milestones: every milestone is a feat now.</p>
          <ul className={styles.options}>
            <SettingSwitch
              field="milestones"
              on={s.milestones}
              name="Post feats"
              text="After each upload, one post per friend with everything new: rank titles, levels, epics, mounts, professions, firsts in the group"
              action={botSettingAction}
            />
          </ul>
          <SettingPick
            field="featsChannel"
            label="Feats channel"
            value={s.featsChannel ?? ""}
            options={boxChannels(s.featsChannel)}
            none={NO_CHANNELS}
            {...(waiting !== undefined ? { hint: waiting } : {})}
            action={botSettingAction}
          />
          <div className={styles.buttons}>
            <TestButton kind="feats" label="Send a test feat" {...(noToken ? { reason: noToken } : {})} />
          </div>
        </section>

        <section id="recap" aria-labelledby="discord-recap" className={styles.box}>
          <BoxHead id="discord-recap" title="Weekly recap">
            <AdminOnly />
          </BoxHead>
          <ul className={styles.options}>
            <SettingSwitch
              field="recap"
              on={s.recap}
              name="Post the weekly recap"
              text="Fun stats that change every week, plus a Doomsday section when Doomsday is on"
              action={botSettingAction}
            />
          </ul>
          <div className={styles.grid2}>
            <SettingPick
              field="recapChannel"
              label="Recap channel"
              value={s.recapChannel ?? ""}
              options={boxChannels(s.recapChannel)}
              none={NO_CHANNELS}
              action={botSettingAction}
            />
            <SettingPick
              field="recapAt"
              label="Day and time"
              value={`${s.recapDay}|${s.recapTime}`}
              options={DAYS.flatMap((_, day) =>
                RECAP_TIMES.map((time) => ({ value: `${day}|${time}`, label: recapLabel(day, time) })),
              )}
              hint={`In your time zone (${recapZone.replace(/_/g, " ")})`}
              action={botSettingAction}
            />
          </div>
          <div className={styles.buttons}>
            <TestButton kind="recap" label="Send a test recap" {...(noToken ? { reason: noToken } : {})} />
            <Link href="/discord/recap" className={styles.ghost}>
              Preview next recap
            </Link>
          </div>
        </section>
      </div>

      <section id="runs" aria-labelledby="discord-runs" className={styles.box}>
        <BoxHead id="discord-runs" title="Runs">
          <AdminOnly />
        </BoxHead>
        <div className={styles.grid2}>
          <ul className={styles.options}>
            <SettingSwitch
              field="runs"
              on={s.runs}
              name="Post runs"
              text="Planned runs from the site, /plan and the game"
              action={botSettingAction}
            />
            <SettingSwitch
              field="askNow"
              on={s.askNow}
              name="Ask now from the game"
              text="When a friend ticks “Also post on Discord” · expires after 10 min"
              action={botSettingAction}
            />
            <SettingSwitch
              field="reminders"
              on={s.reminders}
              name="Reminders"
              text="Before each run, mentioning only people who said I'm in or Maybe"
              action={botSettingAction}
            />
            <SettingFixed
              name="“Starting now” message"
              text="Posted at start time, mentioning everyone who answered"
              state="Always on"
            />
            <SettingSwitch
              field="markDone"
              on={s.markDone}
              name="Mark runs done from uploads"
              text="“Ran it · 3 of 5 came”, used in the weekly recap"
              action={botSettingAction}
            />
          </ul>
          <div className={styles.pickList}>
            <SettingPick
              field="runsChannel"
              label="Runs channel"
              value={s.runsChannel ?? ""}
              options={boxChannels(s.runsChannel)}
              none={NO_CHANNELS}
              {...(waiting !== undefined ? { hint: waiting } : {})}
              action={botSettingAction}
            />
            <SettingPick
              field="mentionRole"
              label="Mention on new runs"
              value={s.mentionRole ?? ""}
              options={roles(s.mentionRole)}
              none={NO_ROLES}
              hint={reported ? "Moved here from “What the bot posts”" : "Roles arrive with the channels"}
              action={botSettingAction}
            />
            <SettingPick
              field="reminderMinutes"
              label="Reminder time"
              value={String(s.reminderMinutes)}
              options={REMINDER_MINUTES.map((m) => ({ value: String(m), label: reminderLabel(m) }))}
              hint="15 min, 30 min, 1 hour or 2 hours. The in-game toast uses the same time."
              action={botSettingAction}
            />
            <div>
              <p className={styles.label}>Can delete any run</p>
              <p className={styles.caption}>
                Admin: {adminTag === undefined ? "—" : battleTagName(adminTag)} · everyone else only their own
              </p>
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <form action={testRunPostAction} className={styles.test}>
            <button type="submit" className={styles.secondary} disabled={noToken !== undefined || !s.runs}>
              Send a test run post
            </button>
            {(noToken !== undefined || !s.runs) && (
              <span className={styles.small}>{noToken ?? "Run posts are off"}</span>
            )}
          </form>
          <Link href="/runs/new" className={styles.ghost}>
            See how runs look in Discord
          </Link>
        </div>
      </section>

      <section id="doomsday" aria-labelledby="discord-doomsday" className={`${styles.box} ${styles.boxDoomsday}`}>
        <BoxHead
          id="discord-doomsday"
          title={
            <>
              Doomsday<span className={styles.newTag}>new</span>
            </>
          }
        >
          <AdminOnly />
        </BoxHead>
        <p className={styles.lead}>
          Daily and weekly goals. The board is posted at every reset and edited as uploads come in; the ladder goes out
          on Sunday at the reset.
        </p>
        <div className={styles.grid2}>
          <div>
            <ul className={styles.options}>
              <SettingSwitch
                field="doomsdayBoard"
                on={s.doomsdayBoard}
                name="Daily board"
                text="Today's goals and every friend's row, kept up to date, closed with a summary at the next reset"
                action={botSettingAction}
              />
              <SettingSwitch
                field="doomsdayLadder"
                on={s.doomsdayLadder}
                name="Weekly ladder"
                text="Top 5 PvE and top 5 PvP, side by side, on Sunday at the reset"
                action={botSettingAction}
              />
            </ul>
            <div className={styles.pickList}>
              <SettingPick
                field="doomsdayChannel"
                label="Doomsday channel"
                value={s.doomsdayChannel ?? ""}
                options={boxChannels(s.doomsdayChannel)}
                none={NO_CHANNELS}
                {...(waiting !== undefined ? { hint: waiting } : {})}
                action={botSettingAction}
              />
            </div>
          </div>
          <div className={styles.pickList}>
            <div>
              <p className={styles.label} id="reset-label">
                Reset time · realm time
              </p>
              <ResetTime key={s.doomsdayReset} value={resetLabel(s.doomsdayReset)} action={botSettingAction} />
              {waitingReset ? (
                <div className={styles.waiting}>
                  <p className={styles.waitingText}>
                    From the next reset: {nextResetDay} {resetLabel(s.doomsdayReset)}
                  </p>
                  <p className={styles.small}>
                    Today still ends at {resetLabel(setting.previous!)}, so nobody loses a half-done day.
                  </p>
                  <form action={undoResetAction}>
                    <button type="submit" className={styles.ghost}>
                      Undo
                    </button>
                  </form>
                </div>
              ) : (
                <p className={`${styles.small} ${styles.hint}`}>
                  A change counts from the next reset, never mid-day. The addon gets it with the next upload.
                </p>
              )}
            </div>
            <SettingPick
              field="realmTimeZone"
              label="Realm time zone"
              value={s.realmTimeZone}
              options={timeZoneOptions(TIME_ZONES, now)}
              hint={`${realmNow} realm time. The realm's clock: the reset is in this time, for everyone.`}
              action={botSettingAction}
            />
          </div>
        </div>
        <div className={styles.buttons}>
          <TestButton kind="doomsday" label="Send a test board" {...(noToken ? { reason: noToken } : {})} />
          <Link href="/doomsday" className={styles.ghost}>
            Open the Doomsday page
          </Link>
        </div>
      </section>

      <section id="friends" aria-labelledby="discord-friends" className={styles.box}>
        <BoxHead id="discord-friends" title="Linked friends">
          <span className={styles.small}>
            {friends.linked} of {friends.rows.length}
          </span>
          <AdminOnly />
        </BoxHead>
        <ul className={styles.friends}>
          {friends.rows.map((f) => (
            <li key={f.battleTag} className={styles.friend} data-testid="linked-friend">
              <span className={styles.friendDisc} aria-hidden="true">
                {Array.from(f.battleTag)[0]?.toUpperCase()}
              </span>
              <span className={styles.friendTag}>{f.battleTag}</span>
              {f.discordName === undefined ? (
                <span className={styles.friendNone}>
                  <span aria-hidden="true">—</span>
                  <span className="visually-hidden">No Discord</span>
                </span>
              ) : (
                <span className={styles.friendName}>{f.discordName}</span>
              )}
              <span className={f.discordName === undefined ? styles.no : styles.ok}>
                {f.discordName === undefined ? "Not linked" : "Linked"}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.small}>
          Read only. Friends link themselves after signing in. Unlinked friends still see posts, but the bot won&apos;t
          answer their commands.
        </p>
      </section>
    </>
  );
}
