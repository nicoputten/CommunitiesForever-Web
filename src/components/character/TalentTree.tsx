"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import type { CSSProperties, ReactNode } from "react";
import { pointsText, type TalentView, type TreeTooltip } from "@/core/views/talentTooltip";
import { iconSrc } from "@/components/recipes/bits";
import game from "@/components/recipes/ItemTooltip.module.css";
import styles from "./TalentTree.module.css";

// WEB-100 (board talent-tooltips-v2, WB101 "closer to the game"): a talent tree as the game's talent frame, the
// talent tooltip in the game's format and the tree tooltip. The icons are the client's spell icons from the item icon
// cache (/api/item-icons); a talent without one shows an empty square.

/** A talent's icon in the game's states; `rank`: with the game's rank box in the corner. */
export function TalentIcon({
  talent,
  size,
  rank = false,
}: {
  talent: TalentView;
  size: "full" | "mini" | "list";
  rank?: boolean;
}) {
  return (
    <span className={styles.icon} data-state={talent.state} data-size={size}>
      {talent.icon !== undefined && (
        // eslint-disable-next-line @next/next/no-img-element -- our own icon cache, 56 px JPEGs scaled by CSS
        <img src={iconSrc(talent.icon)} alt="" loading="lazy" decoding="async" />
      )}
      {rank && (
        <span className={styles.rank} aria-hidden="true">
          {talent.rank}/{talent.maxRanks}
        </span>
      )}
    </span>
  );
}

/** The talent tooltip in the game's format: name, "Rank 2/5", the text, "Next rank:", red requirements. */
export function GameTalentTooltip({ talent, width }: { talent: TalentView; width?: "full" }) {
  return (
    <div className={styles.tip} data-width={width} data-testid="talent-tip">
      <div className={styles.tipName}>{talent.name}</div>
      <div>
        Rank {talent.rank}/{talent.maxRanks}
      </div>
      {talent.text !== undefined && <div className={styles.gold}>{talent.text}</div>}
      {talent.next !== undefined && (
        <>
          <div className={styles.nextLabel}>Next rank:</div>
          <div className={styles.gold}>{talent.next}</div>
        </>
      )}
      {talent.requires.map((r) => (
        <div key={r} className={styles.red}>
          {r}
        </div>
      ))}
    </div>
  );
}

/** "Aftermath 2/5", "Pyroclasm 0/2, locked": the name and the rank box's text (WCAG: the visible text in the name). */
function label(t: TalentView): string {
  return `${t.name} ${t.rank}/${t.maxRanks}${t.state === "locked" ? ", locked" : ""}`;
}

/**
 * A tree on its grid with the prerequisite arrows. `size` "full" (the frame, rank boxes, a header) or "mini" (the tree
 * tooltip's small tree). `mode`: "hover" (desktop: each talent's tooltip on hover or focus), "tap" (phone: a talent is a
 * button, `onPick` gets it), "none" (decorative).
 */
export function TreePanel({
  tip,
  size,
  mode,
  picked,
  onPick,
}: {
  tip: TreeTooltip;
  size: "full" | "mini";
  mode: "hover" | "tap" | "none";
  picked?: number;
  onPick?: (t: TalentView) => void;
}) {
  const tree = tip.tree!;
  const cell = (t: TalentView): ReactNode => {
    const place = { gridRow: t.row, gridColumn: t.column } as CSSProperties;
    const icon = <TalentIcon talent={t} size={size} rank={size === "full"} />;
    if (mode === "tap") {
      return (
        <button
          key={t.id}
          type="button"
          className={styles.cell}
          style={place}
          aria-label={label(t)}
          aria-pressed={picked === t.id}
          data-picked={picked === t.id || undefined}
          onClick={() => onPick?.(t)}
        >
          {icon}
        </button>
      );
    }
    if (mode === "hover") {
      return (
        <HoverCard.Root key={t.id} openDelay={100} closeDelay={60}>
          <HoverCard.Trigger asChild>
            <span className={styles.cell} style={place} tabIndex={0} role="img" aria-label={label(t)}>
              {icon}
            </span>
          </HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content
              className={`${game.floating} ${styles.overDialog}`}
              side="right"
              align="start"
              sideOffset={10}
              collisionPadding={8}
            >
              <GameTalentTooltip talent={t} />
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      );
    }
    return (
      <span key={t.id} className={styles.cell} style={place}>
        {icon}
      </span>
    );
  };
  return (
    <div className={styles.frame} data-size={size} data-testid={size === "full" ? "talent-tree" : "talent-tree-mini"}>
      {size === "full" && (
        <div className={styles.head}>
          {tip.icon !== undefined && (
            // eslint-disable-next-line @next/next/no-img-element -- our own icon cache
            <img className={styles.treeIcon} src={iconSrc(tip.icon)} alt="" />
          )}
          <span className={styles.treeName}>{tip.name ?? "Talent tree"}</span>
          <span className={styles.treePoints}>{pointsText(tip.points)}</span>
        </div>
      )}
      <div
        className={styles.grid}
        style={{ "--talent-columns": tree.columns, "--talent-rows": tree.rows } as CSSProperties}
        aria-hidden={mode === "none" ? "true" : undefined}
      >
        {tree.arrows.map((a, i) => (
          <span
            key={`a${i}`}
            className={styles.arrow}
            aria-hidden="true"
            data-dir={a.from.column === a.to.column ? "down" : "across"}
            data-active={a.active || undefined}
            style={
              {
                "--r1": a.from.row,
                "--c1": Math.min(a.from.column, a.to.column),
                "--r2": a.to.row,
                "--c2": Math.max(a.from.column, a.to.column),
              } as CSSProperties
            }
          />
        ))}
        {tree.talents.map(cell)}
      </div>
    </div>
  );
}

/** The tree tooltip (hover a tree row): A, the tree only; B, the small tree left and the talents with points right. */
export function TreeTooltipCard({ tip, width }: { tip: TreeTooltip; width?: "full" }) {
  if (tip.kind === "tree" || tip.tree === undefined) {
    return (
      <div className={styles.tip} data-width={width} data-testid="talent-tooltip">
        <div className={styles.tipTree}>{tip.name ?? "Talent tree"}</div>
        <div>{pointsText(tip.points)}</div>
        {tip.description !== undefined && <div className={styles.muted}>{tip.description}</div>}
      </div>
    );
  }
  return (
    <div className={styles.treeTip} data-testid="talent-tooltip">
      <div className={styles.treeTipMini}>
        <TreePanel tip={tip} size="mini" mode="none" />
      </div>
      <div className={styles.treeTipList}>
        <div className={styles.tipTree}>
          <span>{tip.name ?? "Talent tree"}</span>{" "}
          <span className={styles.treeTipPoints}>{pointsText(tip.points)}</span>
        </div>
        {tip.ranked.map((t) => (
          <div key={t.id} className={styles.ranked}>
            <TalentIcon talent={t} size="list" />
            <div>
              <div className={styles.rankedName}>{t.name}</div>
              {t.text !== undefined && <div className={styles.rankedText}>{t.text}</div>}
            </div>
            <span className={styles.pill} data-state={t.state}>
              {t.rank}/{t.maxRanks}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
