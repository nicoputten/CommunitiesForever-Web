import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { BotTokenCard } from "@/components/discord/BotTokenCard";
import { SettingFixed, SettingPick, SettingSwitch } from "@/components/discord/Controls";
import { ChatIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/PageTitle";
import { battleTagName } from "@/core/access";
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
  timeZoneLabel,
} from "@/core/discord";
import { adminBattleTag } from "@/server/access";
import { botTokenStatus } from "@/server/bot";
import { getDb } from "@/server/db";
import {
  discordApp,
  discordNames,
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
  unlinkAction,
} from "./actions";
import styles from "@/components/discord/Discord.module.css";

export const metadata: Metadata = { title: "Discord" };

/** Before the bot reports its server's channels and roles (WEB-38), the dropdowns for them are disabled. */
const NO_CHANNELS = "Start the bot to pick channels";
const NO_ROLES = "Start the bot to pick a role";

/**
 * The Discord page (board `discord-settings-runs`, WEB-39): everyone links their Discord account and sets their time
 * zone; the admin sets what the bot posts, sees who linked and sets up runs. The bot token and the bot's status come
 * with the bot API (WEB-38).
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
  const bot = botStatus(botTokenStatus(db), now);

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.head}>
        <div className={styles.headText}>
          <PageTitle
            sub={`The ${site} bot posts milestones, group asks and the weekly recap, and answers look-ups for linked friends.`}
          >
            Discord
          </PageTitle>
        </div>
        <span className={`${bot.state === "online" ? styles.ok : styles.no} ${styles.status}`} data-testid="bot-status">
          {bot.pill}
        </span>
      </div>

      {notice !== undefined && (
        <p role="status" className={noticeOk(notice) ? styles.noticeOk : styles.notice}>
          {NOTICES[notice]}
        </p>
      )}

      <section aria-labelledby="discord-link" className={styles.link}>
        {link === undefined ? (
          <span className={styles.linkAvatarNone} aria-hidden="true">
            <ChatIcon className={styles.linkIcon} />
          </span>
        ) : (
          <span className={styles.linkAvatar} aria-hidden="true">
            {Array.from(link.discordName)[0]?.toUpperCase()}
          </span>
        )}
        <div className={styles.linkText}>
          <h2 id="discord-link" className={styles.linkTitle}>
            {link === undefined ? "Link your Discord" : "Your Discord is linked"}
          </h2>
          <p className={styles.body}>
            {link === undefined ? (
              <>
                Then the bot knows which characters are yours and answers your commands, like{" "}
                <code className={styles.cmd}>/me</code>. The site only asks Discord for your username.
              </>
            ) : (
              <>
                {link.discordName} on Discord ↔ {viewer.battleTag} · the bot knows which characters are yours, so{" "}
                <code className={styles.cmd}>/me</code> works.
              </>
            )}
          </p>
          {link === undefined && !linking && (
            <p className={styles.small}>Linking isn&apos;t set up on this site yet.</p>
          )}
        </div>
        {link === undefined ? (
          <form action={linkAction}>
            <button type="submit" className={styles.primary} disabled={!linking}>
              Link Discord
            </button>
          </form>
        ) : (
          <form action={unlinkAction}>
            <button type="submit" className={styles.ghost}>
              Unlink
            </button>
          </form>
        )}
      </section>

      {/* Not on the board (decided with Nico, DESIGN.md §11): the time zone the bot reads typed times in. */}
      <section aria-labelledby="discord-zone" className={styles.box}>
        <div className={styles.boxHead}>
          <h2 id="discord-zone" className={styles.boxTitle}>
            Your time zone
          </h2>
          <span className={styles.small}>
            {clockIn(zone, now)} now{ownZone === undefined ? " · not set yet" : ""}
          </span>
        </div>
        <p className={styles.body}>
          Times you type in Discord, like <code className={styles.cmd}>/plan</code> at 20:00, are read in this time
          zone.
          {ownZone === undefined && " Until you pick one, the admin's is used."}
        </p>
        <form action={timeZoneAction} className={styles.zoneForm}>
          <div className={styles.zoneField}>
            <label htmlFor="time-zone" className={styles.label}>
              Time zone
            </label>
            <select id="time-zone" name="timeZone" defaultValue={zone} className={styles.select}>
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {timeZoneLabel(tz, now)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={styles.secondary}>
            Save
          </button>
        </form>
      </section>

      {admin && <AdminSections adminTag={adminTag} bot={bot} />}

      <p className={styles.note}>
        The bot only reads what the site already has. It never posts BattleTags or Discord IDs; posts use display names
        and full character names.
      </p>
    </div>
  );
}

