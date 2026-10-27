"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, LedgerIcon, NewerIcon, NothingNewIcon, SpinnerIcon } from "@/components/ui/icons";
import { LocalTime } from "@/components/ui/LocalTime";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import {
  checkBeforeUpload,
  LEDGER_FILE,
  ledgerCounts,
  ledgerCountsText,
  type UploadOutcome,
  uploadOutcome,
} from "@/core/views/upload";
import styles from "./Dropzone.module.css";

// The upload dropzone and its states (boards `upload`, `upload-states`; WEB-19). The whole page takes a dropped file.
// The server decides; the browser only checks the size and reads the file for the "N characters from M friends" line.

/** Where the addon's changes are listed ("What changed in format N"; Nico, WEB-19). */
const ADDON_RELEASES = "https://github.com/nicoputten/CommunitiesForever/releases";

type Phase = { kind: "idle" } | { kind: "reading"; counts?: string } | Exclude<UploadOutcome, { kind: "done" }>;

export interface DropzoneProps {
  /** The community the site is for (the site name, from the data): "Pick Doombringers in the addon". */
  community: string;
  isAdmin: boolean;
}

function hasFiles(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes("Files") ?? false;
}

/** Lets the browser paint the reading state before the file is parsed on the main thread. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export function Dropzone({ community, isAdmin }: DropzoneProps) {
  const router = useRouter();
  // The file input in state, not a ref: the state views are built during render and get `choose`.
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [lastFile, setLastFile] = useState<File | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = phase.kind === "reading";

  const send = useCallback(
    async (file: File) => {
      setLastFile(file);
      const tooLarge = checkBeforeUpload(file.size);
      if (tooLarge !== undefined) {
        setPhase(tooLarge);
        return;
      }
      setPhase({ kind: "reading" });
      await nextFrame();
      try {
        const counts = ledgerCountsText(ledgerCounts(normalize(parseLua(await file.text()))));
        setPhase({ kind: "reading", counts });
      } catch {
        // Not readable here either: the server says why.
      }
      let outcome: UploadOutcome;
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const body: unknown = await res.json().catch(() => undefined);
        outcome = uploadOutcome(res.status, body, file.name);
      } catch {
        outcome = { kind: "failed" };
      }
      if (outcome.kind === "done") {
        router.push(`/upload/${outcome.id}`);
        return;
      }
      setPhase(outcome);
      // A refused file is stored too: the history shows it.
      if (outcome.kind !== "failed" && outcome.kind !== "too-large") router.refresh();
    },
    [router],
  );

  const choose = () => input?.click();

  // The whole page accepts a drop (upload-states "Dragging over").
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      if (!busy) setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = busy ? "none" : "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file !== undefined && !busy) void send(file);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [busy, send]);

  // A result replaces the button that was used: focus moves to the result's own action, so keyboard users stay in
  // place (the status region reads the message out).
  useEffect(() => {
    if (phase.kind !== "idle" && phase.kind !== "reading")
      frame.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [phase]);

  const view = dragging
    ? DRAGGING
    : viewOf(phase, {
        community,
        isAdmin,
        choose,
        idle: () => setPhase({ kind: "idle" }),
        retry: () => {
          if (lastFile !== undefined) void send(lastFile);
        },
      });

  return (
    <div
      ref={frame}
      className={`${styles.zone} ${styles[view.tone]}`}
      data-state={dragging ? "dragging" : phase.kind}
      // The idle glow and float are this screen's small accents (Nico, WEB-19): ambient, so they pause with the tab.
      data-ambient={view.tone === "idle" ? "" : undefined}
      onClick={(e) => {
        // The zone is a pointer shortcut for its button; buttons and links inside act on their own.
        if (phase.kind === "idle" && !(e.target as Element).closest("button, a")) choose();
      }}
    >
      <input
        ref={setInput}
        type="file"
        accept=".lua"
        // The real file input; "Choose file" is its button for keyboard, pointer and screen readers.
        tabIndex={-1}
        aria-hidden="true"
        className="visually-hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file !== undefined) void send(file);
        }}
      />
      {phase.kind === "idle" && !dragging ? (
        <>
          <LedgerIcon className={`${styles.ledger} ${styles.float}`} />
          <p className={styles.drop}>
            Drop <span className={styles.fileName}>{LEDGER_FILE}</span> here
          </p>
          <p className={styles.or}>or</p>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={choose}>
            Choose file
          </button>
          <p className={styles.where}>
            Find it in your game folder under{" "}
            <span className={styles.path}>WTF › Account › [ACCOUNT] › SavedVariables</span>
          </p>
        </>
      ) : (
        <>
          {view.icon}
          <p className={styles.message}>{view.title}</p>
          {view.body !== undefined && <p className={styles.small}>{view.body}</p>}
          {view.extra}
          {view.action}
        </>
      )}
      <p role="status" className="visually-hidden">
        {view.announce}
      </p>
    </div>
  );
}

export interface UploadStateCardProps {
  outcome: Exclude<UploadOutcome, { kind: "done" | "too-large" | "failed" }>;
  community: string;
  isAdmin: boolean;
  /** Shows "Upload another" as the way on. */
  mayUpload: boolean;
}

