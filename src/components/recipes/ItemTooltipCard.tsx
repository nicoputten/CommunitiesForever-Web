import type { ReactNode } from "react";
import { itemQuality } from "@/core/gamedata/items";
import { itemFallbackName, itemTooltip } from "@/core/views/itemTooltip";
import type { TooltipItem } from "@/core/views/recipes";
import styles from "./ItemTooltip.module.css";

/** The item tooltip's body in the game's look (board recipes-drawer). Without data: the fallback name only. */
export function ItemTooltipCard({
  id,
  item,
  width = "item",
  titleId,
  footer,
}: {
  id: number;
  item: TooltipItem | undefined;
  width?: "item" | "reagent" | "full";
  titleId?: string;
  /** Lines under the game's (WEB-102: a recipe drop's "Nobody knows it" and who could learn it). */
  footer?: ReactNode;
}) {
  const view =
    item === undefined
      ? { name: itemFallbackName(id), quality: itemQuality(undefined), lines: [] }
      : itemTooltip({
          ...item.data,
          id,
          ...(item.name === undefined ? {} : { name: item.name }),
          quality: item.quality,
        });
  return (
    <div className={styles.card} data-width={width} data-quality={view.quality}>
      <div id={titleId} className={styles.title}>
        {view.name}
      </div>
      {view.lines.map((l, i) =>
        l.right === undefined ? (
          <div key={i} className={styles.line} data-tone={l.tone}>
            {l.text}
          </div>
        ) : (
          <div key={i} className={`${styles.line} ${styles.split}`} data-tone={l.tone}>
            <span>{l.text}</span>
            <span>{l.right}</span>
          </div>
        ),
      )}
      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
