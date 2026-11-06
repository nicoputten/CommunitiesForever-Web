"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import type { RecipeRow } from "@/core/views/recipes";
import { Crafter, ItemIcon, SkillNumbers, SourceText } from "./bits";
import { ItemTooltip } from "./ItemTooltip";
import { ItemTooltipCard } from "./ItemTooltipCard";
import { ItemsContextValue, useItemName } from "./itemsContext";
import buttons from "./buttons.module.css";
import styles from "./RecipeDrawer.module.css";

// The recipe drawer's contents (WEB-92, handoff C4, board recipes-drawer): icon, name, "Tailoring · Chest"; the full
// item tooltip; skill; reagents (each with its tooltip); who can make it; where it's learned; Copy link. The frame
// (a non-modal panel on desktop, a sheet on a phone) is ProfessionRecipes'.

export function RecipeDrawerBody({
  row,
  profession,
  titleId,
  close,
}: {
  row: RecipeRow;
  profession: string;
  titleId: string;
  close: ReactNode;
}) {
  const items = useContext(ItemsContextValue);
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <ItemIcon icon={row.icon} quality={row.quality} size="drawer" />
        <div className={styles.titles}>
          <h2 id={titleId} className={styles.name} data-quality={row.quality}>
            {row.name}
          </h2>
          <p className={styles.sub}>
            {profession} · {row.category}
          </p>
        </div>
        {close}
      </div>

      {row.itemId !== undefined && <ItemTooltipCard id={row.itemId} item={items.get(row.itemId)} width="full" />}

      <section className={styles.section} aria-label="Skill">
        <h3 className={styles.label}>Skill</h3>
        <SkillNumbers t={row.thresholds} />
      </section>

      {row.reagents.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.label}>Reagents</h3>
          <ul className={styles.list}>
            {row.reagents.map((r) => (
              <Reagent key={r.itemId} itemId={r.itemId} count={r.count} />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.label}>Can make it</h3>
        {row.knownBy.length === 0 ? (
          <p className={styles.nobody}>Nobody yet</p>
        ) : (
          <ul className={styles.list}>
            {row.knownBy.map((k) => (
              <li key={k.guid} className={styles.maker}>
                <Crafter {...k} />
                <span className={styles.meta}>
                  {profession}
                  {k.skill !== undefined && ` ${k.skill}`}
                  {k.online && " · online"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.label}>Learn from</h3>
        {row.sources.length === 0 ? (
          <SourceText source={undefined} />
        ) : (
          <ul className={styles.list}>
            {row.sources.map((s, i) => (
              <li key={i} className={styles.learn}>
                <SourceText source={s} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CopyLink />
    </div>
  );
}

function Reagent({ itemId, count }: { itemId: number; count: number }) {
  const { name, quality, icon } = useItemName(itemId);
  return (
    <li className={styles.reagent}>
      <ItemTooltip itemId={itemId} width="reagent" label={`${name}, item details`}>
        <span className={styles.reagentIcon}>
          <ItemIcon icon={icon} quality={quality} size="reagent" />
        </span>
      </ItemTooltip>
      <ItemTooltip itemId={itemId} width="reagent" hoverOnly>
        <span className={styles.reagentName} data-quality={quality}>
          {name}
        </span>
      </ItemTooltip>
      <span className={styles.count}>×{count}</span>
    </li>
  );
}

/** "Copy link": the page's URL with the drawer open; "Link copied" for a moment after. */
function CopyLink() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className={styles.copy}>
      <button
        type="button"
        className={buttons.secondary}
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        Copy link
      </button>
      <span role="status" className={styles.copied} data-shown={copied || undefined}>
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