const noop = () => {};

/**
 * A stored upload's state on its report page (WEB-20, Nico): a rejected or "nothing new" upload shows the upload
 * screen's frame and copy instead of a report, with "Upload another" (newer format: its own link) as the way on.
 */
export function UploadStateCard({ outcome, community, isAdmin, mayUpload }: UploadStateCardProps) {
  const view = viewOf(outcome, { community, isAdmin, stored: true, choose: noop, idle: noop, retry: noop });
  const action =
    outcome.kind === "newer-format" ? (
      view.action
    ) : mayUpload ? (
      <Link href="/upload" className={`${styles.button} ${styles.primary}`}>
        Upload another
      </Link>
    ) : undefined;
  return (
    <div className={`${styles.zone} ${styles[view.tone]}`} data-state={outcome.kind}>
      {view.icon}
      <h2 className={styles.message}>{view.title}</h2>
      {view.body !== undefined && <p className={styles.small}>{view.body}</p>}
      {action}
    </div>
  );
}

interface View {
  tone: "idle" | "over" | "reading" | "alert" | "neutral";
  icon?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  extra?: ReactNode;
  action?: ReactNode;
  /** What the status region reads out. */
  announce: string;
}

const DRAGGING: View = {
  tone: "over",
  icon: <LedgerIcon drag className={`${styles.dragIcon} ${styles.bob}`} />,
  title: "Let go to upload",
  announce: "",
};

interface Actions {
  community: string;
  isAdmin: boolean;
  /** A stored upload on its report page (WEB-20): the file's owner wasn't kept. */
  stored?: boolean;
  choose: () => void;
  idle: () => void;
  retry: () => void;
}

const em = (text: ReactNode) => <span className={styles.em}>{text}</span>;

