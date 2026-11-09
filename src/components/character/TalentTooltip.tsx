"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TalentView, TreeTooltip } from "@/core/views/talentTooltip";
import { useNoHover } from "@/components/recipes/ItemTooltip";
import game from "@/components/recipes/ItemTooltip.module.css";
import buttons from "@/components/recipes/buttons.module.css";
import { GameTalentTooltip, TreePanel, TreeTooltipCard } from "./TalentTree";
import styles from "./TalentTooltip.module.css";

// WEB-100 (board talent-tooltips-v2, WB101): a talent tree's row in the Talents box.
// - Desktop: hover or focus opens the tree tooltip after 150 ms, right of the box (A: name and points; B: the small
//   tree and the talents with points). With talent data a click opens the whole tree as the game's frame, each talent's
//   tooltip on hover.
// - Phone: a tap opens a bottom sheet: A, the tree tooltip; B, the tree, and a tapped talent's tooltip under it.
// The row gets a gold outline while its tooltip or tree is open.

function Sheet({ tip, style, titleId }: { tip: TreeTooltip; style?: CSSProperties; titleId: string }) {
  const [picked, setPicked] = useState<TalentView | undefined>(undefined);
  return (
    <>
      <Dialog.Title id={titleId} className="visually-hidden">
        {tip.name ?? "Talent tree"}
      </Dialog.Title>
      <div className={styles.body} style={style}>
        {tip.kind === "talents" && tip.tree !== undefined ? (
          <>
            <TreePanel tip={tip} size="full" mode="tap" picked={picked?.id} onPick={setPicked} />
            {picked !== undefined && <GameTalentTooltip talent={picked} width="full" />}
          </>
        ) : (
          <TreeTooltipCard tip={tip} width="full" />
        )}
      </div>
    </>
  );
}

/** A tree's row as the trigger: `children` are the row's label, bar and value. */
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
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const full = tip.kind === "talents" && tip.tree !== undefined;

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
            <Sheet tip={tip} style={style} titleId={titleId} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <HoverCard.Root open={hover && !open} onOpenChange={setHover} openDelay={150} closeDelay={80}>
        <HoverCard.Trigger asChild>
          {/* Not a Dialog.Trigger: without talent data the row only has its tooltip (and stays focusable). */}
          <button
            type="button"
            className={styles.row}
            data-open={hover || open || undefined}
            aria-haspopup={full ? "dialog" : undefined}
            onClick={full ? () => setOpen(true) : undefined}
          >
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
            style={style}
          >
            <TreeTooltipCard tip={tip} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
      {full && (
        <Dialog.Portal>
          <Dialog.Overlay className={game.scrim} />
          <Dialog.Content
            className={styles.dialog}
            onOpenAutoFocus={(e) => {
              // Focus Close, not the first talent (its tooltip would open on focus).
              e.preventDefault();
              close.current?.focus();
            }}
            aria-labelledby={titleId}
            aria-describedby={undefined}
            style={style}
          >
            <Dialog.Title id={titleId} className="visually-hidden">
              {tip.name ?? "Talent tree"}
            </Dialog.Title>
            <TreePanel tip={tip} size="full" mode="hover" />
            <Dialog.Close ref={close} className={`${buttons.secondary} ${styles.close}`}>
              Close
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
