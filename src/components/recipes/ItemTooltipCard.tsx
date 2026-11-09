import type { ReactNode } from "react";
import { itemQuality } from "@/core/gamedata/items";
import {
  itemFallbackName,
  itemSetView,
  itemTooltip,
  reagentsLine,
  type ItemTooltipView,
} from "@/core/views/itemTooltip";
import type { TooltipItem, TooltipSet } from "@/core/views/recipes";
import styles from "./ItemTooltip.module.css";

function viewOf(id: number, item: TooltipItem | undefined): ItemTooltipView | Omit<ItemTooltipView, "named" | "id"> {
  return item === undefined
    ? { name: itemFallbackName(id), quality: itemQuality(undefined), lines: [] }
    : itemTooltip({
        ...item.data,
        id,
        ...(item.name === undefined ? {} : { name: item.name }),
        quality: item.quality,
      });
}

function Lines({ lines }: { lines: ItemTooltipView["lines"] }) {
  return lines.map((l, i) =>
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
  );
}

/**
 * WEB-99 (board WB99): the set under the item's own lines, as the game shows a set nobody wears: the name and
 * "(0/N)" in gold, the pieces indented, then the bonuses, all pieces and bonuses in the game's grey.
 */
function SetBlock({ set }: { set: TooltipSet }) {
  const view = itemSetView(set);
  return (
    <div className={styles.set}>
      <div className={styles.setName}>{view.title}</div>
      <ul className={styles.setPieces}>
        {view.pieces.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      {view.bonuses.length > 0 && (
        <ul className={styles.setBonuses}>
          {view.bonuses.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const view = viewOf(id, item);
  // WEB-104: a recipe item shows the item it makes under its own lines, then the reagents, as the game does.
  const creates = item?.creates;
  const made = creates === undefined ? undefined : viewOf(creates.item.id, creates.item);
  const reagents = creates === undefined ? undefined : reagentsLine(creates.reagents);
  return (
    <div className={styles.card} data-width={width} data-quality={view.quality}>
      <div id={titleId} className={styles.title}>
        {view.name}
      </div>
      <Lines lines={view.lines} />
      {item?.set !== undefined && "named" in view && view.named && <SetBlock set={item.set} />}
      {made !== undefined && (
        <div className={styles.created} data-quality={made.quality}>
          <div className={styles.createdName}>{made.name}</div>
          <Lines lines={made.lines} />
          {reagents !== undefined && <div className={styles.line}>{reagents}</div>}
        </div>
      )}
      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