/** What the bot posts, the linked friends and runs: the admin only (the actions check again). */
function AdminSections({ adminTag, bot }: { adminTag: string | undefined; bot: BotStatusView }) {
  const db = getDb();
  const s = getBotSettings(db);
  const friends = linkedFriends(friendBattleTags(db, adminTag), discordNames(db));
  const recapZone = effectiveTimeZone(db, adminTag, adminTag);
  return (
    <>
      {/* Not on the board (decided with Nico, DESIGN.md §11): WEB-38's bot token. */}
      <BotTokenCard
        line={bot.line}
        active={bot.state !== "none"}
        create={createBotTokenAction}
        revoke={revokeBotTokenAction}
      />
      <div className={styles.columns}>
        <section aria-labelledby="discord-posts" className={styles.box}>
          <div className={styles.boxHead}>
            <h2 id="discord-posts" className={styles.boxTitle}>
              What the bot posts
            </h2>
            <span className={styles.small}>Admin only</span>
          </div>
          <ul className={styles.options}>
            <SettingSwitch
              field="milestones"
              on={s.milestones}
              name="Milestones"
              text="Every 10 levels, level 60, profession at cap, new characters"
              action={botSettingAction}
            />
            <SettingSwitch
              field="runs"
              on={s.runs}
              name="Runs"
              text="Planned runs from the site, /plan and the game, plus Ask now when a friend ticks “Also post on Discord”"
              action={botSettingAction}
            />
            <SettingSwitch
              field="recap"
              on={s.recap}
              name="Weekly recap"
              text="Fun stats that change every week"
              action={botSettingAction}
            />
          </ul>
          <div className={styles.picks}>
            <SettingPick
              field="postsChannel"
              label="Channel for posts"
              value={s.postsChannel ?? ""}
              options={[]}
              none={NO_CHANNELS}
              action={botSettingAction}
            />
            <SettingPick
              field="recapChannel"
              label="Recap channel"
              value={s.recapChannel ?? ""}
              options={[]}
              none={NO_CHANNELS}
              action={botSettingAction}
            />
            <SettingPick
              field="recapAt"
              label="Recap time"
              value={`${s.recapDay}|${s.recapTime}`}
              options={DAYS.flatMap((_, day) =>
                RECAP_TIMES.map((time) => ({ value: `${day}|${time}`, label: recapLabel(day, time) })),
              )}
              hint={`In ${recapZone.replace(/_/g, " ")}, the admin's time zone`}
              action={botSettingAction}
            />
            <SettingPick
              field="mentionRole"
              label="Mention on new runs"
              value={s.mentionRole ?? ""}
              options={[]}
              none={NO_ROLES}
              action={botSettingAction}
            />
          </div>
          <div className={styles.buttons}>
            <form action={testPostAction}>
              <button
                type="submit"
                className={styles.secondary}
                disabled={bot.state === "none"}
                title={bot.state === "none" ? "Create a bot token first" : undefined}
              >
                Send a test post
              </button>
            </form>
            <button type="button" className={styles.ghost} disabled title="Comes with the weekly recap">
              Preview next recap
            </button>
          </div>
        </section>

        <section aria-labelledby="discord-friends" className={styles.box}>
          <div className={styles.boxHead}>
            <h2 id="discord-friends" className={styles.boxTitle}>
              Linked friends
            </h2>
            <span className={styles.small}>
              {friends.linked} of {friends.rows.length}
            </span>
          </div>
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
            Friends link themselves after signing in. Unlinked friends still see posts, but the bot won&apos;t answer
            their commands.
          </p>
        </section>
      </div>

      <section aria-labelledby="discord-runs" className={`${styles.box} ${styles.boxRuns}`}>
        <div className={styles.boxHead}>
          <h2 id="discord-runs" className={styles.boxTitle}>
            Runs
          </h2>
          <span className={styles.small}>Admin only · new</span>
        </div>
        <div className={styles.runsGrid}>
          <ul className={styles.options}>
            <SettingSwitch
              field="reminders"
              on={s.reminders}
              name="Reminders"
              text="A message before each run, mentioning only people who answered I'm in or Maybe"
              action={botSettingAction}
            />
            <SettingFixed
              name="“Starting now” group message"
              text="Always posted at start time, mentioning everyone who answered. Organisers can also ping missing friends from the game."
              state="Always on"
            />
            <SettingSwitch
              field="askNow"
              on={s.askNow}
              name="Ask now from the game"
              text="Post it when a friend ticks “Also post on Discord” · expires after 10 min"
              action={botSettingAction}
            />
            <SettingSwitch
              field="markDone"
              on={s.markDone}
              name="Mark runs done from uploads"
              text="“Ran it · 3 of 5 signed-up came”, used in the weekly recap"
              action={botSettingAction}
            />
          </ul>
          <div className={styles.pickList}>
            <SettingPick
              field="runsChannel"
              label="Runs channel"
              value={s.runsChannel ?? ""}
              options={[]}
              none={NO_CHANNELS}
              action={botSettingAction}
            />
            <SettingPick
              field="reminderMinutes"
              label="Reminder time (default for new runs)"
              value={String(s.reminderMinutes)}
              options={REMINDER_MINUTES.map((m) => ({ value: String(m), label: reminderLabel(m) }))}
              hint="Options: 15 min, 30 min, 1 hour, 2 hours. The in-game toast uses the same time."
              action={botSettingAction}
            />
            <div>
              <p className={styles.label}>Can delete any run</p>
              <p className={`${styles.body} ${styles.hint}`}>
                Admin: {adminTag === undefined ? "—" : battleTagName(adminTag)} · everyone else edits and deletes only
                their own
              </p>
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <form action={testRunPostAction}>
            <button
              type="submit"
              className={styles.secondary}
              disabled={bot.state === "none" || !s.runs}
              title={bot.state === "none" ? "Create a bot token first" : !s.runs ? "Run posts are off" : undefined}
            >
              Send a test run post
            </button>
          </form>
          <Link href="/runs/new" className={styles.ghost}>
            See how runs look in Discord
          </Link>
        </div>
      </section>
    </>
  );
}
