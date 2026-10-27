"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import type { Answer } from "@/core/runs";
import type { AnswerChoice } from "@/core/views/runs";
import styles from "./Runs.module.css";

const LABELS: Record<"in" | "maybe" | "cant", string> = { in: "I'm in", maybe: "Maybe", cant: "Can't" };
const ORDER = ["in", "maybe", "cant"] as const;

interface Pending {
  answer: Answer;
  guid?: string;
}

// An answer that didn't go through is kept on this phone and sent again (runs-phone board, WEB-40).
const key = (runId: number) => `cf-run-answer-${runId}`;

function readPending(runId: number): Pending | undefined {
  try {
    const raw = window.localStorage.getItem(key(runId));
    return raw === null ? undefined : (JSON.parse(raw) as Pending);
  } catch {
    return undefined;
  }
}

function writePending(runId: number, pending: Pending | undefined): void {
  try {
    if (pending === undefined) window.localStorage.removeItem(key(runId));
    else window.localStorage.setItem(key(runId), JSON.stringify(pending));
  } catch {
    // Storage off (private window): the retry line still shows until the page is left.
  }
}

/** I'm in / Maybe / Can't with the character to answer with (WEB-40). I'm in is off without a character in range. */
export function AnswerButtons({
  choice,
  size = "normal",
  label,
}: {
  choice: AnswerChoice;
  size?: "small" | "normal";
  /** The group's accessible name, e.g. "Answer for Razorfen Kraul". */
  label: string;
}) {
  const router = useRouter();
  const inRange = choice.characters.filter((c) => c.fits);
  const [guid, setGuid] = useState(choice.current?.guid ?? inRange[0]?.guid ?? choice.characters[0]?.guid ?? "");
  const [chosen, setChosen] = useState<Answer | undefined>(choice.current?.answer);
  const [failed, setFailed] = useState<Pending>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const fits = choice.characters.find((c) => c.guid === guid)?.fits === true;

  const send = async (pending: Pending) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const res = await fetch(`/api/runs/${choice.runId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pending),
      });
      if (res.status >= 500) throw new Error(String(res.status));
      writePending(choice.runId, undefined);
      setFailed(undefined);
      const body = (await res.json()) as { error?: string; stored?: { answer: Answer; waitlisted: boolean } };
      if (!res.ok) {
        setMessage(body.error ?? "That didn't work.");
        setChosen(choice.current?.answer);
      } else {
        setChosen(body.stored?.answer);
        if (body.stored?.waitlisted) setMessage("That role is full: you're Maybe, first in line.");
        router.refresh();
      }
    } catch {
      writePending(choice.runId, pending);
      setFailed(pending);
    } finally {
      setBusy(false);
    }
  };
  const sendKept = useEffectEvent((kept: Pending) => void send(kept));

  // A kept answer from an earlier visit, or when the phone is back online.
  useEffect(() => {
    const retry = () => {
      const kept = readPending(choice.runId);
      if (kept !== undefined) sendKept(kept);
    };
    // After this render, not during it.
    const timer = window.setTimeout(retry, 0);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [choice.runId]);

  const answer = (a: Answer) => {
    const pending: Pending = guid === "" ? { answer: a } : { answer: a, guid };
    setChosen(a);
    void send(pending);
  };

  return (
    <div className={styles.answer}>
      {size === "normal" && choice.characters.length > 0 && (
        <select
          className={styles.select}
          aria-label="Answer with"
          value={guid}
          onChange={(e) => setGuid(e.target.value)}
          disabled={!choice.open}
        >
          {choice.characters.map((c) => (
            <option key={c.guid} value={c.guid}>
              {c.name}
              {c.level === undefined ? "" : ` ${c.level}`}
              {c.fits ? ` · ${c.role}` : ` · ${c.off ?? "out of range"}`}
            </option>
          ))}
        </select>
      )}
      <div role="group" aria-label={label} className={styles.answerButtons} data-size={size}>
        {ORDER.map((a) => (
          <button
            key={a}
            type="button"
            className={a === "in" ? styles.secondary : styles.ghost}
            aria-pressed={chosen === a}
            disabled={!choice.open || busy || (a === "in" && !fits)}
            onClick={() => answer(a)}
          >
            {LABELS[a]}
          </button>
        ))}
      </div>
      {message !== undefined && (
        <p className={styles.small} role="status">
          {message}
        </p>
      )}
      {failed !== undefined && (
        <p className={styles.retry} role="status">
          Answer didn&apos;t go through.{" "}
          <button type="button" onClick={() => void send(failed)}>
            Retry
          </button>{" "}
          · your choice is kept on this phone until it does.
        </p>
      )}
    </div>
  );
}
