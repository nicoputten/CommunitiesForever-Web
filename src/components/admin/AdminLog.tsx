"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { clockDay, clockParts } from "@/core/views/clock";
import { capitalize } from "@/core/views/text";
import type { LogLine } from "@/core/views/admin";
import { CrownIcon } from "@/components/ui/icons";
import styles from "./CoAdmins.module.css";

/** Lines shown before "Show all" (Nico, 2026-10-29). */
const SHOWN = 10;

const subscribe = () => () => {};

/**
 * The admin changes log (WEB-64, board `admin-coadmins`): newest first, under day headings in the viewer's own time
 * zone ("Today", "Yesterday", "Mon 26 Oct"). The server doesn't know the zone, so days and times fill in on hydration.
 */
export function AdminLog({ lines }: { lines: LogLine[] }) {
  const [all, setAll] = useState(false);
  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000) * 60,
    () => undefined,
  );
  if (lines.length === 0) return <p className={styles.empty}>No changes yet.</p>;
  const shown = all ? lines : lines.slice(0, SHOWN);
  const dayOf = (at: number) => {
    if (now === undefined) return "";
    const day = clockDay(at, now);
    return day === "today" || day === "yesterday" ? capitalize(day) : clockParts(at, now).date;
  };
  return (
    <>
      <ol className={styles.log}>
        {shown.map((l, i) => {
          const day = dayOf(l.at);
          return (
            <Fragment key={l.id}>
              {day !== "" && (i === 0 || dayOf(shown[i - 1]!.at) !== day) && (
                <li className={styles.logDay} aria-hidden="true">
                  {day}
                </li>
              )}
              <li className={styles.logLine} data-testid="log-line">
                <span>
                  <b className={l.byOwner ? styles.logOwner : undefined}>{l.who}</b>{" "}
                  {l.parts.map((p, j) => (p.strong === true ? <b key={j}>{p.text}</b> : p.text))}
                  {l.ownerOnly && (
                    <span className={styles.ownerMark}>
                      {" "}
                      <CrownIcon className={styles.crownSmall} />
                      owner
                    </span>
                  )}
                </span>
                <time className={styles.logTime} dateTime={new Date(l.at * 1000).toISOString()}>
                  {now === undefined ? "" : clockParts(l.at, now).time}
                  {day !== "" && <span className="visually-hidden">, {day}</span>}
                </time>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <div className={styles.logFoot}>
        <span className={styles.hint}>Owner and admins see the same log. Nobody can edit or clear it.</span>
        {lines.length > SHOWN && (
          <button type="button" className={styles.cancel} onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? `Show the last ${SHOWN}` : `Show all ${lines.length}`}
          </button>
        )}
      </div>
    </>
  );
}
