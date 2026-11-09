"use client";

import type { MouseEvent } from "react";
import { chanceText } from "@/core/loot";
import { creatureTypePlural, levelRange, type ReagentSourceLine } from "@/core/views/reagentSources";
import { InfoTip } from "@/components/ui/InfoTip";
import { Hint } from "./Hint";
import styles from "./ReagentSources.module.css";

// WEB-98 (board reagent-sources): where to get a reagent, under it in the recipe drawer and the phone sheet. One line
// per source, an icon for its kind; "No known source" with an ⓘ when the data has none. A crafted reagent's link opens
// its recipe in the drawer (with a Back arrow there). Gold is never shown.

type IconKind = "vendor" | "crafted" | "skinning" | "herbalism" | "mining" | "drop";

/** The kind's 16 px icon (our own drawings after the board's: a coin, a hammer, a knife, a leaf, a pick, a skull). */
function SourceIcon({ kind }: { kind: IconKind }) {
  return (
    <svg className={styles.icon} data-kind={kind} viewBox="0 0 16 16" aria-hidden="true">
      {kind === "vendor" && (
        <>
          <circle cx="8" cy="8.5" r="5.5" data-part="line" />
          <path
            d="M9.6 6.6c-.4-.6-1-.8-1.6-.8-.9 0-1.6.5-1.6 1.2 0 1.6 3.3.9 3.3 2.5 0 .7-.7 1.2-1.7 1.2-.7 0-1.3-.3-1.7-.8M8 4.8v7.4"
            data-part="line"
          />
        </>
      )}
      {kind === "crafted" && (
        <>
          <path d="M3.5 12.5l6-6 1.5 1.5-6 6z" data-part="fill" />
          <path d="M9.5 3.5l2-1.5 2.5 2.5-1.5 2z" data-part="head" />
        </>
      )}
      {kind === "skinning" && (
        <>
          <path d="M4 12.5L12.5 4l1.3 1.3-8.5 8.5z" data-part="fill" />
          <path d="M2.2 14l2.3-2.3" data-part="dark" />
        </>
      )}
      {kind === "herbalism" && (
        <>
          <path d="M8 14V7.5" data-part="dark" />
          <path
            d="M8 9C5.2 9 3.2 7 3.2 4.2 6 4.2 8 6.2 8 9zM8 8c0-2.8 2-4.8 4.8-4.8 0 2.8-2 4.8-4.8 4.8z"
            data-part="fill"
          />
        </>
      )}
      {kind === "mining" && <path d="M3 5.5l6.8-2.2 2.9 2.9-2 1-6.6 6.6-1.8-1.8 6.6-6.6z" data-part="line" />}
      {kind === "drop" && (
        <>
          <path d="M3.2 7.2a4.8 4.8 0 0 1 9.6 0v2.6l-1.8 1v2H5v-2l-1.8-1z" data-part="line" />
          <circle cx="6.2" cy="8" r="1.1" data-part="fill" />
          <circle cx="9.8" cy="8" r="1.1" data-part="fill" />
        </>
      )}
    </svg>
  );
}

const LIMITED = "The vendor sells a few, then restocks.";

export function ReagentSources({
  sources,
  hrefFor,
  onOpen,
}: {
  sources: readonly ReagentSourceLine[];
  /** The drawer's URL with a crafted reagent's recipe open. */
  hrefFor: (recipeId: number) => string;
  onOpen: (recipeId: number) => void;
}) {
  if (sources.length === 0) {
    return (
      <p className={styles.none}>
        No known source
        <InfoTip>Not in our data yet.</InfoTip>
      </p>
    );
  }
  return (
    <ul className={styles.list} aria-label="Where to get it">
      {sources.map((s, i) => (
        <li key={i} className={styles.line}>
          <SourceIcon kind={s.kind === "vendor" ? "vendor" : s.kind} />
          <span>
            <SourceText source={s} hrefFor={hrefFor} onOpen={onOpen} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function SourceText({
  source: s,
  hrefFor,
  onOpen,
}: {
  source: ReagentSourceLine;
  hrefFor: (recipeId: number) => string;
  onOpen: (recipeId: number) => void;
}) {
  switch (s.kind) {
    case "vendor":
      return (
        <>
          <span className={styles.kind}>Vendor</span> · {s.npc}
          {s.zone !== undefined && ` · ${s.zone}`}
          {s.limited && (
            <Hint text={LIMITED}>
              <span className={styles.limited}>limited stock</span>
            </Hint>
          )}
        </>
      );
    case "crafted": {
      const open = (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(s.recipeId);
      };
      return (
        <>
          <span className={styles.kind}>Crafted</span> ·{" "}
          <a className={styles.link} href={hrefFor(s.recipeId)} onClick={open}>
            {s.name} ›
          </a>{" "}
          · {s.profession}
          {s.skill !== undefined && ` ${s.skill}`}
        </>
      );
    }
    case "skinning": {
      const levels = levelRange(s.minLevel, s.maxLevel);
      const what = [s.creatureType === undefined ? undefined : creatureTypePlural(s.creatureType), levels]
        .filter((x) => x !== undefined)
        .join(", ");
      return (
        <>
          <span className={styles.kind}>Skinning</span>
          {what !== "" && ` · ${what}`}
        </>
      );
    }
    case "herbalism":
    case "mining":
      return (
        <>
          <span className={styles.kind}>{s.kind === "herbalism" ? "Herbalism" : "Mining"}</span> · {s.nodes.join(" · ")}
        </>
      );
    case "drop":
      return (
        <>
          <span className={styles.kind}>Drop</span>
          {s.creatures.map((c) => (
            <span key={c.name}>
              {" "}
              · {c.name} <span className={styles.chance}>{chanceText(c.chance)}</span>
            </span>
          ))}
        </>
      );
  }
}
