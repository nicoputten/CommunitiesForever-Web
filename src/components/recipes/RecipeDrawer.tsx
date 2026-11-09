"use client";

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ReagentSourceLine } from "@/core/views/reagentSources";
import type { RecipeRow } from "@/core/views/recipes";
import { Crafter, ItemIcon, SkillNumbers, SourceText } from "./bits";
import { ItemTooltip } from "./ItemTooltip";
import { ItemTooltipCard } from "./ItemTooltipCard";
import { ItemsContextValue, useItemName } from "./itemsContext";
import { ReagentSources } from "./ReagentSources";
import buttons from "./buttons.module.css";
import styles from "./RecipeDrawer.module.css";

// The recipe drawer's contents (WEB-92, handoff C4, board recipes-drawer): icon, name, "Tailoring · Chest"; the full
// item tooltip; skill; reagents (each with its tooltip, and where to get it, WEB-98); who can make it; where it's
// learned; Copy link. The frame (a non-modal panel on desktop, a sheet on a phone) is ProfessionRecipes'. A crafted
// reagent's link swaps the drawer to that recipe; the Back arrow returns (WEB-98, board reagent-sources).

/** The drawer's way to another recipe (WEB-98): a crafted reagent's link, and the Back arrow after one. */
export interface DrawerNav {
  hrefFor: (recipeId: number) => string;
  open: (recipeId: number) => void;
  /** The recipe the Back arrow returns to; undefined: no Back arrow. */
  back?: { name: string; go: () => void };
}

export function RecipeDrawerBody({
  row,
  profession,
  titleId,
  close,
  nav,
}: {
  row: RecipeRow;
  profession: string;
  titleId: string;
  close: ReactNode;
  nav: DrawerNav;
}) {
  const items = useContext(ItemsContextValue);
  // After a swap to another recipe (a crafted reagent, Back), focus moves to its name.
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(row.id);
  useEffect(() => {
    if (shown.current === row.id) return;
    shown.current = row.id;
    heading.current?.focus();
  }, [row.id]);
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        {nav.back !== undefined && (
          <button type="button" className={styles.close} aria-label={`Back to ${nav.back.name}`} onClick={nav.back.go}>
            <span aria-hidden="true">←</span>
          </button>
        )}
        <ItemIcon icon={row.icon} quality={row.quality} size="drawer" />
        <div className={styles.titles}>
          <h2 id={titleId} ref={heading} tabIndex={-1} className={styles.name} data-quality={row.quality}>
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
          <ul className={styles.reagents}>
            {row.reagents.map((r) => (
              <Reagent key={r.itemId} itemId={r.itemId} count={r.count} sources={r.sources} nav={nav} />
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

function Reagent({
  itemId,
  count,
  sources,
  nav,
}: {
  itemId: number;
  count: number;
  sources?: ReagentSourceLine[];
  nav: DrawerNav;
}) {
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
      {sources !== undefined && (
        <div className={styles.sources}>
          <ReagentSources sources={sources} hrefFor={nav.hrefFor} onOpen={nav.open} />
        </div>
      )}
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
