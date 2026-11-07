"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as HoverCard from "@radix-ui/react-hover-card";
import Link from "next/link";
import { useContext, useEffect, useId, useState, useSyncExternalStore, type ReactElement } from "react";
import type { TooltipItem } from "@/core/views/recipes";
import { ItemTooltipCard } from "./ItemTooltipCard";
import { ItemsContextValue } from "./itemsContext";
import styles from "./ItemTooltip.module.css";
import buttons from "./buttons.module.css";

// The shared item tooltip (WEB-92, handoff C1, boards recipes-drawer and recipes-phone): on every item icon and name.
// Hover opens it after 150 ms and it flips at the screen's edges (Radix HoverCard, placed by Floating UI). On a phone
// (no hover) a tap on the icon opens it as a small sheet with "Open recipe". Data comes from the page (ItemsProvider)
// or, for a page that didn't send it, from /api/items/<id> once per item.

const fetched = new Map<number, Promise<TooltipItem | undefined>>();

function loadItem(id: number): Promise<TooltipItem | undefined> {
  let p = fetched.get(id);
  if (p === undefined) {
    p = fetch(`/api/items/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<TooltipItem>) : undefined))
      .catch(() => undefined);
    fetched.set(id, p);
  }
  return p;
}

function useItem(id: number, wanted: boolean): TooltipItem | undefined {
  const known = useContext(ItemsContextValue).get(id);
  const [loaded, setLoaded] = useState<TooltipItem | undefined>(undefined);
  useEffect(() => {
    if (known !== undefined || !wanted) return;
    let live = true;
    void loadItem(id).then((item) => live && setLoaded(item));
    return () => {
      live = false;
    };
  }, [id, known, wanted]);
  return known ?? loaded;
}

const NO_HOVER = "(hover: none)";
const subscribeHover = (onChange: () => void) => {
  const q = window.matchMedia(NO_HOVER);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};

/** True on a touch screen without hover (a phone): tooltips open as a sheet on tap. */
export function useNoHover(): boolean {
  return useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(NO_HOVER).matches,
    () => false,
  );
}

export interface ItemTooltipProps {
  itemId: number;
  /** The element that shows the tooltip: an icon or a name. */
  children: ReactElement;
  /** "reagent": the 240 px tooltip. */
  width?: "item" | "reagent";
  /** Hover only (a name that is itself a link); otherwise a tap opens the phone sheet. */
  hoverOnly?: boolean;
  /** The phone sheet's "Open recipe" link. */
  recipeHref?: string;
  /** The tapped icon's accessible name on a phone ("Robe of the Archmage, item details"). */
  label?: string;
}

export function ItemTooltip({
  itemId,
  children,
  width = "item",
  hoverOnly = false,
  recipeHref,
  label,
}: ItemTooltipProps) {
  const noHover = useNoHover();
  const [open, setOpen] = useState(false);
  const item = useItem(itemId, open);
  const titleId = useId();

  if (noHover) {
    if (hoverOnly) return children;
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={styles.trigger}
            data-touch=""
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.scrim} />
          <Dialog.Content className={styles.sheet} aria-labelledby={titleId} aria-describedby={undefined}>
            <span className={styles.grab} aria-hidden="true" />
            <Dialog.Title className="visually-hidden">Item</Dialog.Title>
            <ItemTooltipCard id={itemId} item={item} width="full" titleId={titleId} />
            {recipeHref !== undefined && (
              <Link href={recipeHref} className={buttons.secondary} onClick={() => setOpen(false)}>
                Open recipe
              </Link>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={150} closeDelay={80}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className={styles.floating}
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={8}
          avoidCollisions
        >
          <ItemTooltipCard id={itemId} item={item} width={width} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