function viewOf(phase: Phase, a: Actions): View {
  const another = (
    <button type="button" className={`${styles.button} ${styles.primary}`} onClick={a.choose}>
      Choose another file
    </button>
  );
  const tryAgain = (onClick: () => void) => (
    <button type="button" className={`${styles.button} ${styles.neutralButton}`} onClick={onClick}>
      Try again
    </button>
  );
  const alert = (title: string, body: ReactNode, text: string, action: ReactNode = another): View => ({
    tone: "alert",
    icon: <AlertIcon className={styles.stateIcon} />,
    title,
    body,
    action,
    announce: `${title}. ${text}`,
  });

  switch (phase.kind) {
    case "idle":
      return { tone: "idle", announce: "" };
    case "reading":
      return {
        tone: "reading",
        icon: <SpinnerIcon className={`${styles.spinner} ${styles.spin}`} />,
        title: "Reading the ledger…",
        body: phase.counts,
        extra: (
          <span className={styles.progress} aria-hidden="true">
            <span className={styles.bar} />
          </span>
        ),
        announce: phase.counts === undefined ? "Reading the ledger…" : `Reading the ledger… ${phase.counts}`,
      };
    case "wrong-file":
      return phase.fileName !== undefined
        ? alert(
            "That's not our ledger",
            <>
              This looks like the saved data of another addon ({em(phase.fileName)}). Pick the file named{" "}
              {em(LEDGER_FILE)}.
            </>,
            `This looks like the saved data of another addon (${phase.fileName}). Pick the file named ${LEDGER_FILE}.`,
          )
        : alert(
            "That's not our ledger",
            <>This looks like the saved data of another addon. Pick the file named {em(LEDGER_FILE)}.</>,
            `This looks like the saved data of another addon. Pick the file named ${LEDGER_FILE}.`,
          );
    case "damaged":
      return alert(
        "We couldn't read this ledger",
        <>The file seems cut off or damaged. Log out or {em("/reload")}, then upload it again.</>,
        "The file seems cut off or damaged. Log out or /reload, then upload it again.",
      );
    case "newer-format": {
      const then = a.isAdmin
        ? "Update the site first, then upload again."
        : "Ask the admin to update the site, then upload again.";
      const uses =
        phase.format !== undefined ? <>It uses data format {em(phase.format)}</> : <>It uses a newer data format</>;
      const usesText =
        phase.format !== undefined ? `It uses data format ${phase.format}` : "It uses a newer data format";
      return {
        tone: "alert",
        icon: <NewerIcon className={styles.stateIcon} />,
        title: "This file is from a newer addon",
        body: (
          <>
            {uses}; the site reads up to format {em(phase.supported)}. {then}
          </>
        ),
        action: (
          <a
            href={ADDON_RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.button} ${styles.goldButton}`}
          >
            {phase.format !== undefined ? `What changed in format ${phase.format}` : "What changed in the addon"}
          </a>
        ),
        announce: `This file is from a newer addon. ${usesText}; the site reads up to format ${phase.supported}. ${then}`,
      };
    }
    case "nothing-new": {
      const since = phase.since;
      const tail = "Did the game save yet? Log out or type /reload first.";
      return {
        tone: "neutral",
        icon: <NothingNewIcon className={styles.stateIcon} />,
        title: "The ledger hasn't changed",
        body: (
          <>
            {since !== undefined ? (
              <>
                This is the same data as your upload of <LocalTime at={since} />.
              </>
            ) : (
              "This is the same data the site already has."
            )}{" "}
            Did the game save yet? Log out or type {em("/reload")} first.
          </>
        ),
        action: tryAgain(a.idle),
        announce: `The ledger hasn't changed. ${since !== undefined ? "This is the same data as your earlier upload." : "This is the same data the site already has."} ${tail}`,
      };
    }
    case "not-your-file":
      return phase.owner !== undefined
        ? alert(
            "This is someone else's ledger",
            <>
              It belongs to {em(phase.owner)}. Sign in as {em(phase.owner)} to upload it. Nothing was changed.
            </>,
            `It belongs to ${phase.owner}. Sign in as ${phase.owner} to upload it. Nothing was changed.`,
          )
        : a.stored
          ? alert(
              "This is someone else's ledger",
              "It belongs to another BattleTag. Nothing was changed.",
              "It belongs to another BattleTag. Nothing was changed.",
            )
          : alert(
              "This is someone else's ledger",
              "This ledger doesn't say whose it is. Nothing was changed.",
              "This ledger doesn't say whose it is. Nothing was changed.",
            );
    case "other-community":
      return alert(
        "This ledger is for another community",
        <>
          The addon in this file has another community selected. Pick {em(a.community)} in the addon, {em("/reload")}{" "}
          and upload again.
        </>,
        `The addon in this file has another community selected. Pick ${a.community} in the addon, /reload and upload again.`,
      );
    case "no-community-yet":
      return alert(
        "The ledger isn't open yet",
        "Until the admin's first upload, only the admin can upload.",
        "Until the admin's first upload, only the admin can upload.",
        tryAgain(a.idle),
      );
    case "too-large":
      return alert(
        "That file is too big",
        <>A ledger is well under 25 MB. Pick the file named {em(LEDGER_FILE)}.</>,
        `A ledger is well under 25 MB. Pick the file named ${LEDGER_FILE}.`,
      );
    case "failed":
      return alert(
        "The upload didn't go through",
        "Nothing was changed. Try again.",
        "Nothing was changed. Try again.",
        tryAgain(a.retry),
      );
  }
}
