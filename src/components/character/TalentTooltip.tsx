"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { pointsText, type TalentCell, type TalentLine, type TreeTooltip } from "@/core/views/talentTooltip";
import { useNoHover } from "@/components/recipes/ItemTooltip";
import game from "@/components/recipes/ItemTooltip.module.css";
import styles from "./TalentTooltip.module.css";

// WEB-100 (board talent-tooltips, WB100): a talent tree's row in the Talents box opens its tooltip. Hover (after
// 150 ms, to the right of the box) or focus on a desktop; a tap on a phone opens it as a bottom sheet. The row gets a
// gold outline while it is open. A: the tree's name and points; B: its talents with rank and text, and the tree's
// grid (left of the list on a desktop, above it on a phone).

function Line({ line }: { line: TalentLine }) {
  return (
    <div className={styles.talent}>
      <span className={styles.name}>{line.name}</span>
      <span className={styles.rank}>
        {line.rank}/{line.maxRanks}
      </span>
      {line.text !== undefined && <div className={styles.text}>{line.text}</div>}
    </div>
  );
}

/** The star the board draws on every talent (the client's spell icons are not shown). */
function Glyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.glyph}>
      <path d="M10 2l2.5 5 5 .8-3.6 3.6.9 5.1L10 14l-4.8 2.5.9-5.1L2.5 7.8l5-.8z" />
    </svg>
  );
}

function cellLabel(c: TalentCell): string {
  return [`${c.name} ${c.rank}/${c.maxRanks}`, c.text].filter((x) => x !== undefined).join(": ");
}

/** One talent on the grid; on a desktop its own small tooltip (name, rank, text) on hover or focus. */
function Cell({ cell, interactive, style }: { cell: TalentCell; interactive: boolean; style?: CSSProperties }) {
  const body = (
    <span
      className={styles.cell}
      data-state={cell.state}
      style={{ gridRow: cell.row, gridColumn: cell.column }}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? cellLabel(cell) : undefined}
      role={interactive ? "img" : undefined}
    >
      <Glyph />
      {(cell.state === "full" || cell.state === "partial") && (
        <b className={styles.badge} aria-hidden="true">
          {cell.rank}/{cell.maxRanks}
        </b>
      )}
    </span>
  );
  if (!interactive) return body;
  return (
    <HoverCard.Root openDelay={150} closeDelay={60}>
      <HoverCard.Trigger asChild>{body}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content className={game.floating} side="right" align="start" sideOffset={8} collisionPadding={8}>
          <div className={`${game.card} ${styles.cellCard}`} style={style}>
            <Line line={cell} />
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function Grid({ tip, interactive, style }: { tip: TreeTooltip; interactive: boolean; style?: CSSProperties }) {
  const grid = tip.grid!;
  return (
    <div
      className={styles.grid}
      style={{ "--talent-columns": grid.columns, "--talent-rows": grid.rows } as CSSProperties}
      aria-hidden={interactive ? undefined : "true"}
      data-testid="talent-grid"
    >
      {grid.cells.map((c) => (
        <Cell key={`${c.row}:${c.column}`} cell={c} interactive={interactive} style={style} />
      ))}
    </div>
  );
}

/** The tooltip's body in the game's look. */
export function TalentTooltipCard({
  tip,
  phone,
  style,
  titleId,
}: {
  tip: TreeTooltip;
  phone: boolean;
  /** The class colours (the card is in a portal, outside the box that sets them). */
  style?: CSSProperties;
  titleId?: string;
}) {
  const head = (
    <>
      <div id={titleId} className={styles.title}>
        {tip.name ?? "Talent tree"}
      </div>
      <div>{pointsText(tip.points)}</div>
    </>
  );
  const description =
    tip.description !== undefined && (tip.kind === "tree" || tip.talents.length === 0) ? (
      <div className={styles.description}>{tip.description}</div>
    ) : undefined;
  const list = tip.talents.map((l, i) => <Line key={i} line={l} />);
  const width = tip.grid !== undefined && !phone ? "grid" : phone ? "full" : "list";
  return (
    <div className={`${game.card} ${styles.card}`} data-width={width} data-testid="talent-tooltip" style={style}>
      {tip.grid !== undefined && !phone ? (
        <div className={styles.withGrid}>
          <div className={styles.gridColumn}>
            <Grid tip={tip} interactive style={style} />
          </div>
          <div>
            {head}
            {description}
            {list}
          </div>
        </div>
      ) : (
        <>
          {head}
          {description}
          {tip.grid !== undefined && (
            <div className={styles.gridAbove}>
              <Grid tip={tip} interactive={false} />
            </div>
          )}
          {list}
        </>
      )}
    </div>
  );
}

/** A tree's row as the tooltip's trigger: `children` are the row's label, bar and value. */
export function TalentTreeRow({
  tip,
  style,
  children,
}: {
  tip: TreeTooltip;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const noHover = useNoHover();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  if (noHover) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button type="button" className={styles.row} data-open={open || undefined}>
            {children}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={game.scrim} />
          <Dialog.Content className={game.sheet} aria-labelledby={titleId} aria-describedby={undefined}>
            <span className={game.grab} aria-hidden="true" />
            <Dialog.Title className="visually-hidden">Talent tree</Dialog.Title>
            <TalentTooltipCard tip={tip} phone style={style} titleId={titleId} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={150} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <button type="button" className={styles.row} data-open={open || undefined} onClick={() => setOpen(true)}>
          {children}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className={game.floating}
          side="right"
          align="start"
          sideOffset={24}
          collisionPadding={8}
          avoidCollisions
        >
          <TalentTooltipCard tip={tip} phone={false} style={style} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
