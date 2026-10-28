"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { askCountdown, type AskCardView } from "@/core/views/runs";
import { AnswerPicker } from "./AnswerPicker";
import styles from "./Asks.module.css";
import runStyles from "./Runs.module.css";

// Asking now (WEB-51, boards asks-now, asks-now-phone, asks-now-states): the open asks above the runs, newest first,
// three and "and N more". Each counts down in the browser (whole minutes, then seconds in the last minute, amber) and
// collapses at 0. While one is open the page refreshes every 30 s for answers from Discord and the game.

/** An ask takes answers this long (the countdown bar's full width). */
const ASK_SECONDS = 600;
const SHOWN = 3;
const REFRESH_MS = 30_000;

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

export function AsksNow({
  asks,
  now,
  frozen = false,
}: {
  asks: AskCardView[];
  /** The server's clock when the page was made (seconds). */
  now: number;
  /** The gallery's fixed states: no ticking, no refresh. */
  frozen?: boolean;
}) {
  const router = useRouter();
  // Seconds since the page was made, so the countdown follows the server's clock.
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (frozen || asks.length === 0) return;
    const start = performance.now();
    const tick = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 1000);
    const refresh = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [frozen, asks, router]);

  const at = now + elapsed;
  // An ask at 0 stays one tick to collapse (no "ended" state); then it's gone.
  const open = asks.filter((a) => a.expiresAt > at - 1);
  if (open.every((a) => a.expiresAt <= at)) return null;
  const shown = expanded ? open : open.slice(0, SHOWN);
  const more = open.length - shown.length;

  return (
    <section className={styles.block} aria-labelledby="asking-now">
      <div className={styles.head}>
        <h2 id="asking-now" className={styles.title}>
          <span className={styles.live} aria-hidden="true" />
          Asking now
        </h2>
        <p className={styles.sub}>Group calls from the game and Discord · each one takes answers for 10 minutes</p>
      </div>
      {shown.map((a) => (
        <AskCard key={a.id} ask={a} left={a.expiresAt - at} />
      ))}
      {more > 0 && (
        <button type="button" className={styles.more} aria-expanded={false} onClick={() => setExpanded(true)}>
          and {more} more ▾
        </button>
      )}
    </section>
  );
}

function AskCard({ ask, left }: { ask: AskCardView; left: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"in" | "maybe" | "cant">();
  const [changing, setChanging] = useState(false);
  const last = left <= 60;
  const pick = ask.picker.characters.find((c) => c.guid === ask.pick?.guid);
  const tone = ask.yours ? "yours" : last ? "last" : undefined;

  const send = async (answer: "in" | "maybe" | "cant") => {
    setBusy(true);
    setFailed(undefined);
    try {
      const res = await fetch(`/api/asks/${ask.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer,
          ...(ask.pick === undefined ? {} : { characterId: ask.pick.guid, role: ask.pick.role }),
        }),
      });
      if (!res.ok) {
        setFailed(answer);
        return;
      }
      setChanging(false);
      router.refresh();
    } catch {
      setFailed(answer);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={styles.ask}
      data-tone={tone}
      data-gone={left <= 0 || undefined}
      aria-hidden={left <= 0 || undefined}
      aria-labelledby={`ask-${ask.id}`}
    >
      <div className={styles.countdown}>
        <span className={styles.endsIn}>ends in</span>
        <b>{askCountdown(left)}</b>
        <span className={styles.bar} aria-hidden="true">
          <i style={{ inlineSize: `${Math.max(0, Math.min(1, left / ASK_SECONDS)) * 100}%` }} />
        </span>
      </div>

      <div className={styles.body}>
        <div className={runStyles.titleRow}>
          <h3 id={`ask-${ask.id}`} className={styles.name}>
            {ask.dungeon}
          </h3>
          <span className={styles.range}>{ask.range}</span>
          {ask.yours && (
            <span className={runStyles.pill} data-tone="yours">
              Your ask
            </span>
          )}
        </div>
        <p className={styles.line}>
          {ask.asker} {ask.yours ? "ask" : "asks"}
          {ask.askerCharacter !== undefined && (
            <>
              {" on "}
              <span style={color(ask.askerCharacter.colorToken)}>{ask.askerCharacter.name}</span> (
              {ask.askerCharacter.role})
            </>
          )}{" "}
          · {ask.from}
        </p>
        {ask.note !== undefined && <p className={styles.note}>“{ask.note}”</p>}
        <p className={styles.line}>
          <b>In</b>{" "}
          {ask.ins.length === 0
            ? "nobody yet"
            : ask.ins.map((p, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <span style={color(p.colorToken)}>{p.name}</span>
                  {[p.level, p.className].filter((x) => x !== undefined).length > 0 &&
                    ` ${[p.level, p.className].filter((x) => x !== undefined).join(" ")}`}
                </span>
              ))}{" "}
          · <b>Maybe</b> {ask.maybe} · <b>Can&apos;t</b> {ask.cant}
        </p>
      </div>

      <div className={styles.actions}>
        {ask.yours ? (
          <p className={styles.formGroup}>
            <b>Form the group in game:</b> the Dungeons tab shows who said I&apos;m in, with Invite all.
          </p>
        ) : ask.answered !== undefined && !changing ? (
          <p className={styles.done}>
            ✓ You answered {ask.answered.answer}
            {ask.answered.character !== undefined && (
              <>
                {" with "}
                <span style={color(ask.answered.colorToken)}>{ask.answered.character}</span>
              </>
            )}
            <button type="button" className={styles.link} onClick={() => setChanging(true)}>
              Change
            </button>
          </p>
        ) : (
          <>
            <div className={styles.buttons} role="group" aria-label={`Answer ${ask.dungeon}`}>
              <button
                type="button"
                className={styles.in}
                disabled={busy || ask.noneFit !== undefined || ask.pick === undefined}
                onClick={() => void send("in")}
              >
                I&apos;m in
              </button>
              <button type="button" className={styles.answer} disabled={busy} onClick={() => void send("maybe")}>
                Maybe
              </button>
              <button type="button" className={styles.answer} disabled={busy} onClick={() => void send("cant")}>
                Can&apos;t
              </button>
            </div>
            {ask.noneFit !== undefined ? (
              <p className={styles.noneFit}>{ask.noneFit} Maybe or Can&apos;t still go.</p>
            ) : (
              pick !== undefined && (
                <p className={styles.as}>
                  as <span style={color(pick.colorToken)}>{pick.name}</span>
                  <span className={runStyles.fitTag} data-fit={pick.fit.kind}>
                    {pick.fit.label}
                  </span>
                  <AnswerPicker
                    view={ask.picker}
                    mode="answer"
                    label="change ▾"
                    className={styles.link}
                    endpoint={`/api/asks/${ask.id}/answer`}
                  />
                </p>
              )
            )}
            {failed !== undefined && (
              <p className={styles.error} role="alert">
                Your answer didn&apos;t go through.
                <button type="button" className={styles.link} onClick={() => void send(failed)}>
                  Retry
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
